package social

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/pkg/response"
)

// Handler holds social media dependencies.
type Handler struct {
	DB *gorm.DB
}

// NewHandler creates a new social handler.
func NewHandler(db *gorm.DB) *Handler {
	return &Handler{DB: db}
}

// ListSocialLinks handles GET /api/social/links — list social media links.
func (h *Handler) ListSocialLinks(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	// Get user's shop
	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.BadRequest(c, "Create a shop first")
	}

	var links []models.SocialLink
	if err := h.DB.Where("shop_id = ?", shop.ID).Order("created_at DESC").Find(&links).Error; err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, links)
}

// CreateSocialLink handles POST /api/social/links — create a social media link.
func (h *Handler) CreateSocialLink(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	// Get user's shop
	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.BadRequest(c, "Create a shop first")
	}

	var req struct {
		Platform string  `json:"platform" validate:"required"`
		URL      string  `json:"url" validate:"required"`
		Handle   *string `json:"handle"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	link := models.SocialLink{
		ShopID:   shop.ID,
		Platform: req.Platform,
		URL:      req.URL,
		Handle:   req.Handle,
		IsActive: true,
	}

	if err := h.DB.Create(&link).Error; err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, link)
}

// DeleteSocialLink handles DELETE /api/social/links/:id — delete a social media link.
func (h *Handler) DeleteSocialLink(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	linkID := c.Params("id")
	linkUUID, err := uuid.Parse(linkID)
	if err != nil {
		return response.BadRequest(c, "Invalid link ID")
	}

	// Get user's shop
	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.BadRequest(c, "Create a shop first")
	}

	// Verify ownership
	var link models.SocialLink
	if err := h.DB.Where("id = ? AND shop_id = ?", linkUUID, shop.ID).First(&link).Error; err != nil {
		return response.NotFound(c, "Social link not found")
	}

	if err := h.DB.Delete(&link).Error; err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, fiber.Map{"message": "Social link deleted"})
}
