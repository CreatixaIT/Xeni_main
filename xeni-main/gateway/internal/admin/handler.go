package admin

import (
	"encoding/json"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/pkg/audit"
	"github.com/xeni-ai/gateway/pkg/response"
)

// Handler contains HTTP handlers for admin endpoints.
type Handler struct {
	Service *Service
}

// NewHandler creates a fully-wired admin handler.
// Note: Changed from accepting DB to Service to utilize business logic.
func NewHandler(svc *Service) *Handler {
	return &Handler{Service: svc}
}

func (h *Handler) getAdminID(c *fiber.Ctx) uuid.UUID {
	id, _ := uuid.Parse(c.Locals("user_id").(string))
	return id
}

func (h *Handler) getAdminRole(c *fiber.Ctx) string {
	return c.Locals("role").(string)
}

func (h *Handler) handleAdminError(c *fiber.Ctx, err error) error {
	if adminErr, ok := err.(*AdminError); ok {
		return response.Error(c, adminErr.Code, adminErr.Message)
	}
	return response.InternalError(c)
}

// ── Platform Overview ──

// GetOverview returns platform-wide metrics.
// @Summary      Get platform overview
// @Tags         admin
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Envelope
// @Router       /api/admin/overview [get]
func (h *Handler) GetOverview(c *fiber.Ctx) error {
	overview, err := h.Service.GetOverview()
	if err != nil {
		return response.InternalError(c)
	}
	return response.Success(c, overview)
}

// ── User Management ──

// ListUsers returns paginated users with filters.
func (h *Handler) ListUsers(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 20)
	if limit > 100 {
		limit = 100
	}

	search := c.Query("search", "")
	role := c.Query("role", "")
	plan := c.Query("plan", "")
	status := c.Query("status", "")
	sort := c.Query("sort", "created_at")
	order := c.Query("order", "desc")

	// In a real app we'd check caching here, but let's query DB for list users to ensure fresh search
	users, total, err := h.Service.Repo.ListUsers(page, limit, search, role, plan, status, sort, order)
	if err != nil {
		return response.InternalError(c)
	}

	totalPages := int(total) / limit
	if int(total)%limit > 0 {
		totalPages++
	}

	return response.SuccessWithMeta(c, users, response.PaginationMeta{
		Page: page, PerPage: limit, Total: total, TotalPages: totalPages,
	})
}

// GetUser returns full user details for the side panel.
func (h *Handler) GetUser(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid user ID")
	}

	detail, err := h.Service.Repo.GetUserDetail(id)
	if err != nil {
		return response.NotFound(c, "User not found")
	}

	return response.Success(c, detail)
}

// ChangeUserRole updates a user's role.
func (h *Handler) ChangeUserRole(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid user ID")
	}

	var req struct {
		Role string `json:"role" validate:"required,oneof=user admin super_admin"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	adminID := h.getAdminID(c)
	adminRole := h.getAdminRole(c)

	if err := h.Service.ChangeUserRole(id, models.UserRole(req.Role), adminID, adminRole); err != nil {
		return h.handleAdminError(c, err)
	}

	audit.LogAudit(h.Service.DB, adminID, audit.AuditUserRoleChange, id.String(), map[string]interface{}{"old_role": "unknown", "new_role": req.Role}, c.IP(), c.Get("User-Agent"))

	return response.Success(c, fiber.Map{"message": "User role updated"})
}

// ChangeUserStatus suspends or activates a user.
func (h *Handler) ChangeUserStatus(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid user ID")
	}

	var req struct {
		Status string `json:"status" validate:"required,oneof=active suspended"`
		Reason string `json:"reason"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.Status == string(models.StatusSuspended) && strings.TrimSpace(req.Reason) == "" {
		return response.BadRequest(c, "Reason is required when suspending a user")
	}

	adminID := h.getAdminID(c)
	adminRole := h.getAdminRole(c)

	if err := h.Service.ChangeUserStatus(id, models.UserStatus(req.Status), req.Reason, adminRole); err != nil {
		return h.handleAdminError(c, err)
	}

	action := audit.AuditUserSuspend
	if req.Status == string(models.StatusActive) {
		action = audit.AuditUserActivate
	}

	audit.LogAudit(h.Service.DB, adminID, action, id.String(), map[string]interface{}{"status": req.Status, "reason": req.Reason}, c.IP(), c.Get("User-Agent"))

	return response.Success(c, fiber.Map{"message": "User status updated"})
}

// OverrideUserPlan force changes a user's subscription.
func (h *Handler) OverrideUserPlan(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid user ID")
	}

	var req struct {
		PlanID string `json:"plan_id"`
		Reason string `json:"reason"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	planID, err := uuid.Parse(req.PlanID)
	if err != nil {
		return response.BadRequest(c, "Invalid plan ID")
	}

	adminID := h.getAdminID(c)

	if err := h.Service.OverrideUserPlan(id, planID, req.Reason); err != nil {
		return h.handleAdminError(c, err)
	}

	audit.LogAudit(h.Service.DB, adminID, audit.AuditUserPlanOverride, id.String(), map[string]interface{}{"new_plan_id": req.PlanID, "reason": req.Reason}, c.IP(), c.Get("User-Agent"))

	return response.Success(c, fiber.Map{"message": "User plan updated"})
}

// SoftDeleteUser deletes a user account softly.
func (h *Handler) DeleteUser(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid user ID")
	}

	adminID := h.getAdminID(c)
	adminRole := h.getAdminRole(c)

	if err := h.Service.SoftDeleteUser(id, adminRole); err != nil {
		return h.handleAdminError(c, err)
	}

	audit.LogAudit(h.Service.DB, adminID, audit.AuditUserDelete, id.String(), map[string]interface{}{}, c.IP(), c.Get("User-Agent"))

	return response.Success(c, fiber.Map{"message": "User deleted"})
}

// GetUserTasks gets tasks for a single user.
func (h *Handler) GetUserTasks(c *fiber.Ctx) error {
	userID := c.Params("id")
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 20)
	agentType := c.Query("agent_type", "")
	status := c.Query("status", "")

	tasks, total, err := h.Service.Repo.ListTasks(page, limit, agentType, status, userID)
	if err != nil {
		return response.InternalError(c)
	}

	totalPages := int(total) / limit
	if int(total)%limit > 0 {
		totalPages++
	}

	return response.SuccessWithMeta(c, tasks, response.PaginationMeta{
		Page: page, PerPage: limit, Total: total, TotalPages: totalPages,
	})
}

// GetUserConversations gets conversation history for a single user (shop owner).
func (h *Handler) GetUserConversations(c *fiber.Ctx) error {
	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid user ID")
	}

	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 10)

	conversations, total, err := h.Service.GetUserConversations(userID, page, limit)
	if err != nil {
		return response.InternalError(c)
	}

	totalPages := int(total) / limit
	if int(total)%limit > 0 {
		totalPages++
	}

	return response.SuccessWithMeta(c, conversations, response.PaginationMeta{
		Page: page, PerPage: limit, Total: total, TotalPages: totalPages,
	})
}

// ── Tasks ──

func (h *Handler) ListAllTasks(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 20)
	agentType := c.Query("agent_type", "")
	status := c.Query("status", "")
	userID := c.Query("user_id", "")

	tasks, total, err := h.Service.Repo.ListTasks(page, limit, agentType, status, userID)
	if err != nil {
		return response.InternalError(c)
	}

	totalPages := int(total) / limit
	if int(total)%limit > 0 {
		totalPages++
	}

	return response.SuccessWithMeta(c, tasks, response.PaginationMeta{
		Page: page, PerPage: limit, Total: total, TotalPages: totalPages,
	})
}

func (h *Handler) GetTaskStats(c *fiber.Ctx) error {
	stats, err := h.Service.Repo.GetTaskStats()
	if err != nil {
		return response.InternalError(c)
	}
	return response.Success(c, fiber.Map{"agents": stats})
}

func (h *Handler) RetryTask(c *fiber.Ctx) error {
	// Task retry logic involves publishing to rabbitMQ — placeholder for DLQ flow
	return response.Success(c, fiber.Map{"message": "Task queued for retry"})
}

// ── Transactions ──

func (h *Handler) ListTransactions(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 20)
	status := c.Query("status", "")
	plan := c.Query("plan", "")
	from := c.Query("from", "")
	to := c.Query("to", "")

	payments, total, err := h.Service.Repo.ListTransactions(page, limit, status, plan, from, to)
	if err != nil {
		return response.InternalError(c)
	}

	totalPages := int(total) / limit
	if int(total)%limit > 0 {
		totalPages++
	}

	return response.SuccessWithMeta(c, payments, response.PaginationMeta{
		Page: page, PerPage: limit, Total: total, TotalPages: totalPages,
	})
}

func (h *Handler) GetTransaction(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid transaction ID")
	}

	payment, err := h.Service.Repo.GetTransaction(id)
	if err != nil {
		return response.NotFound(c, "Transaction not found")
	}

	return response.Success(c, payment)
}

func (h *Handler) ExportTransactions(c *fiber.Ctx) error {
	// Simplified export stub for this assignment
	c.Set("Content-Type", "text/csv")
	c.Set("Content-Disposition", `attachment; filename="transactions.csv"`)
	return c.SendString("id,user_id,amount,status,created_at\n")
}

func (h *Handler) ExportUsers(c *fiber.Ctx) error {
	c.Set("Content-Type", "text/csv")
	c.Set("Content-Disposition", `attachment; filename="users.csv"`)
	return c.SendString("id,name,email,role,status,joined_at\n")
}

// ── Plans ──

func (h *Handler) GetPlan(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid plan ID")
	}

	var plan models.Plan
	if err := h.Service.DB.Where("id = ?", id).First(&plan).Error; err != nil {
		return response.NotFound(c, "Plan not found")
	}

	return response.Success(c, plan)
}

func (h *Handler) UpdatePlan(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid plan ID")
	}

	var req struct {
		Name            string          `json:"name"`
		Tagline         string          `json:"tagline"`
		TaglineBN       string          `json:"tagline_bn"`
		PriceMonthlyBDT float64         `json:"price_monthly_bdt"`
		CTAText         string          `json:"cta_text"`
		CTATextBN       string          `json:"cta_text_bn"`
		IsMostPopular   bool            `json:"is_most_popular"`
		DisplayOrder    int             `json:"display_order"`
		IsActive        bool            `json:"is_active"`
		Features        json.RawMessage `json:"features"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	updates["tagline"] = req.Tagline
	updates["tagline_bn"] = req.TaglineBN
	updates["price_monthly_bdt"] = req.PriceMonthlyBDT
	updates["cta_text"] = req.CTAText
	updates["cta_text_bn"] = req.CTATextBN
	updates["is_most_popular"] = req.IsMostPopular
	updates["display_order"] = req.DisplayOrder
	updates["is_active"] = req.IsActive
	if len(req.Features) > 0 {
		updates["features"] = models.JSON(req.Features)
	}

	adminID := h.getAdminID(c)

	if err := h.Service.UpdatePlan(id, updates); err != nil {
		return h.handleAdminError(c, err)
	}

	audit.LogAudit(h.Service.DB, adminID, audit.AuditPlanUpdate, id.String(), map[string]interface{}{"updates": updates}, c.IP(), c.Get("User-Agent"))

	return response.Success(c, fiber.Map{"message": "Plan updated"})
}

// ── System Settings ──

// GetSystemSetting retrieves a global setting by key (e.g. global_agent_rules).
func (h *Handler) GetSystemSetting(c *fiber.Ctx) error {
	key := c.Params("key")
	if key == "" {
		return response.BadRequest(c, "Setting key is required")
	}

	setting, err := h.Service.GetSystemSetting(key)
	if err != nil {
		// If not found, return empty value rather than 404 for a better UX
		return response.Success(c, fiber.Map{"setting_key": key, "setting_value": ""})
	}

	return response.Success(c, setting)
}

// UpdateSystemSetting updates a global setting.
func (h *Handler) UpdateSystemSetting(c *fiber.Ctx) error {
	key := c.Params("key")
	if key == "" {
		return response.BadRequest(c, "Setting key is required")
	}

	var req struct {
		Value       string `json:"value"`
		Description string `json:"description"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	adminID := c.Locals("user_id").(string)

	if err := h.Service.UpsertSystemSetting(key, req.Value, req.Description, adminID); err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, fiber.Map{"message": "Setting updated successfully"})
}

// GetRecentActivity returns the most recent audit log entries for the Live Activity Feed.
func (h *Handler) GetRecentActivity(c *fiber.Ctx) error {
	limit := c.QueryInt("limit", 20)
	if limit > 50 {
		limit = 50
	}

	items, err := h.Service.Repo.GetRecentActivity(limit)
	if err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, items)
}
