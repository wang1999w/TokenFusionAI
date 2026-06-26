package middleware

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"tokenfusiongateway/internal/model"
	"tokenfusiongateway/pkg/logger"
	gwredis "tokenfusiongateway/pkg/redis"
)

// ====================================================================================
// 签名校验中间件（internal/middleware/signature.go）
// ------------------------------------------------------------------------------------
// 对内部网关路由（/gateway/v1/*）进行 HMAC-SHA256 签名校验与时间戳防重放，
// 防止请求被篡改或重放攻击：
//   1. 校验 X-Timestamp 头：必须在有效期（默认 5 分钟）内，防止旧请求重放
//   2. 校验 X-Signature 头：HMAC-SHA256(timestamp + body, secret) 的十六进制摘要
//   3. 防重放：将已用 (timestamp+nonce) 写入 Redis，TTL 与有效期一致，重复即拒绝
//
// 客户端签名计算（示例）：
//   raw = X-Timestamp + request_body
//   signature = hex(HMAC_SHA256(raw, secret))
//
// 仅使用标准库（crypto/hmac、crypto/sha256），不引入新依赖。
// ====================================================================================

// 签名校验相关请求头
const (
	HeaderXSignature = "X-Signature" // 签名头，十六进制 HMAC-SHA256 摘要
	HeaderXTimestamp = "X-Timestamp" // 时间戳头，Unix 毫秒
	HeaderXNonce     = "X-Nonce"     // 随机串头，配合时间戳防重放（可选）
)

// 默认签名有效期（5 分钟），与需求一致
const defaultSignatureTTL = 5 * time.Minute

// 防重放 Redis 键前缀
const signatureNoncePrefix = "sign:nonce:"

// Signature 签名校验中间件
type Signature struct {
	secret string         // HMAC 密钥（应与后端/客户端约定一致）
	ttl    time.Duration  // 时间戳有效期
	redis  *gwredis.Client // Redis 客户端，用于防重放
	enable bool           // 是否启用（secret 为空时自动关闭，便于开发环境）
}

// NewSignature 创建签名校验中间件
// secret 为空时中间件自动降级为不校验（开发环境友好），生产环境务必配置 secret
func NewSignature(secret string, redis *gwredis.Client) *Signature {
	s := &Signature{
		secret: secret,
		ttl:    defaultSignatureTTL,
		redis:  redis,
		enable: secret != "",
	}
	return s
}

// WithTTL 设置时间戳有效期（链式调用）
func (s *Signature) WithTTL(ttl time.Duration) *Signature {
	if ttl > 0 {
		s.ttl = ttl
	}
	return s
}

// Middleware 返回 gin 中间件
func (s *Signature) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 未配置密钥则跳过校验（开发环境兼容）
		if !s.enable {
			c.Next()
			return
		}

		// 1. 读取并校验时间戳
		tsStr := c.GetHeader(HeaderXTimestamp)
		if tsStr == "" {
			s.reject(c, http.StatusUnauthorized, "缺少时间戳", "missing_timestamp")
			return
		}
		ts, err := strconv.ParseInt(tsStr, 10, 64)
		if err != nil {
			s.reject(c, http.StatusUnauthorized, "时间戳格式非法", "invalid_timestamp")
			return
		}
		// 将毫秒时间戳转换为 time.Time 进行有效期校验
		reqTime := time.UnixMilli(ts)
		now := time.Now()
		// 时间戳超出有效期（含时钟偏移容忍 1 分钟）视为过期/重放
		if now.Sub(reqTime) > s.ttl || reqTime.Sub(now) > time.Minute {
			s.reject(c, http.StatusUnauthorized, "时间戳已过期", "expired_timestamp")
			return
		}

		// 2. 读取请求体用于签名计算（读取后需回填，保证后续 handler 可再次读取）
		bodyBytes, err := readAndRestoreBody(c)
		if err != nil {
			s.reject(c, http.StatusBadRequest, "读取请求体失败", "invalid_body")
			return
		}

		// 3. 校验签名
		sig := c.GetHeader(HeaderXSignature)
		if sig == "" {
			s.reject(c, http.StatusUnauthorized, "缺少签名", "missing_signature")
			return
		}
		// 签名原文 = 时间戳 + 请求体
		raw := append([]byte(tsStr), bodyBytes...)
		expectedSig := s.sign(raw)
		// 使用 hmac.Equal 恒定时间比较，防止时序攻击
		if !hmac.Equal([]byte(sig), []byte(expectedSig)) {
			logger.Warn("签名校验失败",
				zap.String("ip", clientIP(c)),
				zap.String("path", c.Request.URL.Path),
			)
			s.reject(c, http.StatusUnauthorized, "签名校验失败", "invalid_signature")
			return
		}

		// 4. 防重放：基于 nonce（或 timestamp）记录已用请求
		nonce := c.GetHeader(HeaderXNonce)
		if nonce == "" {
			// 未携带 nonce 时退化为用 timestamp+签名摘要 作为去重键
			nonce = tsStr + ":" + sig
		}
		nonceKey := signatureNoncePrefix + nonce
		// SETNX 成功（首次）才放行；已存在表示重放，拒绝
		ok, err := s.redis.GetClient().SetNX(c.Request.Context(), nonceKey, "1", s.ttl).Result()
		if err != nil {
			// Redis 异常时容错放行，避免影响正常请求
			logger.Warn("防重放写入失败，容错放行", zap.Error(err))
		} else if !ok {
			s.reject(c, http.StatusUnauthorized, "请求已处理，疑似重放", "replay_detected")
			return
		}

		c.Next()
	}
}

// sign 计算 HMAC-SHA256 并返回十六进制小写摘要
func (s *Signature) sign(raw []byte) string {
	mac := hmac.New(sha256.New, []byte(s.secret))
	mac.Write(raw)
	return hex.EncodeToString(mac.Sum(nil))
}

// readAndRestoreBody 读取请求体字节并回填，使后续中间件/handler 仍可读取 Body
func readAndRestoreBody(c *gin.Context) ([]byte, error) {
	if c.Request.Body == nil {
		return nil, nil
	}
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return nil, err
	}
	// 回填请求体，保证可重复读取
	c.Request.Body = io.NopCloser(bytes.NewReader(body))
	return body, nil
}

// reject 拦截请求并返回网关格式错误
func (s *Signature) reject(c *gin.Context, status int, message, code string) {
	c.AbortWithStatusJSON(status, &model.GatewayResponse{
		Code:    model.CodeUnauthorized,
		Message: message,
		Data:    nil,
	})
}
