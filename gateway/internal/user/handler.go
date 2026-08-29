package user

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/pkg/response"
)

type Handler struct {
	DB *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{DB: db}
}

func (h *Handler) GetMe(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var user models.User
	if err := h.DB.First(&user, uid).Error; err != nil {
		return response.NotFound(c, "User not found")
	}
	return response.Success(c, user)
}

func (h *Handler) UpdateMe(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var req struct {
		FullName          string `json:"full_name"`
		PreferredLanguage string `json:"preferred_language"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	updates := make(map[string]interface{})
	if req.FullName != "" {
		updates["full_name"] = req.FullName
	}
	if req.PreferredLanguage != "" {
		updates["preferred_language"] = req.PreferredLanguage
	}
	if len(updates) == 0 {
		return response.BadRequest(c, "No fields to update")
	}

	h.DB.Model(&models.User{}).Where("id = ?", uid).Updates(updates)
	var user models.User
	h.DB.First(&user, uid)
	return response.Success(c, user)
}

func (h *Handler) ChangePassword(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	var user models.User
	if err := h.DB.First(&user, uid).Error; err != nil {
		return response.NotFound(c, "User not found")
	}
	if user.PasswordHash == nil {
		return response.BadRequest(c, "OAuth accounts cannot change password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		return response.BadRequest(c, "Current password is incorrect")
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	hashStr := string(hash)
	h.DB.Model(&user).Update("password_hash", &hashStr)
	return response.Success(c, map[string]string{"message": "Password changed"})
}

func (h *Handler) UploadAvatar(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	file, err := c.FormFile("avatar")
	if err != nil {
		return response.BadRequest(c, "No file uploaded")
	}
	// TODO: Upload to S3
	avatarURL := "/uploads/avatars/" + file.Filename
	h.DB.Model(&models.User{}).Where("id = ?", uid).Update("avatar_url", avatarURL)
	return response.Success(c, map[string]string{"avatar_url": avatarURL})
}

// GetGlobalAgentRules returns the platform-wide global AI rules (read-only for users).
// This allows users to see what global constraints govern the AI bot on their shop.
func (h *Handler) GetGlobalAgentRules(c *fiber.Ctx) error {
	var rules []models.AgentRule
	if err := h.DB.Where("scope = ? AND is_active = ?", models.RuleScopeGlobal, true).Order("priority ASC").Find(&rules).Error; err != nil {
		return response.InternalError(c)
	}
	return response.Success(c, rules)
}
