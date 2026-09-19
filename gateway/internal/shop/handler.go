package shop

import (
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/pkg/response"
)

// Handler holds shop dependencies.
type Handler struct {
	DB *gorm.DB
}

// NewHandler creates a new shop handler.
func NewHandler(db *gorm.DB) *Handler {
	return &Handler{DB: db}
}

// CreateShop handles POST /api/shops — create a shop for the current user.
func (h *Handler) CreateShop(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	// Check if user already has a shop
	var existing models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&existing).Error; err == nil {
		return response.BadRequest(c, "You already have a shop. Use PUT to update.")
	}

	var req struct {
		ShopName              string   `json:"shop_name"`
		ShopDescription       *string  `json:"shop_description"`
		ShopLogoURL           *string  `json:"shop_logo_url"`
		PreferredLanguage     string   `json:"preferred_language"`
		CourierPreference     string   `json:"courier_preference"`
		BkashMerchantNumber   *string  `json:"bkash_merchant_number"`
		NagadMerchantNumber   *string  `json:"nagad_merchant_number"`
		OwnerMobile           *string  `json:"owner_mobile"`
		District              *string  `json:"district"`
		DeliveryChargeInside  *float64 `json:"delivery_charge_inside"`
		DeliveryChargeOutside *float64 `json:"delivery_charge_outside"`
		StoreTheme            string   `json:"store_theme"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}
	if req.ShopName == "" {
		return response.BadRequest(c, "shop_name is required")
	}
	if req.PreferredLanguage == "" {
		req.PreferredLanguage = "bn"
	}
	if req.CourierPreference == "" {
		req.CourierPreference = "pathao"
	}
	if req.StoreTheme == "" {
		req.StoreTheme = "modern"
	}

	shop := models.Shop{
		UserID:                  uid,
		ShopName:                req.ShopName,
		ShopDescription:         req.ShopDescription,
		ShopLogoURL:             req.ShopLogoURL,
		PreferredLanguage:       req.PreferredLanguage,
		CourierPreference:       req.CourierPreference,
		BkashMerchantNumber:     req.BkashMerchantNumber,
		NagadMerchantNumber:     req.NagadMerchantNumber,
		OwnerMobile:             req.OwnerMobile,
		District:                req.District,
		PaymentVerificationMode: "manual",
		StoreTheme:              models.StoreTheme(req.StoreTheme),
	}
	if req.DeliveryChargeInside != nil {
		shop.DeliveryChargeInside = *req.DeliveryChargeInside
	}
	if req.DeliveryChargeOutside != nil {
		shop.DeliveryChargeOutside = *req.DeliveryChargeOutside
	}

	// Auto-set WhatsApp number from owner mobile if not already set
	if req.OwnerMobile != nil && *req.OwnerMobile != "" {
		shop.WhatsAppNumber = req.OwnerMobile
	}

	// Generate shop slug from shop name with collision handling and Unicode support
	baseSlug := strings.ToLower(strings.ReplaceAll(req.ShopName, " ", "-"))
	baseSlug = strings.ReplaceAll(baseSlug, "/", "-")
	baseSlug = strings.ReplaceAll(baseSlug, "\\", "-")

	// Unicode-safe slug generation: keep alphanumeric, hyphens, and common Bengali characters
	// For Bengali characters, we'll use a simple approach: keep them as-is for now
	// This allows Bengali shop names to have readable URLs
	baseSlug = strings.Map(func(r rune) rune {
		// Keep ASCII alphanumeric and hyphens
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			return r
		}
		// Keep Bengali characters (Unicode range 0980-09FF)
		if r >= 0x0980 && r <= 0x09FF {
			return r
		}
		// Remove everything else
		return -1
	}, baseSlug)

	// Handle slug collisions by appending numeric suffix
	slug := baseSlug
	collisionCount := 0
	for {
		var existing models.Shop
		err := h.DB.Where("shop_slug = ?", slug).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			// Slug is available
			break
		}
		if err != nil {
			return response.InternalError(c)
		}
		// Collision detected, try with suffix
		collisionCount++
		slug = baseSlug + "-" + fmt.Sprintf("%d", collisionCount)
		// Safety check to prevent infinite loop
		if collisionCount > 1000 {
			return response.BadRequest(c, "Unable to generate unique slug")
		}
	}
	shop.ShopSlug = &slug

	if err := h.DB.Create(&shop).Error; err != nil {
		return response.InternalError(c)
	}

	// Automatically assign SELLER role when user creates a shop
	var user models.User
	if err := h.DB.First(&user, "id = ?", uid).Error; err == nil {
		if user.Role == models.RoleUser {
			user.Role = models.RoleSeller
			h.DB.Save(&user)
		}
	}

	return response.Created(c, shop)
}

// GetMyShop handles GET /api/shops/me — get current user's shop.
func (h *Handler) GetMyShop(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var shop models.Shop
	if err := h.DB.Preload("ConnectedPages").Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.NotFound(c, "No shop found. Create one first.")
	}

	return response.Success(c, shop)
}

// UpdateMyShop handles PUT /api/shops/me — update current user's shop.
func (h *Handler) UpdateMyShop(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.NotFound(c, "No shop found")
	}

	var req struct {
		ShopName                *string                 `json:"shop_name"`
		ShopDescription         *string                 `json:"shop_description"`
		ShopLogoURL             *string                 `json:"shop_logo_url"`
		PreferredLanguage       *string                 `json:"preferred_language"`
		CourierPreference       *string                 `json:"courier_preference"`
		BkashMerchantNumber     *string                 `json:"bkash_merchant_number"`
		NagadMerchantNumber     *string                 `json:"nagad_merchant_number"`
		OwnerMobile             *string                 `json:"owner_mobile"`
		District                *string                 `json:"district"`
		DeliveryChargeInside    *float64                `json:"delivery_charge_inside"`
		DeliveryChargeOutside   *float64                `json:"delivery_charge_outside"`
		PaymentVerificationMode *string                 `json:"payment_verification_mode"`
		StoreTheme              *string                 `json:"store_theme"`
		BkashAppKey             *string                 `json:"bkash_app_key"`
		BkashAppSecret          *string                 `json:"bkash_app_secret"`
		NagadMerchantID         *string                 `json:"nagad_merchant_id"`
		NagadMerchantKey        *string                 `json:"nagad_merchant_key"`
		AutoReplyEnabled        *bool                   `json:"auto_reply_enabled"`
		AutoOrderEnabled        *bool                   `json:"auto_order_enabled"`
		Integrations            *map[string]interface{} `json:"integrations"`
		CustomAgentRules        *string                 `json:"custom_agent_rules"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	updates := make(map[string]interface{})
	if req.ShopName != nil {
		updates["shop_name"] = *req.ShopName
	}
	if req.ShopDescription != nil {
		updates["shop_description"] = *req.ShopDescription
	}
	if req.ShopLogoURL != nil {
		updates["shop_logo_url"] = *req.ShopLogoURL
	}
	if req.PreferredLanguage != nil {
		updates["preferred_language"] = *req.PreferredLanguage
	}
	if req.CourierPreference != nil {
		updates["courier_preference"] = *req.CourierPreference
	}
	if req.BkashMerchantNumber != nil {
		updates["bkash_merchant_number"] = *req.BkashMerchantNumber
	}
	if req.NagadMerchantNumber != nil {
		updates["nagad_merchant_number"] = *req.NagadMerchantNumber
	}
	if req.OwnerMobile != nil {
		updates["owner_mobile"] = *req.OwnerMobile
		// Sync WhatsApp number
		if *req.OwnerMobile != "" {
			updates["whatsapp_number"] = *req.OwnerMobile
		}
	}
	if req.District != nil {
		updates["district"] = *req.District
	}
	if req.DeliveryChargeInside != nil {
		updates["delivery_charge_inside"] = *req.DeliveryChargeInside
	}
	if req.DeliveryChargeOutside != nil {
		updates["delivery_charge_outside"] = *req.DeliveryChargeOutside
	}
	if req.PaymentVerificationMode != nil {
		updates["payment_verification_mode"] = *req.PaymentVerificationMode
	}
	if req.StoreTheme != nil {
		// Validate theme value
		validThemes := map[string]bool{"modern": true, "luxury": true, "colorful": true}
		if validThemes[*req.StoreTheme] {
			updates["store_theme"] = *req.StoreTheme
		}
	}
	if req.BkashAppKey != nil {
		updates["bkash_app_key"] = *req.BkashAppKey
	}
	if req.BkashAppSecret != nil {
		updates["bkash_app_secret"] = *req.BkashAppSecret
	}
	if req.NagadMerchantID != nil {
		updates["nagad_merchant_id"] = *req.NagadMerchantID
	}
	if req.NagadMerchantKey != nil {
		updates["nagad_merchant_key"] = *req.NagadMerchantKey
	}
	if req.AutoReplyEnabled != nil {
		updates["auto_reply_enabled"] = *req.AutoReplyEnabled
	}
	if req.AutoOrderEnabled != nil {
		updates["auto_order_enabled"] = *req.AutoOrderEnabled
	}
	if req.Integrations != nil {
		updates["integrations"] = *req.Integrations
	}
	if req.CustomAgentRules != nil {
		updates["custom_agent_rules"] = *req.CustomAgentRules
	}

	if len(updates) > 0 {
		if err := h.DB.Model(&shop).Updates(updates).Error; err != nil {
			return response.InternalError(c)
		}
	}

	h.DB.Preload("ConnectedPages").First(&shop, shop.ID)
	return response.Success(c, shop)
}

// GetIntegrations handles GET /api/shops/integrations — get masked integration statuses.
func (h *Handler) GetIntegrations(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var shop models.Shop
	if err := h.DB.Select("bkash_app_key, bkash_app_secret, bkash_username, bkash_password, nagad_merchant_id, nagad_merchant_key, pathao_client_id, pathao_client_secret, pathao_username, pathao_password, steadfast_api_key, steadfast_secret_key").Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.NotFound(c, "No shop found")
	}

	return response.Success(c, map[string]interface{}{
		"bkash": map[string]interface{}{
			"is_configured": shop.BkashAppKey != nil && *shop.BkashAppKey != "",
		},
		"nagad": map[string]interface{}{
			"is_configured": shop.NagadMerchantID != nil && *shop.NagadMerchantID != "",
		},
		"pathao": map[string]interface{}{
			"is_configured": shop.PathaoClientID != nil && *shop.PathaoClientID != "",
		},
		"steadfast": map[string]interface{}{
			"is_configured": shop.SteadfastAPIKey != nil && *shop.SteadfastAPIKey != "",
		},
	})
}

// UpdateIntegrations handles PUT /api/shops/integrations — update merchant integrations.
func (h *Handler) UpdateIntegrations(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.NotFound(c, "No shop found")
	}

	var req struct {
		BkashAppKey        *string `json:"bkash_app_key"`
		BkashAppSecret     *string `json:"bkash_app_secret"`
		BkashUsername      *string `json:"bkash_username"`
		BkashPassword      *string `json:"bkash_password"`
		NagadMerchantID    *string `json:"nagad_merchant_id"`
		NagadMerchantKey   *string `json:"nagad_merchant_key"`
		PathaoClientID     *string `json:"pathao_client_id"`
		PathaoClientSecret *string `json:"pathao_client_secret"`
		PathaoUsername     *string `json:"pathao_username"`
		PathaoPassword     *string `json:"pathao_password"`
		SteadfastAPIKey    *string `json:"steadfast_api_key"`
		SteadfastSecretKey *string `json:"steadfast_secret_key"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	updates := make(map[string]interface{})

	// Only update fields that are explicitly provided (not nil) and not empty masks like "********"
	if req.BkashAppKey != nil && *req.BkashAppKey != "********" {
		updates["bkash_app_key"] = *req.BkashAppKey
	}
	if req.BkashAppSecret != nil && *req.BkashAppSecret != "********" {
		updates["bkash_app_secret"] = *req.BkashAppSecret
	}
	if req.BkashUsername != nil && *req.BkashUsername != "********" {
		updates["bkash_username"] = *req.BkashUsername
	}
	if req.BkashPassword != nil && *req.BkashPassword != "********" {
		updates["bkash_password"] = *req.BkashPassword
	}

	if req.NagadMerchantID != nil && *req.NagadMerchantID != "********" {
		updates["nagad_merchant_id"] = *req.NagadMerchantID
	}
	if req.NagadMerchantKey != nil && *req.NagadMerchantKey != "********" {
		updates["nagad_merchant_key"] = *req.NagadMerchantKey
	}

	if req.PathaoClientID != nil && *req.PathaoClientID != "********" {
		updates["pathao_client_id"] = *req.PathaoClientID
	}
	if req.PathaoClientSecret != nil && *req.PathaoClientSecret != "********" {
		updates["pathao_client_secret"] = *req.PathaoClientSecret
	}
	if req.PathaoUsername != nil && *req.PathaoUsername != "********" {
		updates["pathao_username"] = *req.PathaoUsername
	}
	if req.PathaoPassword != nil && *req.PathaoPassword != "********" {
		updates["pathao_password"] = *req.PathaoPassword
	}

	if req.SteadfastAPIKey != nil && *req.SteadfastAPIKey != "********" {
		updates["steadfast_api_key"] = *req.SteadfastAPIKey
	}
	if req.SteadfastSecretKey != nil && *req.SteadfastSecretKey != "********" {
		updates["steadfast_secret_key"] = *req.SteadfastSecretKey
	}

	if len(updates) > 0 {
		h.DB.Model(&shop).Updates(updates)
	}

	return response.Success(c, map[string]string{"message": "Integrations updated successfully"})
}
