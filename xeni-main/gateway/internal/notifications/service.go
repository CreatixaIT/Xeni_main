package notifications

import (
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/pkg/whatsapp"
)

// Service orchestrates sending critical notifications to stakeholders.
type Service struct {
	DB       *gorm.DB
	WhatsApp *whatsapp.Client
}

// NewService creates a new notification service.
func NewService(db *gorm.DB, wa *whatsapp.Client) *Service {
	return &Service{DB: db, WhatsApp: wa}
}

// SendHumanFallbackAlert sends a WhatsApp alert to the shop owner when human intervention is needed.
func (s *Service) SendHumanFallbackAlert(shopID uuid.UUID, customerName string) {
	if s.WhatsApp == nil {
		slog.Warn("WhatsApp client not initialized, skipping notification")
		return
	}

	var shop models.Shop
	if err := s.DB.Preload("User").Where("id = ?", shopID).First(&shop).Error; err != nil {
		slog.Error("failed to find shop for whatsapp alert", "shop_id", shopID, "error", err)
		return
	}

	// Use shop's whatsapp number as priority, then owner's personal number
	to := ""
	if shop.WhatsAppNumber != nil && *shop.WhatsAppNumber != "" {
		to = *shop.WhatsAppNumber
	} else if shop.User.WhatsAppNumber != nil && *shop.User.WhatsAppNumber != "" {
		to = *shop.User.WhatsAppNumber
	}

	if to == "" {
		slog.Warn("no whatsapp number found for shop/owner contact", "shop_id", shopID)
		return
	}

	if customerName == "" {
		customerName = "একজন কাস্টমার"
	}

	// Template: human_fallback_alert_bn
	// Example: "সতর্কতা: আপনার {{1}} পেজে একজন কাস্টমার ({{2}}) মানুষের সাথে কথা বলতে চাচ্ছেন। অনুগ্রহ করে দ্রুত ইনবক্স চেক করুন।"
	templateName := "human_fallback_alert_bn"
	params := []string{shop.ShopName, customerName}

	go func() {
		if err := s.WhatsApp.SendTemplate(to, templateName, "bn", params); err != nil {
			slog.Error("failed to send human fallback whatsapp alert", "to", to, "error", err)
		} else {
			slog.Info("human fallback whatsapp alert sent successfully", "to", to, "shop", shop.ShopName)
		}
	}()
}

// SendSystemFailureAlert sends a WhatsApp alert to all super admins when a system-critical error occurs.
func (s *Service) SendSystemFailureAlert(agentType, errorMsg string) {
	if s.WhatsApp == nil {
		slog.Warn("WhatsApp client not initialized, skipping notification")
		return
	}

	var superAdmins []models.User
	if err := s.DB.Where("role = ?", models.RoleSuperAdmin).Find(&superAdmins).Error; err != nil {
		slog.Error("failed to find super admins for whatsapp alert", "error", err)
		return
	}

	for _, admin := range superAdmins {
		if admin.WhatsAppNumber == nil || *admin.WhatsAppNumber == "" {
			continue
		}

		to := *admin.WhatsAppNumber
		
		// Template: system_failure_alert_bn
		// Example: "সিস্টেম অ্যালার্ট: Xeni প্ল্যাটফর্মে একটি সিস্টেম এরর বা এআই টাস্ক ({{1}}) ফেইল হয়েছে। এরর: {{2}}"
		templateName := "system_failure_alert_bn"
		params := []string{agentType, errorMsg}

		go func(recipient string) {
			if err := s.WhatsApp.SendTemplate(recipient, templateName, "bn", params); err != nil {
				slog.Error("failed to send system failure whatsapp alert", "to", recipient, "error", err)
			} else {
				slog.Info("system failure whatsapp alert sent successfully", "to", recipient)
			}
		}(to)
	}
}

// SendPaymentAlert sends a WhatsApp alert to the shop owner about a payment event.
// if isManualRequired is true, it emphasizes that action is needed.
func (s *Service) SendPaymentAlert(shopID uuid.UUID, orderIDShort string, customerName string, amount float64, isManualRequired bool) {
	if s.WhatsApp == nil {
		slog.Warn("WhatsApp client not initialized, skipping payment notification")
		return
	}

	var shop models.Shop
	if err := s.DB.Preload("User").Where("id = ?", shopID).First(&shop).Error; err != nil {
		slog.Error("failed to find shop for payment alert", "shop_id", shopID, "error", err)
		return
	}

	// Priority: owner_mobile > whatsapp_number > user whatsapp
	to := ""
	if shop.OwnerMobile != nil && *shop.OwnerMobile != "" {
		to = *shop.OwnerMobile
	} else if shop.WhatsAppNumber != nil && *shop.WhatsAppNumber != "" {
		to = *shop.WhatsAppNumber
	} else if shop.User.WhatsAppNumber != nil && *shop.User.WhatsAppNumber != "" {
		to = *shop.User.WhatsAppNumber
	}

	if to == "" {
		slog.Warn("no whatsapp/mobile number found for payment alert", "shop_id", shopID)
		return
	}

	if customerName == "" {
		customerName = "একজন কাস্টমার"
	}

	amountStr := fmt.Sprintf("%.0f", amount)
	params := []string{shop.ShopName, orderIDShort, amountStr, customerName}
	
	// We'll use two different templates based on state. 
	// Make sure these are created in your Meta WhatsApp Manager.
	templateName := "payment_auto_verified_bn"
	if isManualRequired {
		templateName = "payment_manual_review_bn"
	}

	go func() {
		if err := s.WhatsApp.SendTemplate(to, templateName, "bn", params); err != nil {
			slog.Error("failed to send payment whatsapp alert", "to", to, "error", err)
		} else {
			slog.Info("payment whatsapp alert sent", "to", to, "order", orderIDShort, "manual", isManualRequired)
		}
	}()
}

// SendDeliveryManualAlert sends a WhatsApp alert to the shop owner when no delivery API is configured,
// prompting them to manually book a courier from the dashboard.
func (s *Service) SendDeliveryManualAlert(shopID uuid.UUID, orderIDShort string, customerName string, customerAddress string, amount float64) {
	if s.WhatsApp == nil {
		slog.Warn("WhatsApp client not initialized, skipping delivery notification")
		return
	}

	var shop models.Shop
	if err := s.DB.Preload("User").Where("id = ?", shopID).First(&shop).Error; err != nil {
		slog.Error("failed to find shop for delivery alert", "shop_id", shopID, "error", err)
		return
	}

	// Priority: owner_mobile > whatsapp_number > user whatsapp
	to := ""
	if shop.OwnerMobile != nil && *shop.OwnerMobile != "" {
		to = *shop.OwnerMobile
	} else if shop.WhatsAppNumber != nil && *shop.WhatsAppNumber != "" {
		to = *shop.WhatsAppNumber
	} else if shop.User.WhatsAppNumber != nil && *shop.User.WhatsAppNumber != "" {
		to = *shop.User.WhatsAppNumber
	}

	if to == "" {
		slog.Warn("no whatsapp/mobile number found for delivery alert", "shop_id", shopID)
		return
	}

	if customerName == "" {
		customerName = "একজন কাস্টমার"
	}

	amountStr := fmt.Sprintf("%.0f", amount)
	// Template: delivery_manual_booking_bn
	// Example: "📦 নতুন অর্ডার #{{1}} পেমেন্ট কনফার্ম হয়েছে! কাস্টমার: {{2}}, ঠিকানা: {{3}}, মোট: ৳{{4}}। দয়া করে ড্যাশবোর্ড থেকে কুরিয়ার বুক করুন।"
	templateName := "delivery_manual_booking_bn"
	params := []string{orderIDShort, customerName, customerAddress, amountStr}

	go func() {
		if err := s.WhatsApp.SendTemplate(to, templateName, "bn", params); err != nil {
			slog.Error("failed to send delivery manual whatsapp alert", "to", to, "error", err)
		} else {
			slog.Info("delivery manual whatsapp alert sent", "to", to, "order", orderIDShort)
		}
	}()
}
