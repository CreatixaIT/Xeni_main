package messenger

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/xeni-ai/gateway/internal/config"
	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/internal/rabbitmq"
)

// Handler holds messenger webhook dependencies.
type Handler struct {
	DB       *gorm.DB
	Config   *config.Config
	RabbitMQ *rabbitmq.Client
}

// NewHandler creates a new messenger webhook handler.
func NewHandler(db *gorm.DB, cfg *config.Config, rmq *rabbitmq.Client) *Handler {
	return &Handler{DB: db, Config: cfg, RabbitMQ: rmq}
}

// WebhookVerify handles GET /api/webhooks/messenger — Meta webhook verification.
func (h *Handler) WebhookVerify(c *fiber.Ctx) error {
	mode := c.Query("hub.mode")
	token := c.Query("hub.verify_token")
	challenge := c.Query("hub.challenge")

	if mode == "subscribe" && token == h.Config.Meta.WebhookVerifyToken {
		slog.Info("Messenger webhook verified")
		return c.SendString(challenge)
	}

	return c.Status(403).SendString("Verification failed")
}

// WebhookReceive handles POST /api/webhooks/messenger — receive messages from Meta.
func (h *Handler) WebhookReceive(c *fiber.Ctx) error {
	body := c.Body()
	slog.Info("raw webhook received", "path", c.Path(), "body_len", len(body))

	// Validate X-Hub-Signature-256
	signature := c.Get("X-Hub-Signature-256")

	if h.Config.Meta.AppSecret != "" && !h.verifySignature(body, signature) {
		slog.Warn("Invalid messenger webhook signature")
		return c.SendStatus(403)
	}

	var webhook WebhookPayload
	if err := json.Unmarshal(body, &webhook); err != nil {
		slog.Error("failed to parse webhook payload", "error", err)
		return c.SendStatus(200) // Always return 200 to Meta
	}

	// DEBUG: Log incoming webhook for troubleshooting
	slog.Info("incoming messenger webhook", "object", webhook.Object, "entries", len(webhook.Entry))

	// Process each entry
	for _, entry := range webhook.Entry {
		pageID := entry.ID
		// Process Messenger Inbox
		for _, messaging := range entry.Messaging {
			if messaging.Message != nil {
				go h.handleIncomingMessage(pageID, messaging)
			}
		}
		// Process Feed Changes (Comments)
		for _, change := range entry.Changes {
			slog.Info("webhook change detected", "field", change.Field, "item", change.Value.Item, "verb", change.Value.Verb)
			
			if change.Field == "feed" && change.Value.Item == "comment" && (change.Value.Verb == "add" || change.Value.Verb == "created") {
				// Ignore if the page itself made the comment
				if change.Value.From.ID != pageID {
					slog.Info("processing valid comment", "comment_id", change.Value.CommentID, "from", change.Value.From.Name)
					go h.handleIncomingComment(pageID, change)
				} else {
					slog.Debug("ignoring self-comment from page", "page_id", pageID)
				}
			}
		}
	}

	// Always return 200 quickly — Meta will retry on non-200
	return c.SendStatus(200)
}

func (h *Handler) handleIncomingMessage(pageID string, event MessagingEvent) {
	senderPSID := event.Sender.ID

	// Find the connected page
	var page models.ConnectedPage
	if err := h.DB.Where("page_id = ? AND is_active = true", pageID).First(&page).Error; err != nil {
		slog.Warn("received message for unconnected page", "page_id", pageID)
		return
	}

	// Find or create conversation
	var conv models.Conversation
	err := h.DB.Where("page_id = ? AND customer_psid = ?", pageID, senderPSID).First(&conv).Error
	if err == gorm.ErrRecordNotFound {
		// Try to fetch customer name from Graph API
		customerName := senderPSID
		reqURL := fmt.Sprintf("https://graph.facebook.com/v21.0/%s?fields=first_name,last_name&access_token=%s", senderPSID, page.PageAccessToken)
		if resp, err := http.Get(reqURL); err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == 200 {
				var fbUser map[string]interface{}
				if err := json.NewDecoder(resp.Body).Decode(&fbUser); err == nil {
					firstName, _ := fbUser["first_name"].(string)
					lastName, _ := fbUser["last_name"].(string)
					if firstName != "" {
						customerName = firstName + " " + lastName
					}
				}
			}
		}

		conv = models.Conversation{
			ShopID:       page.ShopID,
			PageID:       pageID,
			CustomerPSID: senderPSID,
			CustomerName: &customerName,
			Status:       models.ConversationOpen,
			HandlingMode: models.HandlingModeAI,
		}
		h.DB.Create(&conv)
	}

	// Extract message content
	var contentText *string
	var contentType models.MessageContentType = models.ContentText
	var contentURL *string

	if event.Message.Text != "" {
		contentText = &event.Message.Text
	}
	if len(event.Message.Attachments) > 0 {
		att := event.Message.Attachments[0]
		if att.Type == "image" {
			contentType = models.ContentImage
			contentURL = &att.Payload.URL
		} else if att.Type == "audio" {
			contentType = models.ContentAudio
			contentURL = &att.Payload.URL
		}
	}

	// Save message (with deduplication via messenger_mid)
	mid := event.Message.MID
	msg := models.Message{
		ConversationID: conv.ID,
		Direction:      models.DirectionInbound,
		SenderType:     models.SenderCustomer,
		ContentType:    contentType,
		ContentText:    contentText,
		ContentURL:     contentURL,
		MessengerMID:   &mid,
	}
	if err := h.DB.Create(&msg).Error; err != nil {
		slog.Error("failed to save message (possible duplicate)", "mid", mid, "error", err)
		return
	}

	// Update conversation metadata
	preview := ""
	if contentText != nil {
		preview = *contentText
		if len(preview) > 100 {
			preview = preview[:100] + "..."
		}
	} else {
		preview = "[" + string(contentType) + "]"
	}
	now := time.Now()
	h.DB.Model(&conv).Updates(map[string]interface{}{
		"last_message_preview": preview,
		"last_message_at":      &now,
		"unread_count":         gorm.Expr("unread_count + 1"),
	})

	// If conversation is in AI mode, dispatch to conversation worker via RabbitMQ
	if conv.HandlingMode == models.HandlingModeAI && h.RabbitMQ != nil {
		// Fetch active shop and global rules
		var adminRules []models.AgentRule
		var storeRules []models.AgentRule
		
		h.DB.Where("scope = ? AND is_active = ?", models.RuleScopeGlobal, true).Order("priority ASC").Find(&adminRules)
		h.DB.Where("scope = ? AND shop_id = ? AND is_active = ?", models.RuleScopeShop, page.ShopID, true).Order("priority ASC").Find(&storeRules)

		// Fetch the shop for payment settings
		var shop models.Shop
		h.DB.First(&shop, page.ShopID)

		// Fetch most recent pending order for this customer
		var pendingOrder models.Order
		h.DB.Where("shop_id = ? AND customer_psid = ? AND payment_status = ?", 
			page.ShopID, senderPSID, models.OrderPayPending).Order("created_at DESC").First(&pendingOrder)

		globalRules := ""
		for _, r := range adminRules {
			globalRules += "- [" + r.Category + "] " + r.Title + ": " + r.Rule + "\n"
		}
		
		shopRules := ""
		for _, r := range storeRules {
			shopRules += "- [" + r.Category + "] " + r.Title + ": " + r.Rule + "\n"
		}

		// Fetch product catalog to give accurate info to AI
		var products []models.Product
		h.DB.Preload("Variants").Where("shop_id = ? AND is_active = true", page.ShopID).Find(&products)
		
		var catalog []map[string]interface{}
		for _, p := range products {
			item := map[string]interface{}{
				"id":           p.ID.String(),
				"name":         p.Name,
				"price":        p.Price,
				"has_variants": p.HasVariants,
				"sku":          p.SKU,
				"stock":        p.CurrentStock,
			}

			if p.HasVariants && len(p.Variants) > 0 {
				vars := []map[string]interface{}{}
				for _, v := range p.Variants {
					vars = append(vars, map[string]interface{}{
						"id":             v.ID.String(),
						"sku":            v.SKU,
						"color":          v.Color,
						"size":           v.Size,
						"stock":          v.Stock,
						"price_modifier": v.PriceModifier,
					})
				}
				item["variants"] = vars
			}
			catalog = append(catalog, item)
		}

		// Fetch conversation history (last 10 messages)
		var recentMessages []models.Message
		h.DB.Where("conversation_id = ?", conv.ID).Order("sent_at DESC").Limit(10).Find(&recentMessages)
		
		// Reverse to make it chronological
		for i, j := 0, len(recentMessages)-1; i < j; i, j = i+1, j-1 {
			recentMessages[i], recentMessages[j] = recentMessages[j], recentMessages[i]
		}

		var history []map[string]interface{}
		for _, m := range recentMessages {
			sender := "customer"
			if m.Direction == models.DirectionOutbound {
				sender = string(m.SenderType) // "ai" or "human"
			}
			text := ""
			if m.ContentText != nil { text = *m.ContentText }
			history = append(history, map[string]interface{}{
				"sender": sender,
				"text":   text,
			})
		}

		taskID := uuid.New()
		taskMsg := &rabbitmq.TaskMessage{
			TaskID:    taskID.String(),
			UserID:    "", // Will be resolved via shop
			AgentType: "conversation",
			Priority:  10, // High priority for real-time conversations
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
			Payload: map[string]interface{}{
				"conversation_id":   conv.ID.String(),
				"shop_id":           page.ShopID.String(),
				"page_id":           pageID,
				"page_access_token": page.PageAccessToken,
				"customer_psid":     senderPSID,
				"message_text":      contentText,
				"message_type":      string(contentType),
				"message_url":       contentURL,
				"catalog":           catalog,
				"history":           history,
				"global_rules":      globalRules,
				"shop_rules":        shopRules,
				"shop_settings": map[string]interface{}{
					"shop_name":                  shop.ShopName,
					"bkash_number":               shop.BkashMerchantNumber,
					"nagad_number":               shop.NagadMerchantNumber,
					"preferred_language":         shop.PreferredLanguage,
					"payment_verification_mode":  shop.PaymentVerificationMode,
					"district":                   shop.District,
					"delivery_charge_inside":     shop.DeliveryChargeInside,
					"delivery_charge_outside":    shop.DeliveryChargeOutside,
				},
				"active_order": func() interface{} {
					if pendingOrder.ID == uuid.Nil {
						return nil
					}
					return map[string]interface{}{
						"order_id":       pendingOrder.ID.String(),
						"total_amount":   pendingOrder.TotalAmount,
						"payment_status": pendingOrder.PaymentStatus,
					}
				}(),
			},
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := h.RabbitMQ.PublishTask(ctx, taskMsg); err != nil {
			slog.Error("failed to dispatch conversation task", "error", err)
		} else {
			slog.Info("conversation task dispatched", "task_id", taskID, "psid", senderPSID)
		}
	}
}

func (h *Handler) handleIncomingComment(pageID string, change WebhookChange) {
	senderPSID := change.Value.From.ID // For Feed, this is the App-Scoped User ID
	senderName := change.Value.From.Name

	// 1. Validate connection
	var page models.ConnectedPage
	if err := h.DB.Where("page_id = ? AND is_active = true", pageID).First(&page).Error; err != nil {
		slog.Warn("received comment for unconnected page", "page_id", pageID)
		return
	}

	// 2. Fetch Shop
	var shop models.Shop
	if err := h.DB.First(&shop, page.ShopID).Error; err != nil {
		return
	}

	// 3. Save comment to DB (optional initially, but good for persistence)
	comment := models.PostComment{
		ShopID:       shop.ID,
		PageID:       pageID,
		PostID:       change.Value.PostID,
		CommentID:    change.Value.CommentID,
		CustomerPSID: senderPSID,
		CustomerName: &senderName,
		Message:      change.Value.Message,
		ActionTaken:  models.ActionIgnored,
	}
	
	// Check for duplicate comment
	if err := h.DB.Create(&comment).Error; err != nil {
		slog.Error("failed to save comment (possible duplicate)", "comment_id", change.Value.CommentID, "error", err)
		return
	}

	// 4. Dispatch task to RabbitMQ for AI moderation
	if h.RabbitMQ != nil {
		// Fetch rules
		var adminRules []models.AgentRule
		var storeRules []models.AgentRule
		h.DB.Where("scope = ? AND is_active = ?", models.RuleScopeGlobal, true).Order("priority ASC").Find(&adminRules)
		h.DB.Where("scope = ? AND shop_id = ? AND is_active = ?", models.RuleScopeShop, page.ShopID, true).Order("priority ASC").Find(&storeRules)

		globalRules := ""
		for _, r := range adminRules {
			globalRules += "- [" + r.Category + "] " + r.Title + ": " + r.Rule + "\n"
		}
		shopRules := ""
		for _, r := range storeRules {
			shopRules += "- [" + r.Category + "] " + r.Title + ": " + r.Rule + "\n"
		}

		// Fetch products
		var products []models.Product
		h.DB.Where("shop_id = ? AND is_active = true", page.ShopID).Find(&products)
		
		var catalog []map[string]interface{}
		for _, p := range products {
			catalog = append(catalog, map[string]interface{}{
				"id":           p.ID.String(),
				"name":         p.Name,
				"price":        p.Price,
				"has_variants": p.HasVariants,
				"sku":          p.SKU,
				"stock":        p.CurrentStock,
			})
		}

		taskID := uuid.New()
		taskMsg := &rabbitmq.TaskMessage{
			TaskID:    taskID.String(),
			AgentType: "comment",
			Priority:  8, // Normal priority
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
			Payload: map[string]interface{}{
				"comment_db_id":     comment.ID.String(),
				"comment_id":        change.Value.CommentID,
				"post_id":           change.Value.PostID,
				"message":           change.Value.Message,
				"customer_name":     senderName,
				"customer_psid":     senderPSID,
				"shop_id":           page.ShopID.String(),
				"page_id":           pageID,
				"page_access_token": page.PageAccessToken,
				"catalog":           catalog,
				"global_rules":      globalRules,
				"shop_rules":        shopRules,
				"shop_name":         shop.ShopName,
			},
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := h.RabbitMQ.PublishTask(ctx, taskMsg); err != nil {
			slog.Error("failed to dispatch comment task", "error", err)
		} else {
			slog.Info("comment task dispatched", "task_id", taskID)
		}
	}
}

func (h *Handler) verifySignature(body []byte, signature string) bool {
	if len(signature) < 8 || signature[:7] != "sha256=" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(h.Config.Meta.AppSecret))
	mac.Write(body)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

// ── Webhook Payload Types ──

type WebhookPayload struct {
	Object string         `json:"object"`
	Entry  []WebhookEntry `json:"entry"`
}

type WebhookEntry struct {
	ID        string           `json:"id"`
	Time      int64            `json:"time"`
	Messaging []MessagingEvent `json:"messaging,omitempty"`
	Changes   []WebhookChange  `json:"changes,omitempty"`
}

type WebhookChange struct {
	Field string             `json:"field"`
	Value WebhookChangeValue `json:"value"`
}

type WebhookChangeValue struct {
	Item      string      `json:"item"`
	Verb      string      `json:"verb"`
	PostID    string      `json:"post_id,omitempty"`
	CommentID string      `json:"comment_id,omitempty"`
	Message   string      `json:"message,omitempty"`
	From      WebhookUser `json:"from,omitempty"`
}

type MessagingEvent struct {
	Sender    WebhookUser     `json:"sender"`
	Recipient WebhookUser     `json:"recipient"`
	Timestamp int64           `json:"timestamp"`
	Message   *WebhookMessage `json:"message,omitempty"`
}

type WebhookUser struct {
	ID   string `json:"id"`
	Name string `json:"name,omitempty"`
}

type WebhookMessage struct {
	MID         string              `json:"mid"`
	Text        string              `json:"text"`
	Attachments []WebhookAttachment `json:"attachments,omitempty"`
}

type WebhookAttachment struct {
	Type    string                   `json:"type"`
	Payload WebhookAttachmentPayload `json:"payload"`
}

type WebhookAttachmentPayload struct {
	URL string `json:"url"`
}
