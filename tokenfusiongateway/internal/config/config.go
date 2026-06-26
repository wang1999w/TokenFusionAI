package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

// Config holds all application configuration sections.
type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Redis   RedisConfig   `mapstructure:"redis"`
	Log     LogConfig     `mapstructure:"log"`
	Backend BackendConfig `mapstructure:"backend"`
	Security SecurityConfig `mapstructure:"security"`
}

// SecurityConfig Phase 6 安全加固配置
// 涵盖签名校验、限流、熔断等安全相关参数
type SecurityConfig struct {
	SignatureSecret string `mapstructure:"signature_secret"` // HMAC-SHA256 签名密钥，为空时关闭签名校验（开发环境）
	SignatureTTL    int    `mapstructure:"signature_ttl"`      // 签名时间戳有效期（秒），默认 300（5 分钟）

	// 三级限流参数（0 表示使用代码默认值）
	RateUserPerMinute   int `mapstructure:"rate_user_per_minute"`   // 每用户每分钟上限
	RateIPPerMinute     int `mapstructure:"rate_ip_per_minute"`     // 每 IP 每分钟上限
	RateGlobalPerSecond int `mapstructure:"rate_global_per_second"` // 全站每秒上限

	// 熔断参数（0 表示使用代码默认值）
	CircuitDeviceDailyCap    int `mapstructure:"circuit_device_daily_cap"`    // 免登每日封顶
	CircuitDeviceHourlySurge int `mapstructure:"circuit_device_hourly_surge"` // 免登每小时突增阈值
	CircuitOpenTTL           int `mapstructure:"circuit_open_ttl"`            // 熔断持续时间（秒）
}

// BackendConfig 后端业务服务配置
// 网关通过这些配置调用后端 API（鉴权、计费等内部接口）
type BackendConfig struct {
	URL          string `mapstructure:"url"`           // 后端服务基础地址，例如 http://localhost:3000
	InternalKey  string `mapstructure:"internal_key"`  // 内部调用密钥，放在 X-Internal-Key 请求头中校验
	JWTSecret    string `mapstructure:"jwt_secret"`    // JWT 签名密钥，用于本地解码 access_token
	JWTIssuer    string `mapstructure:"jwt_issuer"`    // JWT 签发方（可选校验）
	Timeout      int    `mapstructure:"timeout"`       // 调用后端 HTTP 超时时间（秒）
}

// ServerConfig holds HTTP server settings.
type ServerConfig struct {
	RunMode string `mapstructure:"mode"`
	Port    int    `mapstructure:"port"`
}

// RedisConfig holds Redis connection settings.
type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

// LogConfig holds logger settings.
type LogConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
}

// Load reads the configuration file at path and unmarshals it into a Config.
// Environment variables are also checked for overrides via viper.AutomaticEnv.
func Load(path string) (*Config, error) {
	viper.SetConfigFile(path)

	// 将配置键中的 "." 替换为 "_"，便于通过环境变量覆盖（如 backend.url -> BACKEND_URL）
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()

	// 显式绑定常用环境变量，保证 BACKEND_URL / INTERNAL_KEY / JWT_SECRET 等可被正确读取
	_ = viper.BindEnv("backend.url", "BACKEND_URL")
	_ = viper.BindEnv("backend.internal_key", "INTERNAL_KEY")
	_ = viper.BindEnv("backend.jwt_secret", "JWT_SECRET")
	_ = viper.BindEnv("backend.jwt_issuer", "JWT_ISSUER")

	// 绑定 Phase 6 安全相关环境变量
	_ = viper.BindEnv("security.signature_secret", "SIGNATURE_SECRET")
	_ = viper.BindEnv("security.signature_ttl", "SIGNATURE_TTL")

	// 设置合理的默认值，避免配置缺失时服务无法启动
	viper.SetDefault("backend.timeout", 10)
	viper.SetDefault("backend.jwt_issuer", "tokenfusion")
	// 安全配置默认值：签名有效期默认 300 秒（5 分钟）
	viper.SetDefault("security.signature_ttl", 300)

	if err := viper.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config file %s: %w", path, err)
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &cfg, nil
}
