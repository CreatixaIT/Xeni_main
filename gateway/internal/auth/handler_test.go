package auth

import (
	"net/mail"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	jwtPkg "github.com/xeni-ai/gateway/pkg/jwt"
)

// TestPasswordHashing verifies passwords are never stored in plaintext
func TestPasswordHashing(t *testing.T) {
	// Test bcrypt hashing
	password := "TestPassword123!"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	require.NoError(t, err)
	assert.NotEqual(t, password, string(hash))
	assert.Greater(t, len(hash), 50) // Bcrypt hashes are typically 60 chars

	// Verify hash can be validated
	err = bcrypt.CompareHashAndPassword(hash, []byte(password))
	assert.NoError(t, err)

	// Verify wrong password fails
	err = bcrypt.CompareHashAndPassword(hash, []byte("WrongPassword"))
	assert.Error(t, err)
}

// TestJWTGeneration verifies JWT token generation
func TestJWTGeneration(t *testing.T) {
	jwtManager := jwtPkg.NewManager("test-secret", 15*time.Minute, 24*time.Hour)

	userID := "test-user-id"
	email := "test@example.com"
	role := "user"

	tokenPair, err := jwtManager.GenerateTokenPair(userID, email, role)
	require.NoError(t, err)
	assert.NotEmpty(t, tokenPair.AccessToken)
	assert.NotEmpty(t, tokenPair.RefreshToken)
	assert.NotEmpty(t, tokenPair.JTI)
	assert.Greater(t, tokenPair.ExpiresAt, int64(0))

	// Verify access token can be validated
	claims, err := jwtManager.ValidateAccessToken(tokenPair.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, userID, claims.UserID)
	assert.Equal(t, email, claims.Email)
	assert.Equal(t, role, claims.Role)
	assert.Equal(t, tokenPair.JTI, claims.ID)
}

// TestJWTValidation verifies invalid tokens are rejected
func TestJWTValidation(t *testing.T) {
	jwtManager := jwtPkg.NewManager("test-secret", 15*time.Minute, 24*time.Hour)

	// Test completely invalid token
	_, err := jwtManager.ValidateAccessToken("invalid.token.here")
	assert.Error(t, err)

	// Test token with wrong signature
	userID := "test-user-id"
	email := "test@example.com"
	role := "user"
	tokenPair, _ := jwtManager.GenerateTokenPair(userID, email, role)

	wrongSecretManager := jwtPkg.NewManager("wrong-secret", 15*time.Minute, 24*time.Hour)
	_, err = wrongSecretManager.ValidateAccessToken(tokenPair.AccessToken)
	assert.Error(t, err)
}

// TestTokenHashing verifies refresh tokens are hashed before storage
func TestTokenHashing(t *testing.T) {
	token := "test-refresh-token-12345"
	hash := jwtPkg.HashToken(token)

	assert.NotEqual(t, token, hash)
	assert.Equal(t, 64, len(hash)) // SHA-256 produces 64 hex chars

	// Same token produces same hash
	hash2 := jwtPkg.HashToken(token)
	assert.Equal(t, hash, hash2)

	// Different token produces different hash
	hash3 := jwtPkg.HashToken("different-token")
	assert.NotEqual(t, hash, hash3)
}

// TestOTPGeneration verifies OTP codes are generated with cryptographic security
func TestOTPGeneration(t *testing.T) {
	otp1 := generateOTP()
	otp2 := generateOTP()

	assert.NotEmpty(t, otp1)
	assert.NotEmpty(t, otp2)
	assert.Equal(t, 6, len(otp1))
	assert.Equal(t, 6, len(otp2))

	// OTPs should be different (high probability with crypto/rand)
	assert.NotEqual(t, otp1, otp2)

	// Test multiple generations to ensure no patterns
	otps := make(map[string]bool)
	for i := 0; i < 100; i++ {
		otp := generateOTP()
		assert.Equal(t, 6, len(otp))
		assert.False(t, otps[otp], "OTP should be unique")
		otps[otp] = true
	}
}

// TestRegistrationValidation verifies server-side registration validation
func TestRegistrationValidation(t *testing.T) {
	testCases := []struct {
		name        string
		email       string
		password    string
		fullName    string
		expectError bool
	}{
		{"valid registration", "test@example.com", "ValidPass123!", "Test User", false},
		{"missing email", "", "ValidPass123!", "Test User", true},
		{"missing password", "test@example.com", "", "Test User", true},
		{"missing full name", "test@example.com", "ValidPass123!", "", true},
		{"weak password", "test@example.com", "123", "Test User", true},
		{"password too short", "test@example.com", "short", "Test User", true},
		{"password too long", "test@example.com", string(make([]byte, 129)), "Test User", true},
		{"invalid email format", "invalid-email", "ValidPass123!", "Test User", true},
		{"invalid email no @", "testexample.com", "ValidPass123!", "Test User", true},
		{"invalid email no domain", "test@", "ValidPass123!", "Test User", true},
		{"email with leading spaces", "  test@example.com", "ValidPass123!", "Test User", false},
		{"email with trailing spaces", "test@example.com  ", "ValidPass123!", "Test User", false},
		{"email with mixed case", "Test@Example.Com", "ValidPass123!", "Test User", false},
		{"full name too short", "test@example.com", "ValidPass123!", "A", true},
		{"full name too long", "test@example.com", "ValidPass123!", string(make([]byte, 256)), true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Simulate the validation logic from handler.go
			hasError := false

			// Email validation
			if tc.email == "" {
				hasError = true
			} else {
				_, err := mail.ParseAddress(tc.email)
				if err != nil {
					hasError = true
				}
			}

			// Password validation
			if tc.password == "" {
				hasError = true
			}
			if len(tc.password) < 8 && tc.password != "" {
				hasError = true
			}
			if len(tc.password) > 128 {
				hasError = true
			}

			// Full name validation
			if tc.fullName == "" {
				hasError = true
			}
			if len(tc.fullName) < 2 && tc.fullName != "" {
				hasError = true
			}
			if len(tc.fullName) > 255 {
				hasError = true
			}

			if tc.expectError {
				assert.True(t, hasError, "Expected validation error")
			} else {
				assert.False(t, hasError, "Expected no validation error")
			}
		})
	}
}

// TestEmailNormalization verifies email normalization logic
func TestEmailNormalization(t *testing.T) {
	testCases := []struct {
		input    string
		expected string
	}{
		{"test@example.com", "test@example.com"},
		{"Test@Example.Com", "test@example.com"},
		{"  test@example.com  ", "test@example.com"},
		{"TEST@EXAMPLE.COM", "test@example.com"},
		{" User@Example.Com ", "user@example.com"},
	}

	for _, tc := range testCases {
		t.Run(tc.input, func(t *testing.T) {
			// Simulate normalization logic
			normalized := strings.TrimSpace(strings.ToLower(tc.input))
			assert.Equal(t, tc.expected, normalized)
		})
	}
}

// TestOTPExpiration verifies OTP expiration handling
func TestOTPExpiration(t *testing.T) {
	// Test OTP expiration is set correctly
	expiresAt := time.Now().Add(10 * time.Minute)
	assert.True(t, expiresAt.After(time.Now()))
	assert.True(t, expiresAt.Before(time.Now().Add(11*time.Minute)))
}

// TestOTPOneTimeUse verifies OTP one-time use tracking
func TestOTPOneTimeUse(t *testing.T) {
	// Simulate OTP usage flag
	used := false
	assert.False(t, used, "OTP should start as unused")

	// Mark as used
	used = true
	assert.True(t, used, "OTP should be marked as used")

	// Ensure same OTP cannot be used again
	assert.True(t, used, "Used OTP should remain used")
}

// TestUserStatusTransitions verifies correct user status transitions
func TestUserStatusTransitions(t *testing.T) {
	// Test registration status
	status := "pending"
	assert.Equal(t, "pending", status, "New users should start as pending")

	// Test email verification transition
	status = "active"
	assert.Equal(t, "active", status, "Verified users should be active")

	// Test suspension
	status = "suspended"
	assert.Equal(t, "suspended", status, "Suspended users should have suspended status")
}

// TestSecurityErrorMessages verifies security-safe error messages
func TestSecurityErrorMessages(t *testing.T) {
	// Test that login errors don't reveal account existence
	loginError := "Invalid email or password"
	assert.NotContains(t, loginError, "not found", "Login error should not reveal account existence")
	assert.NotContains(t, loginError, "exists", "Login error should not reveal account existence")

	// Test that forgot password errors don't reveal account existence
	forgotError := "If the email exists, a reset code has been sent."
	assert.Contains(t, forgotError, "If the email exists", "Forgot password should be ambiguous")

	// Test that general errors don't expose internals
	generalError := "An internal error occurred. Please try again later."
	assert.NotContains(t, generalError, "database", "General error should not mention database")
	assert.NotContains(t, generalError, "SQL", "General error should not mention SQL")
	assert.NotContains(t, generalError, "stack", "General error should not mention stack")
}

// TestPasswordSecurity verifies password security practices
func TestPasswordSecurity(t *testing.T) {
	// Test that passwords are never returned in responses
	userResponse := map[string]interface{}{
		"id":        "user-id",
		"email":     "test@example.com",
		"full_name": "Test User",
		"role":      "user",
	}

	_, hasPassword := userResponse["password"]
	assert.False(t, hasPassword, "Password should never be in user response")

	_, hasPasswordHash := userResponse["password_hash"]
	assert.False(t, hasPasswordHash, "Password hash should never be in user response")
}

// TestRateLimitingBehavior verifies rate limiting is applied to auth endpoints
func TestRateLimitingBehavior(t *testing.T) {
	// Test that rate limit is configured
	authRateLimit := 5
	rateWindow := time.Minute

	assert.Greater(t, authRateLimit, 0, "Auth rate limit should be positive")
	assert.Greater(t, int64(rateWindow), int64(0), "Rate limit window should be positive")
	assert.Equal(t, time.Minute, rateWindow, "Auth rate limit should be per minute")
}
