package redis

import (
	"context"
	"fmt"

	goredis "github.com/redis/go-redis/v9"
	"tokenfusiongateway/internal/config"
)

// Client wraps a go-redis client instance.
type Client struct {
	client *goredis.Client
}

// New creates a new Redis client from the given configuration.
func New(cfg *config.RedisConfig) *Client {
	client := goredis.NewClient(&goredis.Options{
		Addr:         fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Password:     cfg.Password,
		DB:           cfg.DB,
		PoolSize:     10,
		MinIdleConns: 2,
	})
	return &Client{client: client}
}

// GetClient returns the underlying go-redis client.
func (c *Client) GetClient() *goredis.Client {
	return c.client
}

// Ping verifies the connection to the Redis server.
func (c *Client) Ping(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}

// Close releases the connection resources held by the client.
func (c *Client) Close() error {
	return c.client.Close()
}
