package middleware

import (
	"context"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/xeni-ai/gateway/internal/cache"
	"github.com/xeni-ai/gateway/internal/models"
	jwtPkg "github.com/xeni-ai/gateway/pkg/jwt"
	"github.com/xeni-ai/gateway/pkg/response"
)

// AuthMiddleware validates JWT access tokens.
func AuthMiddleware(jwtManager *jwtPkg.Manager, redisClient *cache.Client) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return response.Unauthorized(c, "Authorization header is required")
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return response.Unauthorized(c, "Invalid authorization format. Use: Bearer <token>")
		}

		claims, err := jwtManager.ValidateAccessToken(parts[1])
		if err != nil {
			return response.Unauthorized(c, "Invalid or expired token")
		}

		// Check JWT blocklist
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		blocked, err := redisClient.IsJWTBlocked(ctx, claims.ID)
		if err != nil {
			return response.InternalError(c)
		}
		if blocked {
			return response.Unauthorized(c, "Token has been revoked")
		}

		// Store user info in context
		c.Locals("user_id", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("role", claims.Role)
		c.Locals("jti", claims.ID)
		c.Locals("token_exp", claims.ExpiresAt.Time)

		return c.Next()
	}
}

// RBACMiddleware checks if the user has the required role.
func RBACMiddleware(allowedRoles ...models.UserRole) fiber.Handler {
	return func(c *fiber.Ctx) error {
		role := c.Locals("role")
		if role == nil {
			return response.Unauthorized(c, "Authentication required")
		}

		userRole := models.UserRole(role.(string))
		for _, allowed := range allowedRoles {
			if userRole == allowed {
				return c.Next()
			}
		}

		return response.Forbidden(c, "Insufficient permissions")
	}
}

// RateLimitMiddleware enforces request rate limits via Redis.
func RateLimitMiddleware(redisClient *cache.Client, limit int, window time.Duration, keyPrefix string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var key string
		if keyPrefix == "auth" {
			key = "rate:auth:" + c.IP()
		} else {
			userID := c.Locals("user_id")
			if userID != nil {
				key = "rate:api:" + userID.(string)
			} else {
				key = "rate:api:" + c.IP()
			}
		}

		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		allowed, err := redisClient.CheckRateLimit(ctx, key, limit, window)
		if err != nil {
			// Fail open on Redis errors
			return c.Next()
		}

		if !allowed {
			return response.TooManyRequests(c, "Rate limit exceeded. Please wait and try again.")
		}

		return c.Next()
	}
}

// RequestIDMiddleware adds a unique request ID to each request.
func RequestIDMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		requestID := c.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Locals("request_id", requestID)
		c.Set("X-Request-ID", requestID)
		return c.Next()
	}
}

// SecurityHeadersMiddleware adds security headers to all responses.
func SecurityHeadersMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Set("X-Frame-Options", "SAMEORIGIN")
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("X-XSS-Protection", "1; mode=block")
		c.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		c.Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://www.googleapis.com https://accounts.google.com https://graph.facebook.com wss:; frame-src https://accounts.google.com https://www.facebook.com")
		c.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		c.Set("Cross-Origin-Opener-Policy", "unsafe-none")
		return c.Next()
	}
}
