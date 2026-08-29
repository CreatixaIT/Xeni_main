package cache

import (
	"context"
	"time"
)

// ── Admin / Content Cache Keys ──

const (
	KeyAdminOverview = "admin:overview"
	KeyContentHero   = "content:hero"
	KeyContentBanner = "content:banner"
	KeyContentFAQ    = "content:faq"
	KeyContentReviews = "content:reviews"
	KeyBillingPlans  = "billing:plans"
	KeyAdminTaskStats = "admin:tasks:stats"
)

// SetJSON stores a JSON byte slice with the given TTL.
func (c *Client) SetJSON(ctx context.Context, key string, data []byte, ttl time.Duration) error {
	return c.RDB.Set(ctx, key, data, ttl).Err()
}

// GetJSON retrieves a cached JSON byte slice. Returns nil if key doesn't exist.
func (c *Client) GetJSON(ctx context.Context, key string) ([]byte, error) {
	val, err := c.RDB.Get(ctx, key).Bytes()
	if err != nil {
		if err.Error() == "redis: nil" {
			return nil, nil
		}
		return nil, err
	}
	return val, nil
}

// Delete removes a single key from the cache.
func (c *Client) Delete(ctx context.Context, key string) error {
	return c.RDB.Del(ctx, key).Err()
}

// DeleteByPattern removes all keys matching a glob pattern using SCAN.
func (c *Client) DeleteByPattern(ctx context.Context, pattern string) error {
	iter := c.RDB.Scan(ctx, 0, pattern, 100).Iterator()
	for iter.Next(ctx) {
		c.RDB.Del(ctx, iter.Val())
	}
	return iter.Err()
}

// InvalidateContentCache removes all content:* cache keys.
func (c *Client) InvalidateContentCache(ctx context.Context, keys ...string) {
	for _, key := range keys {
		c.RDB.Del(ctx, key)
	}
}
