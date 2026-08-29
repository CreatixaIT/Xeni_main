package jwt

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Claims represents the JWT token claims.
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// Manager handles JWT operations.
type Manager struct {
	secret        []byte
	accessExpiry  time.Duration
	refreshExpiry time.Duration
}

// NewManager creates a new JWT manager.
func NewManager(secret string, accessExpiry, refreshExpiry time.Duration) *Manager {
	return &Manager{
		secret:        []byte(secret),
		accessExpiry:  accessExpiry,
		refreshExpiry: refreshExpiry,
	}
}

// TokenPair represents an access + refresh token pair.
type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"`
	JTI          string `json:"jti"`
}

// GenerateTokenPair creates both access and refresh tokens.
func (m *Manager) GenerateTokenPair(userID, email, role string) (*TokenPair, error) {
	jti := uuid.New().String()
	now := time.Now()

	// Access token
	accessClaims := &Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(m.accessExpiry)),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        jti,
			Issuer:    "xeni-gateway",
		},
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessStr, err := accessToken.SignedString(m.secret)
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// Refresh token (random UUID-based, stored as SHA-256 hash in DB)
	refreshRaw := uuid.New().String()

	return &TokenPair{
		AccessToken:  accessStr,
		RefreshToken: refreshRaw,
		ExpiresAt:    now.Add(m.accessExpiry).Unix(),
		JTI:          jti,
	}, nil
}

// ValidateAccessToken validates an access token and returns its claims.
func (m *Manager) ValidateAccessToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return m.secret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	return claims, nil
}

// HashToken returns the SHA-256 hash of a token string.
func HashToken(token string) string {
	h := sha256.New()
	h.Write([]byte(token))
	return hex.EncodeToString(h.Sum(nil))
}

// GetRefreshExpiry returns the refresh token expiry duration.
func (m *Manager) GetRefreshExpiry() time.Duration {
	return m.refreshExpiry
}

// GetAccessExpiry returns the access token expiry duration.
func (m *Manager) GetAccessExpiry() time.Duration {
	return m.accessExpiry
}
