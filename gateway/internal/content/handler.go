package content

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/xeni-ai/gateway/internal/cache"
	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/pkg/audit"
	"github.com/xeni-ai/gateway/pkg/response"
	"gorm.io/gorm"
)

// Handler contains HTTP handlers for CMS and review endpoints.
type Handler struct {
	Service *Service
	DB      *gorm.DB
}

// NewHandler creates a new content handler.
func NewHandler(db *gorm.DB, cacheClient *cache.Client, hub interface{ PublishToAdmin(string, interface{}) }) {
	// This is a constructor helper — actual handler is returned from NewContentHandler
}

// NewContentHandler creates a fully-wired content handler.
func NewContentHandler(db *gorm.DB, svc *Service) *Handler {
	return &Handler{Service: svc, DB: db}
}

// ════════════════════════════════════════════
// PUBLIC CONTENT ROUTES (no auth — landing page ISR)
// ════════════════════════════════════════════

// GetHero returns the hero section content for the landing page.
// @Summary      Get hero section
// @Tags         content
// @Produce      json
// @Success      200  {object}  response.Envelope
// @Router       /api/content/hero [get]
func (h *Handler) GetHero(c *fiber.Ctx) error {
	section, err := h.Service.GetSection("hero", cache.KeyContentHero)
	if err != nil {
		return response.NotFound(c, "Hero section not found")
	}
	return response.Success(c, section)
}

// GetBanner returns the announcement banner for the landing page.
// @Summary      Get announcement banner
// @Tags         content
// @Produce      json
// @Success      200  {object}  response.Envelope
// @Router       /api/content/banner [get]
func (h *Handler) GetBanner(c *fiber.Ctx) error {
	section, err := h.Service.GetSection("banner", cache.KeyContentBanner)
	if err != nil {
		return response.NotFound(c, "Banner not found")
	}
	return response.Success(c, section)
}

// GetFAQ returns the FAQ content for the landing page.
// @Summary      Get FAQ section
// @Tags         content
// @Produce      json
// @Success      200  {object}  response.Envelope
// @Router       /api/content/faq [get]
func (h *Handler) GetFAQ(c *fiber.Ctx) error {
	section, err := h.Service.GetSection("faq", cache.KeyContentFAQ)
	if err != nil {
		return response.NotFound(c, "FAQ not found")
	}
	return response.Success(c, section)
}

// GetApprovedReviews returns approved reviews for the landing page.
// @Summary      Get approved reviews
// @Tags         content
// @Produce      json
// @Success      200  {object}  response.Envelope
// @Router       /api/content/reviews [get]
func (h *Handler) GetApprovedReviews(c *fiber.Ctx) error {
	reviews, settings, avgRating, totalCount, err := h.Service.GetApprovedReviews()
	if err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, fiber.Map{
		"reviews":         reviews,
		"show_star_rating": settings.ShowStarRating,
		"average_rating":  avgRating,
		"total_reviews":   totalCount,
	})
}

// ════════════════════════════════════════════
// USER REVIEW SUBMISSION (authenticated)
// ════════════════════════════════════════════

// SubmitReview creates a new user review (pending moderation).
// @Summary      Submit a review
// @Tags         content
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body  object  true  "Review data"
// @Success      201  {object}  response.Envelope
// @Router       /api/content/reviews [post]
func (h *Handler) SubmitReview(c *fiber.Ctx) error {
	var req struct {
		StarRating   int    `json:"star_rating"`
		ReviewText   string `json:"review_text"`
		ReviewerName string `json:"reviewer_name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Validate
	if req.StarRating < 1 || req.StarRating > 5 {
		return response.BadRequest(c, "Star rating must be between 1 and 5")
	}
	if len(req.ReviewText) < 10 || len(req.ReviewText) > 300 {
		return response.BadRequest(c, "Review text must be between 10 and 300 characters")
	}
	if len(req.ReviewerName) < 2 || len(req.ReviewerName) > 100 {
		return response.BadRequest(c, "Reviewer name must be between 2 and 100 characters")
	}

	userID, _ := uuid.Parse(c.Locals("user_id").(string))

	// Determine user's current plan for auto-approve check
	var userPlan string
	var sub models.Subscription
	if err := h.DB.Preload("Plan").Where("user_id = ? AND status = ?", userID, models.SubActive).First(&sub).Error; err == nil {
		userPlan = string(sub.Plan.Tier)
	}

	// Get user avatar
	var user models.User
	h.DB.Where("id = ?", userID).First(&user)

	review := &models.Review{
		UserID:           &userID,
		ReviewerName:     req.ReviewerName,
		ReviewerAvatarURL: user.AvatarURL,
		PlanAtReview:     &userPlan,
		StarRating:       req.StarRating,
		ReviewText:       req.ReviewText,
	}

	if err := h.Service.SubmitReview(review, userPlan); err != nil {
		return response.InternalError(c)
	}

	return response.Created(c, review)
}

// ════════════════════════════════════════════
// ADMIN CMS ROUTES
// ════════════════════════════════════════════

func (h *Handler) getAdminID(c *fiber.Ctx) uuid.UUID {
	id, _ := uuid.Parse(c.Locals("user_id").(string))
	return id
}

// AdminGetHero returns the hero section for admin editing.
func (h *Handler) AdminGetHero(c *fiber.Ctx) error {
	section, err := h.Service.GetSection("hero", cache.KeyContentHero)
	if err != nil {
		return response.NotFound(c, "Hero section not found")
	}
	return response.Success(c, section)
}

// UpdateHero updates the hero section content.
// @Summary      Update hero section
// @Tags         admin
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Success      200  {object}  response.Envelope
// @Router       /api/admin/content/hero [put]
func (h *Handler) UpdateHero(c *fiber.Ctx) error {
	var req struct {
		EN           json.RawMessage `json:"en"`
		BN           json.RawMessage `json:"bn"`
		HeroImageURL string          `json:"hero_image_url"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	adminID := h.getAdminID(c)
	if err := h.Service.UpdateSection("hero", models.JSON(req.EN), models.JSON(req.BN), adminID, cache.KeyContentHero); err != nil {
		return response.InternalError(c)
	}

	audit.LogAudit(h.DB, adminID, audit.AuditContentUpdate, "hero", map[string]interface{}{"section": "hero"}, c.IP(), c.Get("User-Agent"))

	return response.Success(c, fiber.Map{"message": "Hero section updated"})
}

// AdminGetBanner returns the banner section for admin editing.
func (h *Handler) AdminGetBanner(c *fiber.Ctx) error {
	section, err := h.Service.GetSection("banner", cache.KeyContentBanner)
	if err != nil {
		return response.NotFound(c, "Banner not found")
	}
	return response.Success(c, section)
}

// UpdateBanner updates the announcement banner.
// @Summary      Update announcement banner
// @Tags         admin
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Success      200  {object}  response.Envelope
// @Router       /api/admin/content/banner [put]
func (h *Handler) UpdateBanner(c *fiber.Ctx) error {
	var req struct {
		EN       json.RawMessage `json:"en"`
		BN       json.RawMessage `json:"bn"`
		Color    string          `json:"color"`
		IsActive bool            `json:"is_active"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Merge color and is_active into content JSON
	enMap := make(map[string]interface{})
	json.Unmarshal(req.EN, &enMap)
	enMap["color"] = req.Color
	enMap["is_active"] = req.IsActive
	mergedEN, _ := json.Marshal(enMap)

	bnMap := make(map[string]interface{})
	json.Unmarshal(req.BN, &bnMap)
	bnMap["color"] = req.Color
	bnMap["is_active"] = req.IsActive
	mergedBN, _ := json.Marshal(bnMap)

	adminID := h.getAdminID(c)
	if err := h.Service.UpdateSection("banner", models.JSON(mergedEN), models.JSON(mergedBN), adminID, cache.KeyContentBanner); err != nil {
		return response.InternalError(c)
	}

	audit.LogAudit(h.DB, adminID, audit.AuditContentUpdate, "banner", map[string]interface{}{"section": "banner", "is_active": req.IsActive}, c.IP(), c.Get("User-Agent"))

	return response.Success(c, fiber.Map{"message": "Banner updated"})
}

// AdminGetFAQ returns the FAQ for admin editing.
func (h *Handler) AdminGetFAQ(c *fiber.Ctx) error {
	section, err := h.Service.GetSection("faq", cache.KeyContentFAQ)
	if err != nil {
		return response.NotFound(c, "FAQ not found")
	}
	return response.Success(c, section)
}

// UpdateFAQ updates the FAQ section.
// @Summary      Update FAQ section
// @Tags         admin
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Success      200  {object}  response.Envelope
// @Router       /api/admin/content/faq [put]
func (h *Handler) UpdateFAQ(c *fiber.Ctx) error {
	var req struct {
		Items json.RawMessage `json:"items"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	enContent, _ := json.Marshal(map[string]json.RawMessage{"items": req.Items})
	bnContent := enContent // FAQ items contain both lang keys inline

	adminID := h.getAdminID(c)
	if err := h.Service.UpdateSection("faq", models.JSON(enContent), models.JSON(bnContent), adminID, cache.KeyContentFAQ); err != nil {
		return response.InternalError(c)
	}

	audit.LogAudit(h.DB, adminID, audit.AuditContentUpdate, "faq", map[string]interface{}{"section": "faq"}, c.IP(), c.Get("User-Agent"))

	return response.Success(c, fiber.Map{"message": "FAQ updated"})
}

// ════════════════════════════════════════════
// ADMIN REVIEW MODERATION ROUTES
// ════════════════════════════════════════════

// AdminListReviews returns reviews with optional status filter for admin moderation.
// @Summary      List reviews for moderation
// @Tags         admin
// @Security     BearerAuth
// @Produce      json
// @Param        status  query  string  false  "Filter by status"
// @Param        page    query  int     false  "Page number"
// @Param        limit   query  int     false  "Items per page"
// @Success      200  {object}  response.Envelope
// @Router       /api/admin/content/reviews [get]
func (h *Handler) AdminListReviews(c *fiber.Ctx) error {
	status := c.Query("status", "")
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 20)
	if limit > 100 {
		limit = 100
	}

	reviews, total, err := h.Service.Repo.GetReviewsByStatus(status, page, limit)
	if err != nil {
		return response.InternalError(c)
	}

	totalPages := int(total) / limit
	if int(total)%limit > 0 {
		totalPages++
	}

	return response.SuccessWithMeta(c, reviews, response.PaginationMeta{
		Page: page, PerPage: limit, Total: total, TotalPages: totalPages,
	})
}

// ApproveReview approves a review and sets it to show on landing page.
// @Summary      Approve a review
// @Tags         admin
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id   path  string  true  "Review ID"
// @Success      200  {object}  response.Envelope
// @Router       /api/admin/content/reviews/{id}/approve [put]
func (h *Handler) ApproveReview(c *fiber.Ctx) error {
	reviewID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid review ID")
	}

	var req struct {
		EditText *string `json:"edit_text"`
	}
	c.BodyParser(&req)

	adminID := h.getAdminID(c)
	review, err := h.Service.ApproveReview(reviewID, req.EditText, adminID)
	if err != nil {
		return response.NotFound(c, "Review not found")
	}

	audit.LogAudit(h.DB, adminID, audit.AuditReviewApprove, reviewID.String(), map[string]interface{}{"review_id": reviewID}, c.IP(), c.Get("User-Agent"))

	return response.Success(c, review)
}

// RejectReview rejects a review.
// @Summary      Reject a review
// @Tags         admin
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id   path  string  true  "Review ID"
// @Success      200  {object}  response.Envelope
// @Router       /api/admin/content/reviews/{id}/reject [put]
func (h *Handler) RejectReview(c *fiber.Ctx) error {
	reviewID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid review ID")
	}

	var req struct {
		AdminNote string `json:"admin_note"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	adminID := h.getAdminID(c)
	review, err := h.Service.RejectReview(reviewID, req.AdminNote, adminID)
	if err != nil {
		return response.NotFound(c, "Review not found")
	}

	audit.LogAudit(h.DB, adminID, audit.AuditReviewReject, reviewID.String(), map[string]interface{}{"review_id": reviewID, "note": req.AdminNote}, c.IP(), c.Get("User-Agent"))

	return response.Success(c, review)
}

// ReorderReviews updates display order for reviews.
// @Summary      Reorder reviews
// @Tags         admin
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Success      200  {object}  response.Envelope
// @Router       /api/admin/content/reviews/reorder [put]
func (h *Handler) ReorderReviews(c *fiber.Ctx) error {
	var req struct {
		OrderedIDs []string `json:"ordered_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	uuids := make([]uuid.UUID, len(req.OrderedIDs))
	for i, id := range req.OrderedIDs {
		parsed, err := uuid.Parse(id)
		if err != nil {
			return response.BadRequest(c, "Invalid review ID: "+id)
		}
		uuids[i] = parsed
	}

	if err := h.Service.Repo.UpdateReviewOrders(uuids); err != nil {
		return response.InternalError(c)
	}

	h.Service.invalidateReviewsCache()
	return response.Success(c, fiber.Map{"message": "Reviews reordered"})
}

// AdminEditReview allows admin to edit any review field.
// @Summary      Edit a review
// @Tags         admin
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id   path  string  true  "Review ID"
// @Success      200  {object}  response.Envelope
// @Router       /api/admin/content/reviews/{id} [put]
func (h *Handler) AdminEditReview(c *fiber.Ctx) error {
	reviewID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid review ID")
	}

	review, err := h.Service.Repo.GetReviewByID(reviewID)
	if err != nil {
		return response.NotFound(c, "Review not found")
	}

	var req struct {
		ReviewText    *string `json:"review_text"`
		StarRating    *int    `json:"star_rating"`
		ShowOnLanding *bool   `json:"show_on_landing"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if req.ReviewText != nil {
		review.ReviewText = *req.ReviewText
	}
	if req.StarRating != nil {
		if *req.StarRating < 1 || *req.StarRating > 5 {
			return response.BadRequest(c, "Star rating must be between 1 and 5")
		}
		review.StarRating = *req.StarRating
	}
	if req.ShowOnLanding != nil {
		review.ShowOnLanding = *req.ShowOnLanding
	}

	if err := h.Service.Repo.UpdateReview(review); err != nil {
		return response.InternalError(c)
	}

	adminID := h.getAdminID(c)
	audit.LogAudit(h.DB, adminID, audit.AuditReviewUpdate, reviewID.String(), map[string]interface{}{"updates": req}, c.IP(), c.Get("User-Agent"))

	h.Service.invalidateReviewsCache()
	return response.Success(c, review)
}

// DeleteReview hard-deletes a review.
// @Summary      Delete a review
// @Tags         admin
// @Security     BearerAuth
// @Produce      json
// @Param        id   path  string  true  "Review ID"
// @Success      200  {object}  response.Envelope
// @Router       /api/admin/content/reviews/{id} [delete]
func (h *Handler) DeleteReview(c *fiber.Ctx) error {
	reviewID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid review ID")
	}

	if err := h.Service.Repo.DeleteReview(reviewID); err != nil {
		return response.InternalError(c)
	}

	adminID := h.getAdminID(c)
	audit.LogAudit(h.DB, adminID, audit.AuditReviewDelete, reviewID.String(), map[string]interface{}{}, c.IP(), c.Get("User-Agent"))

	h.Service.invalidateReviewsCache()
	return response.Success(c, fiber.Map{"message": "Review deleted"})
}

// GetReviewSettings returns global review settings.
// @Summary      Get review settings
// @Tags         admin
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  response.Envelope
// @Router       /api/admin/content/reviews/settings [get]
func (h *Handler) GetReviewSettings(c *fiber.Ctx) error {
	settings, err := h.Service.Repo.GetReviewSettings()
	if err != nil {
		return response.InternalError(c)
	}
	return response.Success(c, settings)
}

// UpdateReviewSettings updates global review settings.
// @Summary      Update review settings
// @Tags         admin
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Success      200  {object}  response.Envelope
// @Router       /api/admin/content/reviews/settings [put]
func (h *Handler) UpdateReviewSettings(c *fiber.Ctx) error {
	var req struct {
		AutoApprovePremium  *bool `json:"auto_approve_premium"`
		ShowStarRating      *bool `json:"show_star_rating"`
		MinStarToShow       *int  `json:"min_star_to_show"`
		MaxReviewsOnLanding *int  `json:"max_reviews_on_landing"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	settings, err := h.Service.Repo.GetReviewSettings()
	if err != nil {
		return response.InternalError(c)
	}

	if req.AutoApprovePremium != nil {
		settings.AutoApprovePremium = *req.AutoApprovePremium
	}
	if req.ShowStarRating != nil {
		settings.ShowStarRating = *req.ShowStarRating
	}
	if req.MinStarToShow != nil {
		settings.MinStarToShow = *req.MinStarToShow
	}
	if req.MaxReviewsOnLanding != nil {
		settings.MaxReviewsOnLanding = *req.MaxReviewsOnLanding
	}

	if err := h.Service.Repo.UpdateReviewSettings(settings); err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, settings)
}
