package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/xeni-ai/gateway/internal/config"
)

// Service handles sending transactional emails via the Resend API.
type Service struct {
	apiKey    string
	fromEmail string
	client    *http.Client
}

// NewService creates a new email service.
func NewService(cfg *config.EmailConfig) *Service {
	return &Service{
		apiKey:    cfg.ResendAPIKey,
		fromEmail: cfg.FromEmail,
		client:    &http.Client{Timeout: 10 * time.Second},
	}
}

type resendRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

// Send sends an email via the Resend API.
func (s *Service) Send(to, subject, htmlBody string) error {
	if s.apiKey == "" {
		slog.Warn("email not sent (RESEND_API_KEY not configured)", "to", to, "subject", subject)
		return nil // Fail open in development
	}

	payload := resendRequest{
		From:    s.fromEmail,
		To:      []string{to},
		Subject: subject,
		HTML:    htmlBody,
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("Resend API error: status %d", resp.StatusCode)
	}

	slog.Info("email sent", "to", to, "subject", subject)
	return nil
}

// ── Email Templates ──

// SendOTPEmail sends a verification or 2FA OTP email.
func (s *Service) SendOTPEmail(to, otp, purpose string) error {
	subject := "XENI — Your Verification Code"
	if purpose == "password_reset" {
		subject = "XENI — Password Reset Code"
	}

	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<body style="font-family: 'Inter', Arial, sans-serif; background-color: #0F0F23; color: #E2E8F0; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <span style="font-size: 24px; font-weight: 800; background: linear-gradient(to right, #7C3AED, #06B6D4); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">XENI</span>
    </div>
    <h2 style="text-align: center; color: white; font-size: 20px; margin-bottom: 8px;">Your Verification Code</h2>
    <p style="text-align: center; color: #94A3B8; font-size: 14px; margin-bottom: 24px;">Use this code to verify your identity. It expires in 10 minutes.</p>
    <div style="text-align: center; background: rgba(124,58,237,0.1); border: 1px solid rgba(124,58,237,0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #7C3AED; font-family: 'JetBrains Mono', monospace;">%s</span>
    </div>
    <p style="text-align: center; color: #64748B; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
  </div>
</body>
</html>`, otp)

	return s.Send(to, subject, html)
}

// SendWelcomeEmail sends a welcome email after registration.
func (s *Service) SendWelcomeEmail(to, name string) error {
	subject := "Welcome to XENI — Your AI Business OS"
	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<body style="font-family: 'Inter', Arial, sans-serif; background-color: #0F0F23; color: #E2E8F0; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <span style="font-size: 24px; font-weight: 800; background: linear-gradient(to right, #7C3AED, #06B6D4); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">XENI</span>
    </div>
    <h2 style="text-align: center; color: white; font-size: 20px; margin-bottom: 16px;">Welcome, %s! 🚀</h2>
    <p style="text-align: center; color: #94A3B8; font-size: 14px; margin-bottom: 24px;">Your AI-powered business operating system is ready. Start with your free SEO Audit agent now.</p>
    <div style="text-align: center;">
      <a href="https://xeni.ai/dashboard" style="display: inline-block; background: linear-gradient(to right, #7C3AED, #6D28D9); color: white; font-weight: 600; padding: 12px 32px; border-radius: 12px; text-decoration: none;">Go to Dashboard</a>
    </div>
  </div>
</body>
</html>`, name)

	return s.Send(to, subject, html)
}

// SendSubscriptionEmail sends a subscription confirmation email.
func (s *Service) SendSubscriptionEmail(to, plan string) error {
	subject := fmt.Sprintf("XENI — %s Plan Activated!", plan)
	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<body style="font-family: 'Inter', Arial, sans-serif; background-color: #0F0F23; color: #E2E8F0; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px;">
    <div style="text-align: center; margin-bottom: 32px;">
      <span style="font-size: 24px; font-weight: 800; background: linear-gradient(to right, #7C3AED, #06B6D4); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">XENI</span>
    </div>
    <h2 style="text-align: center; color: white; font-size: 20px; margin-bottom: 16px;">%s Plan Activated! ✨</h2>
    <p style="text-align: center; color: #94A3B8; font-size: 14px; margin-bottom: 24px;">Your subscription has been upgraded. Enjoy all your new AI agents!</p>
    <div style="text-align: center;">
      <a href="https://xeni.ai/dashboard" style="display: inline-block; background: linear-gradient(to right, #7C3AED, #6D28D9); color: white; font-weight: 600; padding: 12px 32px; border-radius: 12px; text-decoration: none;">Explore Agents</a>
    </div>
  </div>
</body>
</html>`, plan)

	return s.Send(to, subject, html)
}
