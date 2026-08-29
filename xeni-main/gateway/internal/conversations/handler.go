package conversations

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/internal/notifications"
	"github.com/xeni-ai/gateway/pkg/response"
)

// Handler holds conversation dependencies.
type Handler struct {
	DB       *gorm.DB
	NotifSvc *notifications.Service
}

// NewHandler creates a new conversations handler.
func NewHandler(db *gorm.DB, notifSvc *notifications.Service) *Handler {
	return &Handler{DB: db, NotifSvc: notifSvc}
}

func (h *Handler) getUserShop(userID string) (*models.Shop, error) {
	uid, _ := uuid.Parse(userID)
	var shop models.Shop
	err := h.DB.Where("user_id = ?", uid).First(&shop).Error
	return &shop, err
}

// ListConversations handles GET /api/conversations.
func (h *Handler) ListConversations(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	shop, err := h.getUserShop(userID)
	if err != nil {
		return response.Success(c, []models.Conversation{})
	}

	page := c.QueryInt("page", 1)
	perPage := c.QueryInt("per_page", 20)
	status := c.Query("status", "open")

	if perPage > 100 {
		perPage = 100
	}

	query := h.DB.Where("shop_id = ?", shop.ID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Model(&models.Conversation{}).Count(&total)

	var conversations []models.Conversation
	query.Order("last_message_at DESC NULLS LAST").Offset((page - 1) * perPage).Limit(perPage).Find(&conversations)

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	return response.SuccessWithMeta(c, conversations, response.PaginationMeta{
		Page:       page,
		PerPage:    perPage,
		Total:      total,
		TotalPages: totalPages,
	})
}

// GetMessages handles GET /api/conversations/:id/messages.
func (h *Handler) GetMessages(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	shop, err := h.getUserShop(userID)
	if err != nil {
		return response.NotFound(c, "Shop not found")
	}

	cid, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid conversation ID")
	}

	var conv models.Conversation
	if err := h.DB.Where("id = ? AND shop_id = ?", cid, shop.ID).First(&conv).Error; err != nil {
		return response.NotFound(c, "Conversation not found")
	}

	// Mark as read
	h.DB.Model(&conv).Update("unread_count", 0)

	page := c.QueryInt("page", 1)
	perPage := c.QueryInt("per_page", 50)

	var total int64
	h.DB.Model(&models.Message{}).Where("conversation_id = ?", cid).Count(&total)

	var messages []models.Message
	h.DB.Where("conversation_id = ?", cid).
		Order("sent_at DESC").
		Offset((page - 1) * perPage).Limit(perPage).
		Find(&messages)

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	return response.SuccessWithMeta(c, map[string]interface{}{
		"conversation": conv,
		"messages":     messages,
	}, response.PaginationMeta{
		Page:       page,
		PerPage:    perPage,
		Total:      total,
		TotalPages: totalPages,
	})
}

// SendMessage handles POST /api/conversations/:id/messages — send a reply to customer.
func (h *Handler) SendMessage(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	shop, err := h.getUserShop(userID)
	if err != nil {
		return response.NotFound(c, "Shop not found")
	}

	cid, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid conversation ID")
	}

	var conv models.Conversation
	if err := h.DB.Where("id = ? AND shop_id = ?", cid, shop.ID).First(&conv).Error; err != nil {
		return response.NotFound(c, "Conversation not found")
	}

	var req struct {
		Text string `json:"text"`
	}
	if err := c.BodyParser(&req); err != nil || req.Text == "" {
		return response.BadRequest(c, "text is required")
	}

	// Fetch connected page to get access token
	var page models.ConnectedPage
	if err := h.DB.Where("page_id = ?", conv.PageID).First(&page).Error; err != nil {
		slog.Error("Failed to find connected page for sending message", "error", err)
		return response.InternalError(c)
	}

	fbPayload := map[string]interface{}{
		"recipient": map[string]string{"id": conv.CustomerPSID},
		"message":   map[string]string{"text": req.Text},
	}
	fbPayloadBytes, _ := json.Marshal(fbPayload)

	reqURL := fmt.Sprintf("https://graph.facebook.com/v21.0/me/messages?access_token=%s", page.PageAccessToken)
	resp, reqErr := http.Post(reqURL, "application/json", bytes.NewBuffer(fbPayloadBytes))
	if reqErr != nil {
		slog.Error("Failed to send message to Facebook", "error", reqErr)
	} else {
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			slog.Warn("Facebook returned non-200 status", "status", resp.StatusCode)
		}
	}

	msg := models.Message{
		ConversationID: conv.ID,
		Direction:      models.DirectionOutbound,
		SenderType:     models.SenderHuman,
		ContentType:    models.ContentText,
		ContentText:    &req.Text,
	}

	if err := h.DB.Create(&msg).Error; err != nil {
		return response.InternalError(c)
	}

	// Update conversation preview
	h.DB.Model(&conv).Updates(map[string]interface{}{
		"last_message_preview": req.Text,
		"last_message_at":      msg.SentAt,
	})

	return response.Created(c, msg)
}

// UpdateMode handles PUT /api/conversations/:id/mode — switch AI/human mode.
func (h *Handler) UpdateMode(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	shop, err := h.getUserShop(userID)
	if err != nil {
		return response.NotFound(c, "Shop not found")
	}

	cid, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid conversation ID")
	}

	var conv models.Conversation
	if err := h.DB.Where("id = ? AND shop_id = ?", cid, shop.ID).First(&conv).Error; err != nil {
		return response.NotFound(c, "Conversation not found")
	}

	var req struct {
		Mode string `json:"mode"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}
	if req.Mode != "ai" && req.Mode != "human" {
		return response.BadRequest(c, "mode must be 'ai' or 'human'")
	}

	h.DB.Model(&conv).Update("handling_mode", req.Mode)

	// If switched to human mode, trigger WhatsApp alert
	if req.Mode == "human" && h.NotifSvc != nil {
		customerName := "Customer"
		if conv.CustomerName != nil {
			customerName = *conv.CustomerName
		}
		h.NotifSvc.SendHumanFallbackAlert(conv.ShopID, customerName)
	}

	return response.Success(c, map[string]string{
		"message": "Conversation mode updated to " + req.Mode,
		"mode":    req.Mode,
	})
}

// GetConversationStats handles GET /api/conversations/stats.
func (h *Handler) GetConversationStats(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	shop, err := h.getUserShop(userID)
	if err != nil {
		return response.Success(c, map[string]int64{})
	}

	var totalOpen, totalResolved, totalUnread int64
	h.DB.Model(&models.Conversation{}).Where("shop_id = ? AND status = 'open'", shop.ID).Count(&totalOpen)
	h.DB.Model(&models.Conversation{}).Where("shop_id = ? AND status = 'resolved'", shop.ID).Count(&totalResolved)

	var humanInterventionNeeded int64
	h.DB.Model(&models.Conversation{}).Where("shop_id = ? AND status = 'open' AND handling_mode = 'human'", shop.ID).Count(&humanInterventionNeeded)

	var unreadResult struct{ Sum int64 }
	h.DB.Model(&models.Conversation{}).Where("shop_id = ? AND status = 'open'", shop.ID).Select("COALESCE(SUM(unread_count), 0) as sum").Scan(&unreadResult)
	totalUnread = unreadResult.Sum

	var messagesReplied, totalAIMessages int64
	h.DB.Model(&models.Message{}).
		Joins("JOIN conversations ON conversations.id = messages.conversation_id").
		Where("conversations.shop_id = ? AND messages.direction = 'outbound'", shop.ID).
		Count(&messagesReplied)

	h.DB.Model(&models.Message{}).
		Joins("JOIN conversations ON conversations.id = messages.conversation_id").
		Where("conversations.shop_id = ? AND messages.direction = 'outbound' AND messages.sender_type = 'ai'", shop.ID).
		Count(&totalAIMessages)

	return response.Success(c, map[string]interface{}{
		"open_conversations":        totalOpen,
		"resolved_conversations":    totalResolved,
		"messages_replied":          messagesReplied,
		"total_unread":              totalUnread,
		"human_intervention_needed": humanInterventionNeeded,
		"total_ai_messages":         totalAIMessages,
	})
}
