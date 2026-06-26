package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"

	"tokenfusiongateway/internal/config"
	"tokenfusiongateway/pkg/logger"
	gwredis "tokenfusiongateway/pkg/redis"
)

// 鉴权方式类型
const (
	AuthTypeUser   = "user"   // 普通用户（access_token）
	AuthTypeAPIKey = "apikey" // API Key 调用
	AuthTypeDevice = "device" // 设备免登用户
)

// HTTP 请求头名称
const (
	HeaderAuthorization = "Authorization" // 标准鉴权头：Bearer <token>
	HeaderAPIKey        = "X-API-Key"     // API Key 头
	HeaderDeviceID      = "X-Device-Id"   // 设备 ID 头（免登用户）
	HeaderInternalKey   = "X-Internal-Key" // 内部调用密钥头
)

// AuthResult 鉴权结果
// 鉴权成功后返回，包含调用方身份信息，供后续风控、计费、审计使用
type AuthResult struct {
	UserID   string // 用户ID（user/apikey 类型有值，device 类型为空）
	Role     string // 用户角色：user/admin 等
	Type     string // 鉴权类型：user/apikey/device
	DeviceID string // 设备ID（仅 device 类型有值）
}

// jwtClaims JWT 载荷（自定义声明），与后端签发的 claims 对应
type jwtClaims struct {
	UserID string `json:"user_id"` // 用户ID
	Role   string `json:"role"`    // 用户角色
	Exp    int64  `json:"exp"`     // 过期时间（Unix 时间戳，秒）
	Iss    string `json:"iss,omitempty"` // 签发方
}

// backendProfileResponse 后端 /api/v1/user/profile 返回结构
type backendProfileResponse struct {
	Code    int    `json:"code"`    // 业务状态码
	Message string `json:"message"` // 提示信息
	Data    struct {
		UserID string `json:"user_id"` // 用户ID
		Role   string `json:"role"`    // 用户角色
	} `json:"data"`
}

// AuthService 鉴权服务
// 负责校验调用方身份：access_token（JWT 本地解码）、api_key（后端校验）、device_id（免登）
type AuthService struct {
	cfg        *config.Config      // 应用配置（含 JWT 密钥、后端地址等）
	httpClient *http.Client        // HTTP 客户端，用于调用后端接口
	redis      *gwredis.Client     // Redis 客户端（可选，用于缓存/黑名单）
}

// NewAuthService 创建鉴权服务实例
func NewAuthService(cfg *config.Config, redis *gwredis.Client) *AuthService {
	timeout := time.Duration(cfg.Backend.Timeout) * time.Second
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	return &AuthService{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: timeout, // 调用后端接口的超时时间
		},
		redis: redis,
	}
}

// Authenticate 统一鉴权入口
// 按优先级校验调用方身份：
//  1. X-API-Key 存在 -> apikey 鉴权（调用后端校验）
//  2. Authorization: Bearer <token> 存在 -> user 鉴权（JWT 本地解码）
//  3. X-Device-Id 存在 -> device 鉴权（免登用户）
//  4. 以上都不存在 -> 返回未授权错误
func (s *AuthService) Authenticate(ctx context.Context, header http.Header) (*AuthResult, error) {
	// 1. 优先校验 API Key
	if apiKey := header.Get(HeaderAPIKey); apiKey != "" {
		return s.validateAPIKey(ctx, apiKey)
	}

	// 2. 校验 access_token（JWT）
	if auth := header.Get(HeaderAuthorization); auth != "" {
		token := extractBearerToken(auth)
		if token != "" {
			return s.validateAccessToken(ctx, token)
		}
	}

	// 3. 校验设备 ID（免登用户）
	if deviceID := header.Get(HeaderDeviceID); deviceID != "" {
		return s.validateDevice(ctx, deviceID)
	}

	// 4. 未提供任何鉴权凭证
	return nil, ErrUnauthorized
}

// validateAccessToken 校验 access_token
// 优先使用 JWT 密钥本地解码验证签名，减少对后端的调用
// 本地解码失败时返回未授权错误
func (s *AuthService) validateAccessToken(ctx context.Context, token string) (*AuthResult, error) {
	claims, err := s.decodeJWT(token)
	if err != nil {
		logger.Warn("access_token JWT 解码失败", zap.Error(err))
		return nil, ErrUnauthorized
	}

	// 校验签发方（若配置了 issuer）
	if s.cfg.Backend.JWTIssuer != "" && claims.Iss != "" && claims.Iss != s.cfg.Backend.JWTIssuer {
		logger.Warn("access_token 签发方不匹配",
			zap.String("expected", s.cfg.Backend.JWTIssuer),
			zap.String("actual", claims.Iss))
		return nil, ErrUnauthorized
	}

	return &AuthResult{
		UserID: claims.UserID,
		Role:   claims.Role,
		Type:   AuthTypeUser,
	}, nil
}

// decodeJWT 本地解码并验证 JWT（HS256 算法）
// JWT 结构：base64url(header).base64url(payload).base64url(signature)
// 验证步骤：
//  1. 按 "." 分割为三段
//  2. 使用 HMAC-SHA256 重新计算签名，与 token 中的签名比对
//  3. 解析 payload，校验 exp 过期时间
func (s *AuthService) decodeJWT(token string) (*jwtClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid token format")
	}

	signingInput := parts[0] + "." + parts[1]
	secret := s.cfg.Backend.JWTSecret

	// 校验签名（HMAC-SHA256），使用恒定时间比较防止时序攻击
	expectedSig, err := hmacSHA256(signingInput, secret)
	if err != nil {
		return nil, fmt.Errorf("compute signature failed: %w", err)
	}
	actualSig, err := base64urlDecode(parts[2])
	if err != nil {
		return nil, fmt.Errorf("decode signature failed: %w", err)
	}
	if !hmac.Equal(expectedSig, actualSig) {
		return nil, fmt.Errorf("signature mismatch")
	}

	// 解析 payload（claims）
	payloadBytes, err := base64urlDecode(parts[1])
	if err != nil {
		return nil, fmt.Errorf("decode payload failed: %w", err)
	}
	var claims jwtClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, fmt.Errorf("unmarshal claims failed: %w", err)
	}

	// 校验过期时间
	if claims.Exp > 0 {
		if time.Now().Unix() > claims.Exp {
			return nil, fmt.Errorf("token expired")
		}
	}

	return &claims, nil
}

// AuthenticateAPIKey 校验 API Key（导出方法，供 OpenAI 兼容层与中间件复用）
// 与 validateAPIKey 内部逻辑一致，校验 sk-tf-xxx 格式并调用后端获取用户信息
// 返回 AuthResult，Type 为 AuthTypeAPIKey
func (s *AuthService) AuthenticateAPIKey(ctx context.Context, apiKey string) (*AuthResult, error) {
	return s.validateAPIKey(ctx, apiKey)
}

// validateAPIKey 校验 API Key
// 格式要求：以 "sk-tf-" 开头；通过后端接口验证有效性并获取用户信息
func (s *AuthService) validateAPIKey(ctx context.Context, apiKey string) (*AuthResult, error) {
	// 1. 本地格式校验
	if !strings.HasPrefix(apiKey, "sk-tf-") {
		logger.Warn("API Key 格式非法", zap.String("prefix", apiKey[:min(len(apiKey), 6)]))
		return nil, ErrUnauthorized
	}

	// 2. 调用后端验证 API Key 并获取用户信息
	profile, err := s.fetchUserProfile(ctx, apiKey, HeaderAPIKey)
	if err != nil {
		logger.Error("API Key 后端校验失败", zap.Error(err))
		return nil, ErrUnauthorized
	}

	return &AuthResult{
		UserID: profile.Data.UserID,
		Role:   profile.Data.Role,
		Type:   AuthTypeAPIKey,
	}, nil
}

// validateDevice 校验设备 ID（免登用户）
// 免登用户无需登录，仅记录设备 ID 用于风控与计费
func (s *AuthService) validateDevice(ctx context.Context, deviceID string) (*AuthResult, error) {
	if strings.TrimSpace(deviceID) == "" {
		return nil, ErrUnauthorized
	}
	return &AuthResult{
		UserID:   "",
		Role:     "guest",
		Type:     AuthTypeDevice,
		DeviceID: deviceID,
	}, nil
}

// fetchUserProfile 调用后端 /api/v1/user/profile 获取用户信息
// authValue 为鉴权值，authHeader 指定放在哪个请求头（X-API-Key 或 Authorization）
func (s *AuthService) fetchUserProfile(ctx context.Context, authValue, authHeader string) (*backendProfileResponse, error) {
	url := strings.TrimRight(s.cfg.Backend.URL, "/") + "/api/v1/user/profile"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request failed: %w", err)
	}

	// 设置鉴权头与内部调用密钥头
	req.Header.Set(authHeader, authValue)
	req.Header.Set(HeaderInternalKey, s.cfg.Backend.InternalKey)
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call backend failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response failed: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("backend returned status %d: %s", resp.StatusCode, string(body))
	}

	var profile backendProfileResponse
	if err := json.Unmarshal(body, &profile); err != nil {
		return nil, fmt.Errorf("unmarshal profile failed: %w", err)
	}

	// 后端业务码非 0 视为校验失败
	if profile.Code != 0 {
		return nil, fmt.Errorf("backend business error: %s", profile.Message)
	}

	return &profile, nil
}

// extractBearerToken 从 Authorization 头提取 Bearer token
// 格式：Bearer <token>
func extractBearerToken(auth string) string {
	const prefix = "Bearer "
	if len(auth) > len(prefix) && strings.EqualFold(auth[:len(prefix)], prefix) {
		return strings.TrimSpace(auth[len(prefix):])
	}
	return ""
}

// hmacSHA256 使用密钥对输入计算 HMAC-SHA256，返回字节数组
func hmacSHA256(input, secret string) ([]byte, error) {
	mac := hmac.New(sha256.New, []byte(secret))
	if _, err := mac.Write([]byte(input)); err != nil {
		return nil, err
	}
	return mac.Sum(nil), nil
}

// base64urlDecode Base64 URL 安全解码（无填充）
func base64urlDecode(s string) ([]byte, error) {
	// 补齐缺失的填充字符
	if pad := len(s) % 4; pad > 0 {
		s += strings.Repeat("=", 4-pad)
	}
	return base64.URLEncoding.DecodeString(s)
}
