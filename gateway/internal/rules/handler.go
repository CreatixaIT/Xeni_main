package rules

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/pkg/audit"
	"github.com/xeni-ai/gateway/pkg/response"
)

type Handler struct {
	DB *gorm.DB
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{DB: db}
}

// ── Admin (Global) Rules ──

func (h *Handler) ListGlobalRules(c *fiber.Ctx) error {
	var rules []models.AgentRule
	if err := h.DB.Where("scope = ?", models.RuleScopeGlobal).Order("priority ASC").Find(&rules).Error; err != nil {
		return response.InternalError(c)
	}
	return response.Success(c, rules)
}

func (h *Handler) CreateGlobalRule(c *fiber.Ctx) error {
	adminID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(adminID)

	var req struct {
		Category string `json:"category"`
		Title    string `json:"title"`
		Rule     string `json:"rule"`
		Priority int    `json:"priority"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	rule := models.AgentRule{
		Scope:     models.RuleScopeGlobal,
		Category:  req.Category,
		Title:     req.Title,
		Rule:      req.Rule,
		Priority:  req.Priority,
		IsActive:  true,
		CreatedBy: &uid,
	}

	if err := h.DB.Create(&rule).Error; err != nil {
		return response.InternalError(c)
	}

	audit.LogAudit(h.DB, uid, audit.AuditAction("admin.rules.create"), rule.ID.String(), map[string]interface{}{"action": "create_global_rule", "title": rule.Title}, c.IP(), c.Get("User-Agent"))

	return response.Created(c, rule)
}

func (h *Handler) UpdateGlobalRule(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid rule ID")
	}

	adminID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(adminID)

	var req struct {
		Category string `json:"category"`
		Title    string `json:"title"`
		Rule     string `json:"rule"`
		Priority int    `json:"priority"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	var rule models.AgentRule
	if err := h.DB.Where("id = ? AND scope = ?", id, models.RuleScopeGlobal).First(&rule).Error; err != nil {
		return response.NotFound(c, "Global rule not found")
	}

	updates := map[string]interface{}{
		"category":   req.Category,
		"title":      req.Title,
		"rule":       req.Rule,
		"priority":   req.Priority,
	}

	if err := h.DB.Model(&rule).Updates(updates).Error; err != nil {
		return response.InternalError(c)
	}

	audit.LogAudit(h.DB, uid, audit.AuditAction("admin.rules.update"), rule.ID.String(), map[string]interface{}{"action": "update_global_rule", "title": req.Title}, c.IP(), c.Get("User-Agent"))

	h.DB.First(&rule, id)
	return response.Success(c, rule)
}

func (h *Handler) DeleteGlobalRule(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid rule ID")
	}

	if err := h.DB.Where("id = ? AND scope = ?", id, models.RuleScopeGlobal).Delete(&models.AgentRule{}).Error; err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, map[string]string{"message": "Global rule deleted"})
}

func (h *Handler) ToggleGlobalRule(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid rule ID")
	}

	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if err := h.DB.Model(&models.AgentRule{}).Where("id = ? AND scope = ?", id, models.RuleScopeGlobal).Update("is_active", req.IsActive).Error; err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, map[string]string{"message": "Rule status updated"})
}

// ── Shop (Custom) Rules ──

func (h *Handler) ListShopRules(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.NotFound(c, "Shop not found")
	}

	var rules []models.AgentRule
	if err := h.DB.Where("scope = ? AND shop_id = ?", models.RuleScopeShop, shop.ID).Order("priority ASC").Find(&rules).Error; err != nil {
		return response.InternalError(c)
	}
	return response.Success(c, rules)
}

func (h *Handler) CreateShopRule(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.NotFound(c, "Shop not found")
	}

	var req struct {
		Category string `json:"category"`
		Title    string `json:"title"`
		Rule     string `json:"rule"`
		Priority int    `json:"priority"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	rule := models.AgentRule{
		Scope:     models.RuleScopeShop,
		ShopID:    &shop.ID,
		Category:  req.Category,
		Title:     req.Title,
		Rule:      req.Rule,
		Priority:  req.Priority,
		IsActive:  true,
		CreatedBy: &uid,
	}

	if err := h.DB.Create(&rule).Error; err != nil {
		return response.InternalError(c)
	}

	return response.Created(c, rule)
}

func (h *Handler) UpdateShopRule(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid rule ID")
	}

	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.NotFound(c, "Shop not found")
	}

	var req struct {
		Category string `json:"category"`
		Title    string `json:"title"`
		Rule     string `json:"rule"`
		Priority int    `json:"priority"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	var rule models.AgentRule
	if err := h.DB.Where("id = ? AND scope = ? AND shop_id = ?", id, models.RuleScopeShop, shop.ID).First(&rule).Error; err != nil {
		return response.NotFound(c, "Shop rule not found")
	}

	updates := map[string]interface{}{
		"category":   req.Category,
		"title":      req.Title,
		"rule":       req.Rule,
		"priority":   req.Priority,
	}

	if err := h.DB.Model(&rule).Updates(updates).Error; err != nil {
		return response.InternalError(c)
	}

	h.DB.First(&rule, id)
	return response.Success(c, rule)
}

func (h *Handler) DeleteShopRule(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid rule ID")
	}

	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.NotFound(c, "Shop not found")
	}

	if err := h.DB.Where("id = ? AND scope = ? AND shop_id = ?", id, models.RuleScopeShop, shop.ID).Delete(&models.AgentRule{}).Error; err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, map[string]string{"message": "Shop rule deleted"})
}

func (h *Handler) ToggleShopRule(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid rule ID")
	}

	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.NotFound(c, "Shop not found")
	}

	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if err := h.DB.Model(&models.AgentRule{}).Where("id = ? AND scope = ? AND shop_id = ?", id, models.RuleScopeShop, shop.ID).Update("is_active", req.IsActive).Error; err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, map[string]string{"message": "Rule status updated"})
}
