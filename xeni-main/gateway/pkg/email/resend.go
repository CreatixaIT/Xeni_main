package email

import (
	"fmt"
	"log/slog"

	"github.com/resend/resend-go/v2"
)

// Service defines the email operations
type Service interface {
	SendOTPVerification(to string, otp string) error
	SendPasswordReset(to string, otp string) error
}

// ResendService implements Service using the Resend API
type ResendService struct {
	client    *resend.Client
	fromEmail string
}

func NewResendService(apiKey string, fromEmail string) *ResendService {
	client := resend.NewClient(apiKey)
	return &ResendService{
		client:    client,
		fromEmail: fromEmail,
	}
}

func (s *ResendService) SendOTPVerification(to string, otp string) error {
	params := &resend.SendEmailRequest{
		From:    s.fromEmail,
		To:      []string{to},
		Subject: "Verify your email for XENI",
		Html: fmt.Sprintf(`
			<!DOCTYPE html>
			<html>
			<head>
			<style>
				body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0B0F19; color: #E2E8F0; }
				.container { max-width: 600px; margin: 40px auto; background-color: #111827; border-radius: 20px; border: 1px solid #1F2937; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
				.header { background: linear-gradient(135deg, #7C3AED 0%%, #4F46E5 100%%); padding: 40px 20px; text-align: center; }
				.logo { width: 80px; height: 80px; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); margin-bottom: 20px; }
				.title { margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; text-shadow: 0 2px 10px rgba(0,0,0,0.2); }
				.content { padding: 40px 30px; }
				.greeting { font-size: 20px; font-weight: 600; color: #F8FAFC; margin-top: 0; margin-bottom: 15px; }
				.text { font-size: 16px; line-height: 1.6; color: #94A3B8; margin-bottom: 30px; }
				.otp-container { background: rgba(124, 58, 237, 0.1); border: 1px solid rgba(124, 58, 237, 0.2); border-radius: 16px; padding: 25px; text-align: center; margin-bottom: 30px; }
				.otp-code { margin: 0; font-size: 42px; font-weight: 800; letter-spacing: 12px; font-family: monospace; text-transform: uppercase; background: linear-gradient(to right, #A78BFA, #818CF8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
				.expiry { font-size: 13px; color: #64748B; text-align: center; margin-top: 10px; }
				.footer { border-top: 1px solid #1F2937; padding: 25px; text-align: center; background-color: #0B0F19; }
				.footer-text { font-size: 13px; color: #475569; margin: 0; }
				.brand { color: #818CF8; font-weight: 600; text-decoration: none; }
			</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<img src="https://ui-avatars.com/api/?name=XENI&background=FFFFFF&color=7C3AED&font-size=0.35&bold=true&rounded=true" alt="XENI Logo" class="logo" />
						<h1 class="title">Secure Verification</h1>
					</div>
					<div class="content">
						<h2 class="greeting">Welcome to XENI OS!</h2>
						<p class="text">You are one step away from unlocking the ultimate AI business platform. Please use the highly secure verification code below to activate your account. Do not share this code.</p>
						
						<div class="otp-container">
							<h1 class="otp-code">%s</h1>
							<p class="expiry">This exclusive code expires exactly in 10 minutes.</p>
						</div>
						
						<p class="text">If you did not initiate this request, you may safely ignore and delete this email. Your dashboard awaits you!</p>
					</div>
					<div class="footer">
						<p class="footer-text">© 2026 <span class="brand">XENI AI</span>. All rights securely reserved.</p>
						<p class="footer-text" style="margin-top: 5px;">Built for the future of E-Commerce.</p>
					</div>
				</div>
			</body>
			</html>
		`, otp),
	}

	_, err := s.client.Emails.Send(params)
	if err != nil {
		slog.Error("Failed to send OTP email via Resend", "email", to, "error", err)
		return err
	}
	slog.Info("Successfully dispatched OTP email via Resend", "email", to)
	return nil
}

func (s *ResendService) SendPasswordReset(to string, otp string) error {
	params := &resend.SendEmailRequest{
		From:    s.fromEmail,
		To:      []string{to},
		Subject: "Reset Password - XENI",
		Html: fmt.Sprintf(`
			<!DOCTYPE html>
			<html>
			<head>
			<style>
				body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0B0F19; color: #E2E8F0; }
				.container { max-width: 600px; margin: 40px auto; background-color: #111827; border-radius: 20px; border: 1px solid #1F2937; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
				.header { background: linear-gradient(135deg, #EF4444 0%%, #B91C1C 100%%); padding: 40px 20px; text-align: center; }
				.logo { width: 80px; height: 80px; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); margin-bottom: 20px; }
				.title { margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; text-shadow: 0 2px 10px rgba(0,0,0,0.2); }
				.content { padding: 40px 30px; }
				.greeting { font-size: 20px; font-weight: 600; color: #F8FAFC; margin-top: 0; margin-bottom: 15px; }
				.text { font-size: 16px; line-height: 1.6; color: #94A3B8; margin-bottom: 30px; }
				.otp-container { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 16px; padding: 25px; text-align: center; margin-bottom: 30px; }
				.otp-code { margin: 0; font-size: 42px; font-weight: 800; letter-spacing: 12px; font-family: monospace; text-transform: uppercase; background: linear-gradient(to right, #FCA5A5, #F87171); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
				.expiry { font-size: 13px; color: #64748B; text-align: center; margin-top: 10px; }
				.footer { border-top: 1px solid #1F2937; padding: 25px; text-align: center; background-color: #0B0F19; }
				.footer-text { font-size: 13px; color: #475569; margin: 0; }
				.brand { color: #818CF8; font-weight: 600; text-decoration: none; }
			</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<img src="https://ui-avatars.com/api/?name=XENI&background=FFFFFF&color=EF4444&font-size=0.35&bold=true&rounded=true" alt="XENI Logo" class="logo" />
						<h1 class="title">Password Reset</h1>
					</div>
					<div class="content">
						<h2 class="greeting">Identity Verification Required</h2>
						<p class="text">We received a highly secure request to reset the password associated with this XENI portal account. Please verify ownership using the authorized code below:</p>
						
						<div class="otp-container">
							<h1 class="otp-code">%s</h1>
							<p class="expiry">This encrypted code dissolves in exactly 10 minutes.</p>
						</div>
						
						<p class="text">If you did not authorize this password reset request, please secure your account immediately or ignore this automated message.</p>
					</div>
					<div class="footer">
						<p class="footer-text">© 2026 <span class="brand">XENI AI</span>. Secure Portal Transmission.</p>
						<p class="footer-text" style="margin-top: 5px;">Built for the future of E-Commerce.</p>
					</div>
				</div>
			</body>
			</html>
		`, otp),
	}

	_, err := s.client.Emails.Send(params)
	if err != nil {
		slog.Error("Failed to send Password Reset email", "email", to, "error", err)
		return err
	}
	slog.Info("Successfully dispatched Password Reset email", "email", to)
	return nil
}
