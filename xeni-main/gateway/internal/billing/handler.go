package billing

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/url"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/xeni-ai/gateway/internal/cache"
	"github.com/xeni-ai/gateway/internal/config"
	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/internal/websocket"
	"github.com/xeni-ai/gateway/pkg/response"
)

// Handler holds billing dependencies.
type Handler struct {
	DB     *gorm.DB
	Redis  *cache.Client
	Config *config.Config
	WSHub  *websocket.Hub
}

// NewHandler creates a new billing handler.
func NewHandler(db *gorm.DB, redis *cache.Client, cfg *config.Config, wsHub *websocket.Hub) *Handler {
	return &Handler{DB: db, Redis: redis, Config: cfg, WSHub: wsHub}
}

// GetPlans returns all active subscription plans with caching.
func (h *Handler) GetPlans(c *fiber.Ctx) error {
	ctx := context.Background()

	// Try cache
	if h.Redis != nil {
		data, err := h.Redis.GetJSON(ctx, cache.KeyBillingPlans)
		if err == nil && data != nil {
			var plans []models.Plan
			if json.Unmarshal(data, &plans) == nil {
				return response.Success(c, plans)
			}
		} else if err != nil {
			slog.Warn("Redis plans cache error", "error", err)
		}
	}

	var plans []models.Plan
	if err := h.DB.Where("is_active = true").Order("display_order ASC, price_monthly_bdt ASC").Find(&plans).Error; err != nil {
		slog.Error("Database plans fetch error", "error", err)
		return response.InternalError(c)
	}

	// Cache for 1 hour
	if h.Redis != nil {
		data, _ := json.Marshal(plans)
		h.Redis.SetJSON(ctx, cache.KeyBillingPlans, data, 1*time.Hour)
	}

	return response.Success(c, plans)
}

// GetSubscription returns the user's current subscription.
func (h *Handler) GetSubscription(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var sub models.Subscription
	if err := h.DB.Preload("Plan").Where("user_id = ?", uid).First(&sub).Error; err != nil {
		return response.NotFound(c, "No active subscription found")
	}

	// Parse agents from plan features
	var features struct {
		Agents         []string `json:"agents"`
		MaxTasksPerDay int      `json:"max_tasks_per_day"`
		StorageMB      int      `json:"storage_mb"`
	}
	json.Unmarshal([]byte(sub.Plan.Features), &features)

	return response.Success(c, map[string]interface{}{
		"plan_tier":        sub.Plan.Tier,
		"agents":           features.Agents,
		"max_tasks_per_day": features.MaxTasksPerDay,
		"storage_mb":       features.StorageMB,
		"status":           sub.Status,
		"current_period_end": sub.CurrentPeriodEnd,
	})
}

// SubscribeSSLCommerz initiates SSLCommerz payment for subscription in BDT.
func (h *Handler) SubscribeSSLCommerz(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var req struct {
		PlanTier string `json:"plan_tier" validate:"required,oneof=starter professional premium enterprise"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Verify user exists
	var user models.User
	if err := h.DB.First(&user, uid).Error; err != nil {
		return response.NotFound(c, "User not found")
	}

	// Get plan
	var plan models.Plan
	if err := h.DB.Where("tier = ? AND is_active = true", req.PlanTier).First(&plan).Error; err != nil {
		return response.NotFound(c, "Plan not found")
	}

	// Enterprise requires custom pricing — not self-serve
	if plan.Tier == models.TierEnterprise {
		return response.BadRequest(c, "Enterprise plan requires contacting sales")
	}

	// Create pending payment
	tranID := uuid.New().String()
	payment := models.Payment{
		UserID:               uid,
		PlanID:               plan.ID,
		Amount:               plan.PriceMonthlyBDT,
		Currency:             "BDT",
		Status:               models.PaymentPending,
		Gateway:              "sslcommerz",
		GatewayTransactionID: &tranID,
	}
	h.DB.Create(&payment)

	// In production: call SSLCommerz API to create session
	apiURL := "https://sandbox.sslcommerz.com/gwprocess/v4/api.php"
	if !h.Config.SSLCommerz.IsSandbox {
		apiURL = "https://securepay.sslcommerz.com/gwprocess/v4/api.php"
	}

	data := map[string]string{
		"store_id":         h.Config.SSLCommerz.StoreID,
		"store_passwd":     h.Config.SSLCommerz.StorePassword,
		"total_amount":     fmt.Sprintf("%.2f", plan.PriceMonthlyBDT),
		"currency":         "BDT",
		"tran_id":          tranID,
		"success_url":      h.Config.App.FrontendURL + "/api/billing/webhook/sslcommerz/success",
		"fail_url":         h.Config.App.FrontendURL + "/api/billing/webhook/sslcommerz/fail",
		"cancel_url":       h.Config.App.FrontendURL + "/api/billing/webhook/sslcommerz/cancel",
		"cus_name":         user.FullName,
		"cus_email":        user.Email,
		"cus_phone":        "01700000000",
		"cus_add1":         "Dhaka",
		"cus_city":         "Dhaka",
		"cus_country":      "Bangladesh",
		"shipping_method":  "NO",
		"product_name":     string(plan.Tier) + " Subscription",
		"product_category": "Software",
		"product_profile":  "non-physical-goods",
	}

	// Create x-www-form-urlencoded data (must be URL-encoded)
	formValues := url.Values{}
	for k, v := range data {
		formValues.Set(k, v)
	}
	reqBody := formValues.Encode()

	agent := fiber.Post(apiURL).Body([]byte(reqBody)).Set("Content-Type", "application/x-www-form-urlencoded")
	
	statusCode, body, errs := agent.Bytes()
	if len(errs) > 0 || statusCode != 200 {
		slog.Error("SSLCommerz API request failed", "errors", errs, "status", statusCode, "body", string(body))
		return response.InternalError(c)
	}

	var sslRes struct {
		Status         string `json:"status"`
		GatewayPageURL string `json:"GatewayPageURL"`
		FailedReason   string `json:"failedreason"`
	}
	if err := json.Unmarshal(body, &sslRes); err != nil {
		slog.Error("Failed to decode SSLCommerz response", "error", err, "body", string(body))
		return response.InternalError(c)
	}

	if sslRes.Status != "SUCCESS" {
		slog.Error("SSLCommerz returned error", "reason", sslRes.FailedReason)
		return response.BadRequest(c, "Payment gateway error: "+sslRes.FailedReason)
	}

	return response.Success(c, map[string]interface{}{
		"payment_id":     payment.ID,
		"transaction_id": tranID,
		"redirect_url":   sslRes.GatewayPageURL,
		"amount":         plan.PriceMonthlyBDT,
		"currency":       "BDT",
	})
}
// WebhookSSLCommerzSuccess handles SSLCommerz success callback.
func (h *Handler) WebhookSSLCommerzSuccess(c *fiber.Ctx) error {
	tranID := c.FormValue("tran_id")
	valID := c.FormValue("val_id")
	amount := c.FormValue("amount")
	status := c.FormValue("status")

	frontendSuccessURL := h.Config.App.FrontendURL + "/en/billing?status=success"
	frontendFailURL := h.Config.App.FrontendURL + "/en/billing?status=fail&reason=validation_failed"

	slog.Info("SSLCommerz webhook received", "tran_id", tranID, "val_id", valID, "status", status, "amount", amount)

	if status != "VALID" {
		return c.Redirect(frontendFailURL, 303)
	}

	// Find payment
	var payment models.Payment
	if err := h.DB.Where("gateway_transaction_id = ?", tranID).First(&payment).Error; err != nil {
		return c.Redirect(frontendFailURL, 303)
	}

	if payment.Status == models.PaymentSuccess {
		return c.Redirect(frontendSuccessURL, 303)
	}

	// Update payment status
	h.DB.Model(&payment).Updates(map[string]interface{}{
		"status": models.PaymentSuccess,
	})

	// Activate/renew subscription
	h.activateSubscription(payment.UserID, payment.PlanID, &payment)

	// Send confirmation email via Resend
	// TODO: Call Resend API

	// Send FCM push notification
	// TODO: Call FCM

	slog.Info("SSLCommerz payment processed",
		"tran_id", tranID,
		"user_id", payment.UserID,
		"amount", amount,
	)

	return c.Redirect(frontendSuccessURL, 303)
}

// WebhookSSLCommerzFail handles SSLCommerz failure callback.
func (h *Handler) WebhookSSLCommerzFail(c *fiber.Ctx) error {
	tranID := c.FormValue("tran_id")

	var payment models.Payment
	frontendFailURL := h.Config.App.FrontendURL + "/en/billing?status=fail"
	if err := h.DB.Where("gateway_transaction_id = ?", tranID).First(&payment).Error; err != nil {
		return c.Redirect(frontendFailURL+"&reason=not_found", 303)
	}

	h.DB.Model(&payment).Update("status", models.PaymentFailed)

	slog.Info("SSLCommerz payment failed", "tran_id", tranID, "user_id", payment.UserID)

	return c.Redirect(frontendFailURL, 303)
}

// WebhookSSLCommerzCancel handles SSLCommerz cancel callback.
func (h *Handler) WebhookSSLCommerzCancel(c *fiber.Ctx) error {
	frontendCancelURL := h.Config.App.FrontendURL + "/en/billing?status=cancel"
	slog.Info("SSLCommerz payment cancelled")
	return c.Redirect(frontendCancelURL, 303)
}

// GetPayments returns the user's payment history.
func (h *Handler) GetPayments(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var payments []models.Payment
	if err := h.DB.Preload("Plan").Where("user_id = ?", uid).Order("created_at DESC").Find(&payments).Error; err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, payments)
}

// CancelSubscription cancels the user's subscription.
func (h *Handler) CancelSubscription(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var sub models.Subscription
	if err := h.DB.Where("user_id = ? AND status = ?", uid, models.SubActive).First(&sub).Error; err != nil {
		return response.NotFound(c, "No active subscription found")
	}

	now := time.Now()
	h.DB.Model(&sub).Updates(map[string]interface{}{
		"status":       models.SubCancelled,
		"cancelled_at": &now,
	})

	// Invalidate subscription cache
	ctx := context.Background()
	h.Redis.DeleteSubscription(ctx, userID)

	// Send WebSocket event
	h.WSHub.SendToUser(userID, websocket.Event{
		EventType: "subscription_updated",
		Payload:   map[string]string{"status": "cancelled"},
	})

	slog.Info("Subscription cancelled", "user_id", userID)

	return response.Success(c, map[string]string{"message": "Subscription cancelled. Access continues until period end."})
}

// ── Internal Helpers ──

func (h *Handler) activateSubscription(userID uuid.UUID, planID uuid.UUID, payment *models.Payment) {
	now := time.Now()
	periodEnd := now.AddDate(0, 1, 0) // +30 days

	var sub models.Subscription
	err := h.DB.Where("user_id = ?", userID).First(&sub).Error

	if err == gorm.ErrRecordNotFound {
		sub = models.Subscription{
			UserID:             userID,
			PlanID:             planID,
			Status:             models.SubActive,
			BillingCycle:       "monthly",
			CurrentPeriodStart: now,
			CurrentPeriodEnd:   periodEnd,
		}
		h.DB.Create(&sub)
	} else {
		h.DB.Model(&sub).Updates(map[string]interface{}{
			"plan_id":              planID,
			"status":               models.SubActive,
			"current_period_start": now,
			"current_period_end":   periodEnd,
			"cancelled_at":         nil,
		})
	}

	// Link payment to subscription
	if payment != nil {
		h.DB.Model(payment).Update("subscription_id", sub.ID)
	}

	// Invalidate cache
	ctx := context.Background()
	h.Redis.DeleteSubscription(ctx, userID.String())

	// WebSocket notification
	h.WSHub.SendToUser(userID.String(), websocket.Event{
		EventType: "subscription_updated",
		Payload:   map[string]string{"status": "active"},
	})

	slog.Info("Subscription activated", "user_id", userID, "plan_id", planID)
}
