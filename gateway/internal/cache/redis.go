package cache

import (
	"context"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/xeni-ai/gateway/internal/config"
)

// Client wraps the Redis client for application use.
type Client struct {
	RDB *redis.Client
}

// Connect creates a new Redis client connection.
func Connect(cfg *config.RedisConfig) (*Client, error) {
	opts, err := redis.ParseURL(cfg.URI)
	if err != nil {
		return nil, err
	}

	rdb := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	slog.Info("connected to Redis")
	return &Client{RDB: rdb}, nil
}

// ── JWT Blocklist ──

// BlockJWT adds a JWT's JTI to the blocklist with the given TTL.
func (c *Client) BlockJWT(ctx context.Context, jti string, ttl time.Duration) error {
	return c.RDB.Set(ctx, "auth:blocklist:"+jti, "1", ttl).Err()
}

// IsJWTBlocked checks if a JWT's JTI is in the blocklist.
func (c *Client) IsJWTBlocked(ctx context.Context, jti string) (bool, error) {
	val, err := c.RDB.Exists(ctx, "auth:blocklist:"+jti).Result()
	if err != nil {
		return false, err
	}
	return val > 0, nil
}

// ── Subscription Cache ──

// SetSubscription caches a user's subscription tier.
func (c *Client) SetSubscription(ctx context.Context, userID string, data []byte) error {
	return c.RDB.Set(ctx, "user:subscription:"+userID, data, 5*time.Minute).Err()
}

// GetSubscription retrieves a cached subscription tier.
func (c *Client) GetSubscription(ctx context.Context, userID string) ([]byte, error) {
	val, err := c.RDB.Get(ctx, "user:subscription:"+userID).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	return val, err
}

// DeleteSubscription invalidates a cached subscription.
func (c *Client) DeleteSubscription(ctx context.Context, userID string) error {
	return c.RDB.Del(ctx, "user:subscription:"+userID).Err()
}

// ── Rate Limiting ──

// CheckRateLimit implements a sliding window rate limiter.
func (c *Client) CheckRateLimit(ctx context.Context, key string, limit int, window time.Duration) (bool, error) {
	val, err := c.RDB.Incr(ctx, key).Result()
	if err != nil {
		return false, err
	}

	if val == 1 {
		c.RDB.Expire(ctx, key, window)
	}

	return val <= int64(limit), nil
}
