package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"tokenfusiongateway/internal/config"
	"tokenfusiongateway/internal/middleware"
	"tokenfusiongateway/pkg/logger"
	gwredis "tokenfusiongateway/pkg/redis"
)

func main() {
	// 加载配置文件 configs/config.yaml
	cfg, err := config.Load("configs/config.yaml")
	if err != nil {
		fmt.Printf("failed to load config: %v\n", err)
		os.Exit(1)
	}

	// 初始化 Zap 日志组件
	if err := logger.Init(cfg.Log.Level, cfg.Log.Format); err != nil {
		fmt.Printf("failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	logger.Info("配置加载完成",
		zap.String("mode", cfg.Server.RunMode),
		zap.Int("port", cfg.Server.Port),
	)

	// 初始化 Redis 客户端（用于风控、计费、缓存）
	redisClient := gwredis.New(&cfg.Redis)
	defer redisClient.Close()
	logger.Info("Redis 客户端初始化完成",
		zap.String("host", cfg.Redis.Host),
		zap.Int("port", cfg.Redis.Port),
		zap.Int("db", cfg.Redis.DB),
	)

	// 设置 Gin 运行模式（debug/release/test）
	gin.SetMode(cfg.Server.RunMode)

	// 创建 Gin 路由引擎
	r := gin.New()

	// 注册中间件链（顺序敏感：恢复 → 日志 → 跨域 → 请求ID）
	r.Use(middleware.Recover())   // Panic 恢复，防止服务崩溃
	r.Use(middleware.Logger())    // 请求日志记录
	r.Use(middleware.CORS())      // 跨域处理
	r.Use(middleware.RequestID()) // 请求唯一ID生成

	// 注册路由
	r.GET("/health", healthHandler) // 健康检查端点

	// 确定监听端口，默认 8080
	port := cfg.Server.Port
	if port == 0 {
		port = 8080
	}

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: r,
	}

	// 在 goroutine 中启动 HTTP 服务，避免阻塞主线程信号监听
	go func() {
		logger.Info("网关服务启动中", zap.Int("port", port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("服务启动失败", zap.Error(err))
			os.Exit(1)
		}
	}()

	// 监听系统中断信号，触发优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("正在关闭网关服务...")

	// 给予 5 秒超时时间处理剩余请求
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("服务强制关闭", zap.Error(err))
	}

	logger.Info("网关服务已退出")
}

// healthHandler 健康检查处理器，返回服务运行状态
func healthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
