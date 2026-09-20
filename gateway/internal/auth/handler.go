package auth

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/big"
	"net/mail"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/pquerna/otp/totp"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"gorm.io/gorm"

	"github.com/xeni-ai/gateway/internal/cache"
	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/pkg/email"
	jwtPkg "github.com/xeni-ai/gateway/pkg/jwt"
	"github.com/xeni-ai/gateway/pkg/response"
)

// Handler holds auth dependencies.
type Handler struct {
	DB          *gorm.DB
	Redis       *cache.Client
	JWT         *jwtPkg.Manager
	FrontendURL string
	Email       email.Service
	GoogleOAuth *oauth2.Config
}

// NewHandler creates a new auth handler.
func NewHandler(db *gorm.DB, redis *cache.Client, jwt *jwtPkg.Manager, frontendURL string, emailSvc email.Service, googleOAuth *oauth2.Config) *Handler {
	return &Handler{DB: db, Redis: redis, JWT: jwt, FrontendURL: frontendURL, Email: emailSvc, GoogleOAuth: googleOAuth}
}

// ── Request DTOs ──

type RegisterRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
	FullName string `json:"full_name" validate:"required,min=2,max=255"`
	Language string `json:"language" validate:"omitempty,oneof=en bn"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
	TOTPCode string `json:"totp_code" validate:"omitempty,len=6"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type VerifyEmailRequest struct {
	Email string `json:"email" validate:"required,email"`
	Code  string `json:"code" validate:"required,len=6"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" validate:"required,email"`
}

type ResetPasswordRequest struct {
	Email       string `json:"email" validate:"required,email"`
	Code        string `json:"code" validate:"required,len=6"`
	NewPassword string `json:"new_password" validate:"required,min=8"`
}

type Enable2FARequest struct{}

type Verify2FARequest struct {
	Code string `json:"code" validate:"required,len=6"`
}

// ── Handlers ──

// Register creates a new user account.
func (h *Handler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Server-side validation
	if req.Email == "" {
		return response.BadRequest(c, "Email is required")
	}

	// Validate email format
	_, err := mail.ParseAddress(req.Email)
	if err != nil {
		return response.BadRequest(c, "Invalid email format")
	}

	// Normalize email: trim whitespace and convert to lowercase
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if req.Password == "" {
		return response.BadRequest(c, "Password is required")
	}
	if req.FullName == "" {
		return response.BadRequest(c, "Full name is required")
	}
	if len(req.Password) < 8 {
		return response.BadRequest(c, "Password must be at least 8 characters")
	}
	if len(req.Password) > 128 {
		return response.BadRequest(c, "Password is too long (maximum 128 characters)")
	}

	// Validate full name length
	if len(req.FullName) < 2 {
		return response.BadRequest(c, "Full name must be at least 2 characters")
	}
	if len(req.FullName) > 255 {
		return response.BadRequest(c, "Full name is too long (maximum 255 characters)")
	}

	// Check if email exists
	var existing models.User
	if err := h.DB.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		return response.BadRequest(c, "Email already registered")
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return response.InternalError(c)
	}

	hashStr := string(hash)
	lang := req.Language
	if lang == "" {
		lang = "en"
	}

	user := models.User{
		Email:             req.Email,
		PasswordHash:      &hashStr,
		FullName:          req.FullName,
		AuthProvider:      models.AuthEmail,
		Status:            models.StatusPending,
		PreferredLanguage: lang,
	}

	if err := h.DB.Create(&user).Error; err != nil {
		slog.Error("failed to create user", "error", err)
		return response.InternalError(c)
	}

	// Generate and store OTP for email verification
	otp := generateOTP()
	otpHash, _ := bcrypt.GenerateFromPassword([]byte(otp), 10)
	otpCode := models.OTPCode{
		UserID:    user.ID,
		CodeHash:  string(otpHash),
		Purpose:   models.OTPEmailVerify,
		ExpiresAt: time.Now().Add(10 * time.Minute),
	}
	h.DB.Create(&otpCode)

	// Send verification email via Resend API
	go func() {
		if err := h.Email.SendOTPVerification(user.Email, otp); err != nil {
			slog.Error("Failed to send verification email",
				"user_id", user.ID.String(),
				"email", user.Email,
				"error", err)
		}
	}()

	// Create starter subscription by default
	var starterPlan models.Plan
	if err := h.DB.Where("tier = ?", models.TierStarter).First(&starterPlan).Error; err == nil {
		sub := models.Subscription{
			UserID:             user.ID,
			PlanID:             starterPlan.ID,
			Status:             models.SubActive,
			BillingCycle:       "monthly",
			CurrentPeriodStart: time.Now(),
			CurrentPeriodEnd:   time.Now().AddDate(100, 0, 0), // Starter plan trial never expires
		}
		h.DB.Create(&sub)
	}

	return response.Created(c, map[string]interface{}{
		"user_id": user.ID,
		"email":   user.Email,
		"message": "Registration successful. Please verify your email.",
	})
}

// Login authenticates a user and returns tokens.
func (h *Handler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		return response.Unauthorized(c, "Invalid email or password")
	}

	if user.Status == models.StatusSuspended {
		return response.Forbidden(c, "Account has been suspended")
	}

	if user.Status == models.StatusPending || !user.IsEmailVerified {
		return response.Forbidden(c, "Please verify your email before logging in. Check your server logs for the OTP code.")
	}

	if user.PasswordHash == nil {
		return response.BadRequest(c, "This account uses Google OAuth. Please sign in with Google.")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.Password)); err != nil {
		return response.Unauthorized(c, "Invalid email or password")
	}

	// Check 2FA if enabled
	if user.TwoFAEnabled && user.TwoFASecret != nil {
		if req.TOTPCode == "" {
			return response.BadRequest(c, "2FA code is required")
		}
		if !totp.Validate(req.TOTPCode, *user.TwoFASecret) {
			return response.Unauthorized(c, "Invalid 2FA code")
		}
	}

	// Generate tokens
	tokenPair, err := h.JWT.GenerateTokenPair(user.ID.String(), user.Email, string(user.Role))
	if err != nil {
		return response.InternalError(c)
	}

	// Store refresh token hash in DB
	tokenHash := jwtPkg.HashToken(tokenPair.RefreshToken)
	ip := c.IP()
	deviceInfo := c.Get("User-Agent")
	rt := models.RefreshToken{
		UserID:     user.ID,
		TokenHash:  tokenHash,
		DeviceInfo: &deviceInfo,
		IPAddress:  &ip,
		ExpiresAt:  time.Now().Add(h.JWT.GetRefreshExpiry()),
	}
	h.DB.Create(&rt)

	// Update last login
	now := time.Now()
	h.DB.Model(&user).Update("last_login_at", &now)

	return response.Success(c, map[string]interface{}{
		"access_token":  tokenPair.AccessToken,
		"refresh_token": tokenPair.RefreshToken,
		"expires_at":    tokenPair.ExpiresAt,
		"user": map[string]interface{}{
			"id":        user.ID,
			"email":     user.Email,
			"full_name": user.FullName,
			"role":      user.Role,
		},
	})
}

// RefreshToken rotates the refresh token.
func (h *Handler) RefreshToken(c *fiber.Ctx) error {
	var req RefreshRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	tokenHash := jwtPkg.HashToken(req.RefreshToken)

	var rt models.RefreshToken
	if err := h.DB.Where("token_hash = ? AND revoked = false AND expires_at > ?", tokenHash, time.Now()).First(&rt).Error; err != nil {
		return response.Unauthorized(c, "Invalid or expired refresh token")
	}

	// Revoke old token
	h.DB.Model(&rt).Update("revoked", true)

	// Get user
	var user models.User
	if err := h.DB.First(&user, rt.UserID).Error; err != nil {
		return response.InternalError(c)
	}

	// Generate new token pair
	tokenPair, err := h.JWT.GenerateTokenPair(user.ID.String(), user.Email, string(user.Role))
	if err != nil {
		return response.InternalError(c)
	}

	// Store new refresh token
	newHash := jwtPkg.HashToken(tokenPair.RefreshToken)
	ip := c.IP()
	deviceInfo := c.Get("User-Agent")
	newRT := models.RefreshToken{
		UserID:     user.ID,
		TokenHash:  newHash,
		DeviceInfo: &deviceInfo,
		IPAddress:  &ip,
		ExpiresAt:  time.Now().Add(h.JWT.GetRefreshExpiry()),
	}
	h.DB.Create(&newRT)

	return response.Success(c, map[string]interface{}{
		"access_token":  tokenPair.AccessToken,
		"refresh_token": tokenPair.RefreshToken,
		"expires_at":    tokenPair.ExpiresAt,
	})
}

// Logout revokes the current access token.
func (h *Handler) Logout(c *fiber.Ctx) error {
	jti := c.Locals("jti").(string)
	tokenExp := c.Locals("token_exp").(time.Time)

	ttl := time.Until(tokenExp)
	if ttl > 0 {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		h.Redis.BlockJWT(ctx, jti, ttl)
	}

	return response.Success(c, map[string]string{"message": "Logged out successfully"})
}

// VerifyEmail verifies the email with OTP.
func (h *Handler) VerifyEmail(c *fiber.Ctx) error {
	var req VerifyEmailRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		return response.NotFound(c, "User not found")
	}

	// Find valid OTP
	var otpCode models.OTPCode
	if err := h.DB.Where("user_id = ? AND purpose = ? AND used = false AND expires_at > ?",
		user.ID, models.OTPEmailVerify, time.Now()).
		Order("created_at DESC").First(&otpCode).Error; err != nil {
		return response.BadRequest(c, "No valid OTP found. Request a new one.")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(otpCode.CodeHash), []byte(req.Code)); err != nil {
		return response.BadRequest(c, "Invalid OTP code")
	}

	// Mark OTP as used and verify email
	h.DB.Model(&otpCode).Update("used", true)
	h.DB.Model(&user).Updates(map[string]interface{}{
		"is_email_verified": true,
		"status":            models.StatusActive,
	})

	return response.Success(c, map[string]string{"message": "Email verified successfully"})
}

// ResendOTP resends the verification OTP.
func (h *Handler) ResendOTP(c *fiber.Ctx) error {
	var req struct {
		Email string `json:"email" validate:"required,email"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		// Don't reveal if email exists
		return response.Success(c, map[string]string{"message": "If the email exists, a new OTP has been sent."})
	}

	otp := generateOTP()
	otpHash, _ := bcrypt.GenerateFromPassword([]byte(otp), 10)
	otpCode := models.OTPCode{
		UserID:    user.ID,
		CodeHash:  string(otpHash),
		Purpose:   models.OTPEmailVerify,
		ExpiresAt: time.Now().Add(10 * time.Minute),
	}
	h.DB.Create(&otpCode)

	// Send via Resend API
	go func() {
		if err := h.Email.SendOTPVerification(user.Email, otp); err != nil {
			slog.Error("Failed to resend OTP email",
				"user_id", user.ID.String(),
				"email", user.Email,
				"error", err)
		}
	}()
	slog.Info("OTP generated for resend", "user_id", user.ID.String(), "email", user.Email)

	return response.Success(c, map[string]string{"message": "If the email exists, a new OTP has been sent."})
}

// Enable2FA generates a TOTP secret and QR code.
func (h *Handler) Enable2FA(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var user models.User
	if err := h.DB.First(&user, uid).Error; err != nil {
		return response.NotFound(c, "User not found")
	}

	if user.TwoFAEnabled {
		return response.BadRequest(c, "2FA is already enabled")
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "XENI",
		AccountName: user.Email,
	})
	if err != nil {
		return response.InternalError(c)
	}

	// Store secret temporarily (will be confirmed in Verify2FA)
	secret := key.Secret()
	h.DB.Model(&user).Update("two_fa_secret", &secret)

	return response.Success(c, map[string]interface{}{
		"secret":  key.Secret(),
		"qr_url":  key.URL(),
		"message": "Scan the QR code with Google Authenticator, then verify with a code.",
	})
}

// Verify2FA confirms and enables 2FA.
func (h *Handler) Verify2FA(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var req Verify2FARequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	var user models.User
	if err := h.DB.First(&user, uid).Error; err != nil {
		return response.NotFound(c, "User not found")
	}

	if user.TwoFASecret == nil {
		return response.BadRequest(c, "Please enable 2FA first")
	}

	if !totp.Validate(req.Code, *user.TwoFASecret) {
		return response.BadRequest(c, "Invalid TOTP code")
	}

	h.DB.Model(&user).Update("two_fa_enabled", true)

	return response.Success(c, map[string]string{"message": "2FA has been enabled successfully"})
}

// ForgotPassword sends a password reset OTP.
func (h *Handler) ForgotPassword(c *fiber.Ctx) error {
	var req ForgotPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		// Don't reveal if email exists
		return response.Success(c, map[string]string{"message": "If the email exists, a reset code has been sent."})
	}

	otp := generateOTP()
	otpHash, _ := bcrypt.GenerateFromPassword([]byte(otp), 10)
	otpCode := models.OTPCode{
		UserID:    user.ID,
		CodeHash:  string(otpHash),
		Purpose:   models.OTPPasswordReset,
		ExpiresAt: time.Now().Add(10 * time.Minute),
	}
	h.DB.Create(&otpCode)

	// Send via Resend API
	go h.Email.SendPasswordReset(user.Email, otp)
	slog.Info("password reset OTP dispatched", "user_id", user.ID.String(), "email", user.Email)

	return response.Success(c, map[string]string{"message": "If the email exists, a reset code has been sent."})
}

// ResetPassword sets a new password using the OTP.
func (h *Handler) ResetPassword(c *fiber.Ctx) error {
	var req ResetPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		return response.NotFound(c, "User not found")
	}

	var otpCode models.OTPCode
	if err := h.DB.Where("user_id = ? AND purpose = ? AND used = false AND expires_at > ?",
		user.ID, models.OTPPasswordReset, time.Now()).
		Order("created_at DESC").First(&otpCode).Error; err != nil {
		return response.BadRequest(c, "No valid reset code found")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(otpCode.CodeHash), []byte(req.Code)); err != nil {
		return response.BadRequest(c, "Invalid reset code")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		return response.InternalError(c)
	}

	hashStr := string(hash)
	h.DB.Model(&otpCode).Update("used", true)
	h.DB.Model(&user).Update("password_hash", &hashStr)

	return response.Success(c, map[string]string{"message": "Password reset successfully"})
}

// GoogleLogin initiates Google OAuth flow.
func (h *Handler) GoogleLogin(c *fiber.Ctx) error {
	if h.GoogleOAuth == nil {
		return response.BadRequest(c, "Google OAuth is not configured")
	}

	// Generate random state for CSRF protection
	state := uuid.New().String()

	// Store state in Redis for CSRF validation
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	stateKey := "oauth:state:" + state
	h.Redis.SetJSON(ctx, stateKey, []byte("pending"), 5*time.Minute)

	// Redirect to Google OAuth
	url := h.GoogleOAuth.AuthCodeURL(state, oauth2.AccessTypeOffline)
	return c.Redirect(url)
}

// GoogleCallback handles Google OAuth callback.
func (h *Handler) GoogleCallback(c *fiber.Ctx) error {
	if h.GoogleOAuth == nil {
		return response.BadRequest(c, "Google OAuth is not configured")
	}

	// Validate state parameter to prevent CSRF
	state := c.Query("state")
	if state == "" {
		return response.BadRequest(c, "Missing state parameter")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	stateKey := "oauth:state:" + state
	storedState, err := h.Redis.GetJSON(ctx, stateKey)
	if err != nil || storedState == nil {
		return response.BadRequest(c, "Invalid or expired state parameter")
	}

	// Clear the used state
	h.Redis.Delete(ctx, stateKey)

	// Exchange authorization code for tokens
	code := c.Query("code")
	if code == "" {
		return response.BadRequest(c, "Missing authorization code")
	}

	token, err := h.GoogleOAuth.Exchange(ctx, code)
	if err != nil {
		slog.Error("Failed to exchange Google auth code", "error", err)
		return response.BadRequest(c, "Failed to authenticate with Google")
	}

	// Get user info from Google
	client := h.GoogleOAuth.Client(ctx, token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		slog.Error("Failed to get Google user info", "error", err)
		return response.BadRequest(c, "Failed to retrieve user information")
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		slog.Error("Google user info request failed", "status", resp.StatusCode)
		return response.BadRequest(c, "Failed to retrieve user information")
	}

	var googleUser struct {
		ID            string `json:"id"`
		Email         string `json:"email"`
		VerifiedEmail bool   `json:"verified_email"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&googleUser); err != nil {
		slog.Error("Failed to decode Google user info", "error", err)
		return response.InternalError(c)
	}

	// Ensure email is verified by Google
	if !googleUser.VerifiedEmail {
		return response.BadRequest(c, "Email must be verified by Google")
	}

	// Find or create user
	var user models.User
	err = h.DB.Where("google_id = ?", googleUser.ID).First(&user).Error

	if err == gorm.ErrRecordNotFound {
		// Check if email already exists with different auth provider
		var existingUser models.User
		if err := h.DB.Where("email = ?", googleUser.Email).First(&existingUser).Error; err == nil {
			// Email exists but not with Google - create safe linking opportunity
			return response.BadRequest(c, "Email already registered. Please log in with your existing account and link Google in settings.")
		}

		// Create new user
		user = models.User{
			Email:           googleUser.Email,
			FullName:        googleUser.Name,
			AuthProvider:    models.AuthGoogle,
			GoogleID:        &googleUser.ID,
			AvatarURL:       &googleUser.Picture,
			Status:          models.StatusActive,
			IsEmailVerified: true,
		}
		if err := h.DB.Create(&user).Error; err != nil {
			slog.Error("Failed to create Google user", "error", err)
			return response.InternalError(c)
		}

		// Create starter subscription
		var starterPlan models.Plan
		if err := h.DB.Where("tier = ?", models.TierStarter).First(&starterPlan).Error; err == nil {
			sub := models.Subscription{
				UserID:             user.ID,
				PlanID:             starterPlan.ID,
				Status:             models.SubActive,
				BillingCycle:       "monthly",
				CurrentPeriodStart: time.Now(),
				CurrentPeriodEnd:   time.Now().AddDate(100, 0, 0),
			}
			h.DB.Create(&sub)
		}
	} else if err != nil {
		slog.Error("Database error during Google auth", "error", err)
		return response.InternalError(c)
	}

	// Generate tokens
	tokenPair, err := h.JWT.GenerateTokenPair(user.ID.String(), user.Email, string(user.Role))
	if err != nil {
		return response.InternalError(c)
	}

	tokenHash := jwtPkg.HashToken(tokenPair.RefreshToken)
	ip := c.IP()
	rt := models.RefreshToken{
		UserID:    user.ID,
		TokenHash: tokenHash,
		IPAddress: &ip,
		ExpiresAt: time.Now().Add(h.JWT.GetRefreshExpiry()),
	}
	h.DB.Create(&rt)

	slog.Info("Google authentication successful", "user_id", user.ID.String(), "email", user.Email)

	// Generate secure one-time handoff code
	handoffCode := uuid.New().String()
	handoffKey := "auth:handoff:" + handoffCode

	// Store tokens in Redis with short expiration (5 minutes)
	handoffData := map[string]interface{}{
		"access_token":  tokenPair.AccessToken,
		"refresh_token": tokenPair.RefreshToken,
		"expires_at":    tokenPair.ExpiresAt,
		"user_id":       user.ID.String(),
		"email":         user.Email,
	}
	handoffJSON, _ := json.Marshal(handoffData)

	ctx2, cancel2 := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel2()
	h.Redis.SetJSON(ctx2, handoffKey, handoffJSON, 5*time.Minute)

	// Redirect to frontend with only the handoff code (not tokens)
	redirectURL := fmt.Sprintf("%s#/auth/callback?code=%s", h.FrontendURL, handoffCode)
	return c.Redirect(redirectURL)
}

// ExchangeHandoffCode exchanges a one-time handoff code for JWT tokens
func (h *Handler) ExchangeHandoffCode(c *fiber.Ctx) error {
	var req struct {
		Code string `json:"code" validate:"required"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Retrieve handoff data from Redis
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	handoffKey := "auth:handoff:" + req.Code
	handoffData, err := h.Redis.GetJSON(ctx, handoffKey)
	if err != nil || handoffData == nil {
		return response.BadRequest(c, "Invalid or expired handoff code")
	}

	// Delete the handoff code (one-time use)
	h.Redis.Delete(ctx, handoffKey)

	// Parse the stored data
	var data struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresAt    int64  `json:"expires_at"`
		UserID       string `json:"user_id"`
		Email        string `json:"email"`
	}
	if err := json.Unmarshal(handoffData, &data); err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, map[string]interface{}{
		"access_token":  data.AccessToken,
		"refresh_token": data.RefreshToken,
		"expires_at":    data.ExpiresAt,
		"user": map[string]interface{}{
			"id":    data.UserID,
			"email": data.Email,
		},
	})
}

// FacebookCallback handles Facebook OAuth callback.
func (h *Handler) FacebookCallback(c *fiber.Ctx) error {
	var req struct {
		FacebookID string `json:"facebook_id" validate:"required"`
		Email      string `json:"email" validate:"required,email"`
		Name       string `json:"name" validate:"required"`
		Avatar     string `json:"avatar"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	var user models.User
	err := h.DB.Where("facebook_id = ? OR email = ?", req.FacebookID, req.Email).First(&user).Error

	if err == gorm.ErrRecordNotFound {
		user = models.User{
			Email:           req.Email,
			FullName:        req.Name,
			AuthProvider:    models.AuthFacebook,
			FacebookID:      &req.FacebookID,
			AvatarURL:       &req.Avatar,
			Status:          models.StatusActive,
			IsEmailVerified: true,
		}
		if err := h.DB.Create(&user).Error; err != nil {
			return response.InternalError(c)
		}

		var starterPlan models.Plan
		if err := h.DB.Where("tier = ?", models.TierStarter).First(&starterPlan).Error; err == nil {
			sub := models.Subscription{
				UserID:             user.ID,
				PlanID:             starterPlan.ID,
				Status:             models.SubActive,
				BillingCycle:       "monthly",
				CurrentPeriodStart: time.Now(),
				CurrentPeriodEnd:   time.Now().AddDate(100, 0, 0),
			}
			h.DB.Create(&sub)
		}
	} else if err != nil {
		return response.InternalError(c)
	}

	tokenPair, err := h.JWT.GenerateTokenPair(user.ID.String(), user.Email, string(user.Role))
	if err != nil {
		return response.InternalError(c)
	}

	tokenHash := jwtPkg.HashToken(tokenPair.RefreshToken)
	ip := c.IP()
	rt := models.RefreshToken{
		UserID:    user.ID,
		TokenHash: tokenHash,
		IPAddress: &ip,
		ExpiresAt: time.Now().Add(h.JWT.GetRefreshExpiry()),
	}
	h.DB.Create(&rt)

	return response.Success(c, map[string]interface{}{
		"access_token":  tokenPair.AccessToken,
		"refresh_token": tokenPair.RefreshToken,
		"expires_at":    tokenPair.ExpiresAt,
		"user": map[string]interface{}{
			"id":        user.ID,
			"email":     user.Email,
			"full_name": user.FullName,
			"role":      user.Role,
		},
	})
}

// ── Helpers ──

func generateOTP() string {
	// Generate cryptographically secure 6-digit OTP
	max := new(big.Int)
	max.SetInt64(1000000) // 6 digits (000000-999999)

	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		// Fallback to time-based if crypto fails (should not happen)
		slog.Error("crypto/rand failed, falling back to time-based OTP", "error", err)
		return fmt.Sprintf("%06d", time.Now().UnixNano()%1000000)
	}

	// Pad with leading zeros to ensure 6 digits
	return fmt.Sprintf("%06d", n.Int64())
}

// SubscriptionInfo is cached subscription data.
type SubscriptionInfo struct {
	PlanTier       string   `json:"plan_tier"`
	Agents         []string `json:"agents"`
	MaxTasksPerDay int      `json:"max_tasks_per_day"`
	StorageMB      int      `json:"storage_mb"`
}

// GetUserSubscription retrieves subscription info with Redis caching.
func GetUserSubscription(db *gorm.DB, redisClient *cache.Client, userID string) (*SubscriptionInfo, error) {
	ctx := context.Background()

	// Check cache first
	cached, err := redisClient.GetSubscription(ctx, userID)
	if err == nil && cached != nil {
		var info SubscriptionInfo
		if err := json.Unmarshal(cached, &info); err == nil {
			return &info, nil
		}
	}

	// Fetch user to check role
	uid, _ := uuid.Parse(userID)
	var user models.User
	if err := db.Select("role").First(&user, uid).Error; err == nil {
		if user.Role == models.RoleSuperAdmin {
			info := &SubscriptionInfo{
				PlanTier:       "super_admin",
				Agents:         []string{"conversation", "order", "inventory", "creative", "intelligence"},
				MaxTasksPerDay: 0,      // unlimited
				StorageMB:      102400, // 100GB
			}
			data, _ := json.Marshal(info)
			redisClient.SetSubscription(ctx, userID, data)
			return info, nil
		}
	}

	// Cache miss — query DB
	var sub models.Subscription
	if err := db.Preload("Plan").Where("user_id = ? AND status = ?", uid, models.SubActive).First(&sub).Error; err != nil {
		// No active subscription — default to starter
		return &SubscriptionInfo{
			PlanTier:       string(models.TierStarter),
			Agents:         []string{"conversation"},
			MaxTasksPerDay: 10,
			StorageMB:      2048,
		}, nil
	}

	// Parse features from plan
	var features struct {
		Agents         []string `json:"agents"`
		MaxTasksPerDay int      `json:"max_tasks_per_day"`
		StorageMB      int      `json:"storage_mb"`
	}
	json.Unmarshal([]byte(sub.Plan.Features), &features)

	info := &SubscriptionInfo{
		PlanTier:       string(sub.Plan.Tier),
		Agents:         features.Agents,
		MaxTasksPerDay: features.MaxTasksPerDay,
		StorageMB:      features.StorageMB,
	}

	// Cache for 5 minutes
	data, _ := json.Marshal(info)
	redisClient.SetSubscription(ctx, userID, data)

	return info, nil
}
