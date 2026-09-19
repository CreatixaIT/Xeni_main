package personalxeni

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/pkg/response"
)

// Handler holds personal Xeni configuration dependencies.
type Handler struct {
	DB *gorm.DB
}

// NewHandler creates a new personal Xeni handler.
func NewHandler(db *gorm.DB) *Handler {
	return &Handler{DB: db}
}

// GetPersonalXeniConfig handles GET /api/personal-xeni/config — get personal AI configuration.
func (h *Handler) GetPersonalXeniConfig(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	// Get user's shop
	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.BadRequest(c, "Create a shop first")
	}

	var config models.PersonalXeniConfig
	if err := h.DB.Where("shop_id = ?", shop.ID).First(&config).Error; err != nil {
		// Return default config if not exists
		return response.Success(c, models.PersonalXeniConfig{
			ShopID:        shop.ID,
			PreferredTone: "friendly",
		})
	}

	return response.Success(c, config)
}

// UpdatePersonalXeniConfig handles PUT /api/personal-xeni/config — update personal AI configuration.
func (h *Handler) UpdatePersonalXeniConfig(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	// Get user's shop
	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.BadRequest(c, "Create a shop first")
	}

	var req models.PersonalXeniConfig
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Check if config exists
	var existingConfig models.PersonalXeniConfig
	if err := h.DB.Where("shop_id = ?", shop.ID).First(&existingConfig).Error; err != nil {
		// Create new config
		req.ShopID = shop.ID
		if err := h.DB.Create(&req).Error; err != nil {
			return response.InternalError(c)
		}
		return response.Success(c, req)
	}

	// Update existing config
	if err := h.DB.Model(&existingConfig).Updates(&req).Error; err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, existingConfig)
}
