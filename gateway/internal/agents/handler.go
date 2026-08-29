package agents

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"bytes"
	"fmt"
	"net/http"

	"github.com/xeni-ai/gateway/internal/auth"
	"github.com/xeni-ai/gateway/internal/cache"
	"github.com/xeni-ai/gateway/internal/config"
	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/internal/notifications"
	"github.com/xeni-ai/gateway/internal/rabbitmq"
	"github.com/xeni-ai/gateway/internal/storage"
	"github.com/xeni-ai/gateway/internal/websocket"
	"github.com/xeni-ai/gateway/pkg/response"
)

// Handler holds agent handler dependencies.
type Handler struct {
	DB       *gorm.DB
	Redis    *cache.Client
	RabbitMQ *rabbitmq.Client
	WSHub    *websocket.Hub
	Config   *config.Config
	NotifSvc *notifications.Service
	Spaces   *storage.SpacesClient
}

// NewHandler creates a new agent handler.
func NewHandler(db *gorm.DB, redis *cache.Client, rmq *rabbitmq.Client, wsHub *websocket.Hub, cfg *config.Config, notifSvc *notifications.Service, spaces *storage.SpacesClient) *Handler {
	return &Handler{DB: db, Redis: redis, RabbitMQ: rmq, WSHub: wsHub, Config: cfg, NotifSvc: notifSvc, Spaces: spaces}
}

// RunAgent handles POST /:agent-slug/run — submits a new task.
func (h *Handler) RunAgent(c *fiber.Ctx) error {
	agentSlug := c.Params("slug")
	userID := c.Locals("user_id").(string)

	// Validate agent type
	agentType, ok := models.AgentSlugToType[agentSlug]
	if !ok {
		return response.NotFound(c, "Agent not found")
	}

	// Check subscription access
	subInfo, err := auth.GetUserSubscription(h.DB, h.Redis, userID)
	if err != nil {
		slog.Error("failed to get user subscription", "user_id", userID, "error", err)
		return response.InternalError(c)
	}

	// Check agent access
	hasAccess := false
	for _, a := range subInfo.Agents {
		if a == string(agentType) {
			hasAccess = true
			break
		}
	}
	if !hasAccess {
		return response.UpgradeRequired(c, getRequiredPlan(agentType))
	}

	// Check daily task limit
	if subInfo.MaxTasksPerDay > 0 {
		uid, _ := uuid.Parse(userID)
		var todayCount int64
		today := time.Now().Truncate(24 * time.Hour)
		h.DB.Model(&models.AgentTask{}).Where("user_id = ? AND created_at >= ?", uid, today).Count(&todayCount)

		if int(todayCount) >= subInfo.MaxTasksPerDay {
			return response.Forbidden(c, "Daily task limit reached. Upgrade your plan for more.")
		}
	}

	// Parse payload
	var payload map[string]interface{}
	if err := c.BodyParser(&payload); err != nil {
		payload = make(map[string]interface{})
	}

	// Enrich payload for creative agent
	if agentType == models.AgentCreative {
		if pidStr, ok := payload["product_id"].(string); ok && pidStr != "" {
			pid, err := uuid.Parse(pidStr)
			if err == nil {
				var product models.Product
				if err := h.DB.Select("name, price").First(&product, "id = ?", pid).Error; err == nil {
					payload["product_name"] = product.Name
					payload["price"] = product.Price
				} else {
					slog.Warn("failed to fetch product for enrichment", "product_id", pidStr, "error", err)
				}
			} else {
				slog.Warn("invalid product_id provided for enrichment", "product_id", pidStr)
			}
		}
	}

	// Create task record
	uid, _ := uuid.Parse(userID)
	taskID := uuid.New()
	task := models.AgentTask{
		UserID:    uid,
		AgentType: agentType,
		TaskID:    taskID,
		Status:    models.TaskQueued,
		Result:    models.JSON("{}"), // Explicitly initialize
	}
	if err := h.DB.Create(&task).Error; err != nil {
		slog.Error("failed to create agent task in DB", 
			"error", err, 
			"user_id", userID, 
			"agent_type", agentType,
			"task_id", taskID,
		)
		return response.InternalError(c)
	}

	// Get the routing key for this agent
	routingKey, ok := models.AgentTypeToQueue[agentType]
	if !ok {
		slog.Error("missing routing key for agent type", "agent_type", agentType)
		return c.Status(500).JSON(fiber.Map{"success": false, "error": "Invalid agent configuration"})
	}

	// Publish to RabbitMQ
	msg := &rabbitmq.TaskMessage{
		TaskID:     taskID.String(),
		UserID:     userID,
		AgentType:  routingKey,
		Priority:   5,
		RetryCount: 0,
		CreatedAt:  time.Now().UTC().Format(time.RFC3339),
		Payload:    payload,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if h.RabbitMQ == nil {
		slog.Error("RabbitMQ client is nil — cannot dispatch agent task", "task_id", taskID)
		h.DB.Model(&task).Update("status", models.TaskFailed)
		return c.Status(500).JSON(fiber.Map{"success": false, "error": "Agent processing service is temporarily unavailable. Please try again later."})
	}

	if err := h.RabbitMQ.PublishTask(ctx, msg); err != nil {
		slog.Error("failed to publish task to RabbitMQ", "task_id", taskID, "error", err)
		h.DB.Model(&task).Update("status", models.TaskFailed)
		return response.InternalError(c)
	}

	return response.Created(c, map[string]interface{}{
		"task_id":    taskID,
		"agent_type": agentType,
		"status":     "queued",
	})
}

// GetTasks returns user's task history for an agent.
func (h *Handler) GetTasks(c *fiber.Ctx) error {
	agentSlug := c.Params("slug")
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	agentType, ok := models.AgentSlugToType[agentSlug]
	if !ok {
		return response.NotFound(c, "Agent not found")
	}

	page := c.QueryInt("page", 1)
	perPage := c.QueryInt("per_page", 20)
	if perPage > 100 {
		perPage = 100
	}

	var tasks []models.AgentTask
	var total int64

	query := h.DB.Where("user_id = ? AND agent_type = ?", uid, agentType)
	query.Model(&models.AgentTask{}).Count(&total)
	query.Order("created_at DESC").Offset((page - 1) * perPage).Limit(perPage).Find(&tasks)

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	return response.SuccessWithMeta(c, tasks, response.PaginationMeta{
		Page:       page,
		PerPage:    perPage,
		Total:      total,
		TotalPages: totalPages,
	})
}

// GetTask returns a specific task's status and result.
func (h *Handler) GetTask(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)
	taskID := c.Params("taskId")
	tid, err := uuid.Parse(taskID)
	if err != nil {
		return response.BadRequest(c, "Invalid task ID")
	}

	var task models.AgentTask
	if err := h.DB.Where("task_id = ? AND user_id = ?", tid, uid).First(&task).Error; err != nil {
		return response.NotFound(c, "Task not found")
	}

	return response.Success(c, task)
}

// DeleteTask deletes a task result.
func (h *Handler) DeleteTask(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)
	taskID := c.Params("taskId")
	tid, err := uuid.Parse(taskID)
	if err != nil {
		return response.BadRequest(c, "Invalid task ID")
	}

	result := h.DB.Where("task_id = ? AND user_id = ?", tid, uid).Delete(&models.AgentTask{})
	if result.RowsAffected == 0 {
		return response.NotFound(c, "Task not found")
	}

	return response.Success(c, map[string]string{"message": "Task deleted successfully"})
}

// HandleResult processes a result message from RabbitMQ and updates the task.
func (h *Handler) HandleResult(result rabbitmq.ResultMessage) error {
	tid, _ := uuid.Parse(result.TaskID)

	updates := map[string]interface{}{
		"status":      result.Status,
		"duration_ms": result.DurationMs,
	}

	if result.MongoDocID != "" {
		updates["mongo_doc_id"] = result.MongoDocID
	}

	if result.Summary != "" {
		updates["summary"] = result.Summary
	}

	if result.Data != nil {
		dataBytes, _ := json.Marshal(result.Data)
		updates["result"] = models.JSON(dataBytes)
	}

	// ── Handle Automated Actions ──
	if result.Status == "completed" && result.Data != nil {
		action, _ := result.Data["action"].(string)
		
		// 1. Send AI reply back to customer
		if reply, ok := result.Data["reply"].(string); ok && reply != "" {
			psid, _ := result.Data["customer_psid"].(string)
			pageID, _ := result.Data["page_id"].(string)
			
			var page models.ConnectedPage
			if err := h.DB.Where("page_id = ?", pageID).First(&page).Error; err == nil {
				h.sendMessengerMessage(psid, reply, page.PageAccessToken)
				
				// Save outbound message to DB
				if convIDStr, ok := result.Data["conversation_id"].(string); ok {
					if convID, err := uuid.Parse(convIDStr); err == nil {
						h.DB.Create(&models.Message{
							ConversationID: convID,
							Direction:      models.DirectionOutbound,
							SenderType:     models.SenderAI,
							ContentType:    models.ContentText,
							ContentText:    &reply,
							SentAt:         time.Now(),
						})
					}
				}
			}
		}

		// 2. Finalize Order if requested
		if action == "finalize_order" {
			orderData, ok := result.Data["order_details"].(map[string]interface{})
			if ok {
				h.createOrderFromAI(result, orderData)
			}
		}

		// 2b. Fallback: if AI returned order_details but forgot the action field, still create the order
		if action == "" || action == "null" {
			if orderData, ok := result.Data["order_details"].(map[string]interface{}); ok && len(orderData) > 0 {
				slog.Warn("AI returned order_details without action=finalize_order — applying fallback", "task_id", result.TaskID)
				h.createOrderFromAI(result, orderData)
			}
		}

		// 3. Verify Payment via Screenshot (OCR)
		if action == "verify_payment_screenshot" {
			go h.handleVerifyPaymentScreenshot(result)
		}

		// 4. Verify Payment via TrxID (Manual/API)
		if action == "verify_payment_trxid" {
			go h.handleVerifyPaymentTrxID(result)
		}
	}

	if result.Error != nil {
		updates["error_message"] = *result.Error
		
		// If task failed and notification service is available, alert Super Admins
		if result.Status == "failed" && h.NotifSvc != nil {
			h.NotifSvc.SendSystemFailureAlert(result.AgentType, *result.Error)
		}
	}

	now := time.Now()
	updates["completed_at"] = &now

	h.DB.Model(&models.AgentTask{}).Where("task_id = ?", tid).Updates(updates)

	// If the AI Worker processed an order successfully, update the real Order table
	if result.AgentType == "order" && result.Status == "completed" && result.Data != nil {
		// Handle payment verification results
		if verifyAction, ok := result.Data["verify_action"].(string); ok && verifyAction != "" {
			h.handlePaymentVerificationResult(result)
		} else if orderIDStr, ok := result.Data["order_id"].(string); ok && orderIDStr != "" {
			if orderID, err := uuid.Parse(orderIDStr); err == nil {
				orderUpdates := make(map[string]interface{})
				if ps, ok := result.Data["payment_status"].(string); ok && ps != "" {
					orderUpdates["payment_status"] = ps
				}
				if ds, ok := result.Data["delivery_status"].(string); ok && ds != "" {
					orderUpdates["delivery_status"] = ds
				}
				if tn, ok := result.Data["tracking_number"].(string); ok && tn != "" {
					orderUpdates["tracking_number"] = tn
				}
				if cn, ok := result.Data["courier_name"].(string); ok && cn != "" {
					orderUpdates["courier_name"] = cn
				}
				if cb, ok := result.Data["courier_booking"].(map[string]interface{}); ok {
					if cbBytes, err := json.Marshal(cb); err == nil {
						orderUpdates["courier_booking_response"] = cbBytes
					}
				}

				if len(orderUpdates) > 0 {
					h.DB.Model(&models.Order{}).Where("id = ?", orderID).Updates(orderUpdates)
					slog.Info("Order updated by AI Agent", "order_id", orderIDStr, "updates", orderUpdates)
				}
			}
		}
	}

	// Send WebSocket notification
	taskIDStr := result.TaskID
	h.WSHub.SendToUser(result.UserID, websocket.Event{
		EventType: "task." + result.Status,
		TaskID:    &taskIDStr,
		Payload: map[string]interface{}{
			"agent_type":  result.AgentType,
			"summary":     result.Summary,
			"duration_ms": result.DurationMs,
			"data":        result.Data,
		},
	})

	return nil
}

func (h *Handler) createOrderFromAI(result rabbitmq.ResultMessage, details map[string]interface{}) {
	slog.Info("Finalizing order from AI conversation", "task_id", result.TaskID, "details", details)
	
	shopIDStr, _ := result.Data["shop_id"].(string)
	sid, _ := uuid.Parse(shopIDStr)
	customerPSID, _ := result.Data["customer_psid"].(string) // Extract PSID for checking duplicates and tracking
	
	name, _ := details["customer_name"].(string)
	phone, _ := details["customer_phone"].(string)
	addr, _ := details["customer_address"].(string)

	slog.Info("AI order customer info", "name", name, "phone", phone, "address", addr, "psid", customerPSID, "shop_id", shopIDStr)
	
	// Duplicate Order Prevention (V5)
	// Check if this same customer already has a pending order in this shop to prevent duplicate submissions
	var existingPending models.Order
	if customerPSID != "" {
		if err := h.DB.Where("shop_id = ? AND customer_psid = ? AND payment_status = ?", sid, customerPSID, models.OrderPayPending).First(&existingPending).Error; err == nil {
			slog.Warn("Duplicate order attempt detected (pending order already exists)", "shop_id", sid, "customer_psid", customerPSID, "order_id", existingPending.ID)
			return // Skip creating a new one
		}
	}

	order := models.Order{
		ShopID:          sid,
		CustomerPSID:    &customerPSID, // Store PSID (V4)
		CustomerName:    &name,
		CustomerPhone:   &phone,
		CustomerAddress: &addr,
		PaymentStatus:   models.OrderPayPending,
		DeliveryStatus:  models.DeliveryPending,
		PlacedBy:        models.PlacedByAI,
	}

	items, ok := details["items"].([]interface{})
	if !ok || len(items) == 0 {
		slog.Warn("AI order has no items or items format is invalid — creating order with AI-provided total",
			"items_raw", details["items"], "task_id", result.TaskID)
		// Still create the order with AI-provided total so it appears in dashboard
		aiTotal, _ := details["total"].(float64)
		order.TotalAmount = aiTotal
		if err := h.DB.Create(&order).Error; err != nil {
			slog.Error("Failed to create AI order (no items)", "error", err)
		} else {
			slog.Info("AI order created (no verified items, using AI total)", "order_id", order.ID, "total", aiTotal)
		}
		return
	}

	var verifiedItems []map[string]interface{}
	serverCalculatedTotal := 0.0

	tx := h.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	for idx, it := range items {
		item, ok := it.(map[string]interface{})
		if !ok {
			slog.Warn("AI order item is not a map, skipping", "index", idx, "raw", it)
			continue
		}
		
		pidStr, _ := item["product_id"].(string)
		pid, pidErr := uuid.Parse(pidStr)
		if pidErr != nil {
			slog.Warn("AI order item has invalid product_id", "index", idx, "product_id", pidStr)
			continue
		}
		qty := 1
		if q, ok := item["quantity"].(float64); ok { qty = int(q) }

		// SECURITY ENSURANCE: Verify Product actually belongs to this Shop
		var prod models.Product
		if err := tx.Preload("Variants").Where("id = ? AND shop_id = ?", pid, sid).First(&prod).Error; err != nil {
			slog.Warn("SECURITY_ALERT: AI processed a product not belonging to this shop or product not found", "product_id", pidStr, "shop_id", shopIDStr, "error", err)
			continue 
		}

		slog.Info("AI order item verification", "index", idx, "product", prod.Name, "price", prod.Price, "has_variants", prod.HasVariants, "current_stock", prod.CurrentStock, "qty", qty)

		// Price Calculation & Stock Check (V2 & V3)
		correctItemPrice := prod.Price

		// Check AI-provided price BEFORE overriding for manipulation alert
		if aiPrice, ok := item["price"].(float64); ok && aiPrice != correctItemPrice {
			slog.Warn("SECURITY_ALERT: Price discrepancy detected!", "product", prod.Name, "ai_price", aiPrice, "correct_price", correctItemPrice, "psid", customerPSID)
		}
		
		if vidStr, ok := item["variant_id"].(string); ok && vidStr != "" {
			vid, _ := uuid.Parse(vidStr)
			var variant models.ProductVariant
			if err := tx.Where("id = ? AND product_id = ?", vid, pid).First(&variant).Error; err != nil {
				slog.Warn("SECURITY_ALERT: Invalid variant ID", "variant_id", vidStr, "error", err)
				continue
			}

			if variant.Stock < qty {
				slog.Warn("SECURITY_ALERT: Stock overflow attempt (Variant)", "requested", qty, "available", variant.Stock)
				continue // Reject over-ordering
			}

			correctItemPrice += variant.PriceModifier
			if err := tx.Model(&models.ProductVariant{}).Where("id = ? AND stock >= ?", vid, qty).Update("stock", gorm.Expr("stock - ?", qty)).Error; err != nil {
				slog.Error("Failed to update variant stock", "error", err)
				continue
			}
			tx.Model(&models.Product{}).Where("id = ?", pid).Update("total_sold", gorm.Expr("total_sold + ?", qty))
		} else if prod.HasVariants && len(prod.Variants) > 0 {
			// AI didn't provide variant_id but product has variants — pick first variant with stock
			slog.Info("AI did not provide variant_id for variant product, auto-selecting first available variant", "product", prod.Name)
			found := false
			for _, v := range prod.Variants {
				if v.Stock >= qty {
					correctItemPrice += v.PriceModifier
					if err := tx.Model(&models.ProductVariant{}).Where("id = ? AND stock >= ?", v.ID, qty).Update("stock", gorm.Expr("stock - ?", qty)).Error; err != nil {
						slog.Error("Failed to update auto-selected variant stock", "error", err)
						continue
					}
					tx.Model(&models.Product{}).Where("id = ?", pid).Update("total_sold", gorm.Expr("total_sold + ?", qty))
					item["variant_id"] = v.ID.String()
					found = true
					slog.Info("Auto-selected variant", "variant_id", v.ID, "color", v.Color, "size", v.Size, "stock", v.Stock)
					break
				}
			}
			if !found {
				slog.Warn("No variant with sufficient stock for variant product", "product", prod.Name, "requested", qty)
				continue
			}
		} else {
			if prod.CurrentStock < qty {
				slog.Warn("SECURITY_ALERT: Stock overflow attempt (Product)", "product", prod.Name, "requested", qty, "available", prod.CurrentStock)
				continue // Reject over-ordering
			}

			if err := tx.Model(&models.Product{}).Where("id = ? AND current_stock >= ?", pid, qty).Updates(map[string]interface{}{
				"current_stock": gorm.Expr("current_stock - ?", qty),
				"total_sold":   gorm.Expr("total_sold + ?", qty),
			}).Error; err != nil {
				slog.Error("Failed to update product stock", "error", err)
				continue
			}
		}

		// Calculate correct subtotal
		serverCalculatedTotal += correctItemPrice * float64(qty)
		
		// Store the verified values for DB insertion, discarding AI price
		item["price"] = correctItemPrice 
		verifiedItems = append(verifiedItems, item)
	}

	if len(verifiedItems) == 0 {
		slog.Warn("Order creation aborted: no valid items remained after verification", "task_id", result.TaskID)
		tx.Rollback()
		return
	}

	b, _ := json.Marshal(verifiedItems)
	order.OrderItems = b
	order.TotalAmount = serverCalculatedTotal // V2: Set to DB-calculated total

	// AI Total Discrepancy Alert
	aiTotal, _ := details["total"].(float64)
	if aiTotal != serverCalculatedTotal {
		slog.Warn("SECURITY_ALERT: Order Total manipulation detected!", "ai_total", aiTotal, "server_total", serverCalculatedTotal, "psid", customerPSID)
	}

	if err := tx.Create(&order).Error; err == nil {
		tx.Commit()
		slog.Info("Automated order created securely", "order_id", order.ID, "total", serverCalculatedTotal, "items_count", len(verifiedItems))
	} else {
		slog.Error("Failed to create verified order", "error", err)
		tx.Rollback()
	}
}

func (h *Handler) sendMessengerMessage(psid, text, token string) {
	url := fmt.Sprintf("https://graph.facebook.com/v21.0/me/messages?access_token=%s", token)
	payload := map[string]interface{}{
		"recipient": map[string]string{"id": psid},
		"message":   map[string]string{"text": text},
	}
	
	b, _ := json.Marshal(payload)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(b))
	if err != nil {
		slog.Error("failed to send messenger reply", "error", err)
		return
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != 200 {
		var errData map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errData)
		slog.Error("messenger api returned error", "status", resp.StatusCode, "data", errData)
	}
}

// getRequiredPlan returns the minimum plan required for an agent.
func getRequiredPlan(agentType models.AgentType) string {
	switch agentType {
	case models.AgentConversation:
		return "starter"
	case models.AgentOrder, models.AgentInventory:
		return "professional"
	case models.AgentCreative, models.AgentIntelligence:
		return "premium"
	default:
		return "professional"
	}
}

// SubscriptionAccessMiddleware is a convenience for checking plan access for agent routes.
func (h *Handler) SubscriptionAccessMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Access check happens in RunAgent, so just pass through for listing
		return c.Next()
	}
}

// ── Payment Verification Handlers ──

// handleVerifyPaymentScreenshot uploads screenshot to S3 and dispatches OCR task to OrderAgent.
func (h *Handler) handleVerifyPaymentScreenshot(result rabbitmq.ResultMessage) {
	screenshotURL, _ := result.Data["screenshot_url"].(string)
	customerPSID, _ := result.Data["customer_psid"].(string)
	shopIDStr, _ := result.Data["shop_id"].(string)
	pageID, _ := result.Data["page_id"].(string)
	convIDStr, _ := result.Data["conversation_id"].(string)

	if screenshotURL == "" {
		slog.Warn("verify_payment_screenshot: no screenshot URL provided")
		return
	}

	// Upload screenshot from Messenger CDN to permanent S3 storage
	var s3URL string
	if h.Spaces != nil {
		destPath := fmt.Sprintf("payment-screenshots/%s/%d.jpg", shopIDStr, time.Now().UnixMilli())
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		uploaded, err := h.Spaces.UploadFromURL(ctx, screenshotURL, destPath)
		if err != nil {
			slog.Error("failed to upload screenshot to S3", "error", err)
			s3URL = screenshotURL // Fallback to Messenger CDN URL
		} else {
			s3URL = uploaded
		}
	} else {
		s3URL = screenshotURL
	}

	// Find the pending order for this customer
	sid, _ := uuid.Parse(shopIDStr)
	var pendingOrder models.Order
	h.DB.Where("shop_id = ? AND customer_psid = ? AND payment_status = ?",
		sid, customerPSID, models.OrderPayPending).Order("created_at DESC").First(&pendingOrder)

	if pendingOrder.ID == uuid.Nil {
		slog.Warn("verify_payment_screenshot: no pending order found", "psid", customerPSID)
		return
	}

	// Save screenshot URL to the order immediately
	h.DB.Model(&pendingOrder).Update("payment_screenshot_url", s3URL)

	// Dispatch to OrderAgent for OCR verification
	h.dispatchPaymentVerification(map[string]interface{}{
		"verify_action":    "screenshot_ocr",
		"screenshot_url":   s3URL,
		"order_id":         pendingOrder.ID.String(),
		"expected_amount":  pendingOrder.TotalAmount,
		"customer_psid":    customerPSID,
		"shop_id":          shopIDStr,
		"page_id":          pageID,
		"conversation_id":  convIDStr,
	})
}

// handleVerifyPaymentTrxID dispatches TrxID verification task to OrderAgent.
func (h *Handler) handleVerifyPaymentTrxID(result rabbitmq.ResultMessage) {
	trxID, _ := result.Data["trx_id"].(string)
	paymentMethod, _ := result.Data["payment_method"].(string)
	customerPSID, _ := result.Data["customer_psid"].(string)
	shopIDStr, _ := result.Data["shop_id"].(string)
	pageID, _ := result.Data["page_id"].(string)
	convIDStr, _ := result.Data["conversation_id"].(string)

	if trxID == "" {
		slog.Warn("verify_payment_trxid: no TrxID provided")
		return
	}

	// Find the pending order for this customer
	sid, _ := uuid.Parse(shopIDStr)
	var pendingOrder models.Order
	h.DB.Where("shop_id = ? AND customer_psid = ? AND payment_status = ?",
		sid, customerPSID, models.OrderPayPending).Order("created_at DESC").First(&pendingOrder)

	if pendingOrder.ID == uuid.Nil {
		slog.Warn("verify_payment_trxid: no pending order found — notifying customer and shop owner", "psid", customerPSID, "trx_id", trxID)

		// Reply to customer asking them to confirm order first
		if pageID != "" && customerPSID != "" {
			var page models.ConnectedPage
			if err := h.DB.Where("page_id = ?", pageID).First(&page).Error; err == nil {
				reply := "ধন্যবাদ ট্রানজেকশন আইডি পাঠানোর জন্য! তবে আপনার অর্ডার এখনো তৈরি হয়নি। দয়া করে আগে 'Order Confirm' লিখে অর্ডার কনফার্ম করুন, তারপর TrxID পাঠাবেন। 🙏"
				h.sendMessengerMessage(customerPSID, reply, page.PageAccessToken)

				// Save outbound message
				if convIDStr != "" {
					if convID, err := uuid.Parse(convIDStr); err == nil {
						h.DB.Create(&models.Message{
							ConversationID: convID,
							Direction:      models.DirectionOutbound,
							SenderType:     models.SenderAI,
							ContentType:    models.ContentText,
							ContentText:    &reply,
							SentAt:         time.Now(),
						})
					}
				}
			}
		}

		// Also notify shop owner via WhatsApp about the orphan TrxID
		if h.NotifSvc != nil {
			h.NotifSvc.SendPaymentAlert(sid, trxID, "(unknown - no order)", 0, true)
		}
		return
	}

	// Save TrxID to the order immediately
	h.DB.Model(&pendingOrder).Update("payment_trx_id", trxID)

	// Fetch shop's payment API credentials
	var shop models.Shop
	h.DB.First(&shop, sid)

	payload := map[string]interface{}{
		"verify_action":   "trxid_check",
		"trx_id":          trxID,
		"payment_method":  paymentMethod,
		"order_id":        pendingOrder.ID.String(),
		"expected_amount": pendingOrder.TotalAmount,
		"customer_psid":   customerPSID,
		"shop_id":         shopIDStr,
		"page_id":         pageID,
		"conversation_id": convIDStr,
		"payment_verification_mode": shop.PaymentVerificationMode,
	}

	// Include API credentials if shop has them configured
	if shop.BkashAppKey != nil && *shop.BkashAppKey != "" {
		payload["bkash_app_key"] = *shop.BkashAppKey
	}
	if shop.BkashAppSecret != nil && *shop.BkashAppSecret != "" {
		payload["bkash_app_secret"] = *shop.BkashAppSecret
	}
	if shop.NagadMerchantID != nil && *shop.NagadMerchantID != "" {
		payload["nagad_merchant_id"] = *shop.NagadMerchantID
	}
	if shop.NagadMerchantKey != nil && *shop.NagadMerchantKey != "" {
		payload["nagad_merchant_key"] = *shop.NagadMerchantKey
	}

	h.dispatchPaymentVerification(payload)
}

// dispatchPaymentVerification sends a payment verification task to the OrderAgent via RabbitMQ.
func (h *Handler) dispatchPaymentVerification(payload map[string]interface{}) {
	if h.RabbitMQ == nil {
		slog.Error("RabbitMQ nil — cannot dispatch payment verification")
		return
	}

	taskID := uuid.New()
	msg := &rabbitmq.TaskMessage{
		TaskID:    taskID.String(),
		UserID:    "",
		AgentType: "order",
		Priority:  10,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		Payload:   payload,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := h.RabbitMQ.PublishTask(ctx, msg); err != nil {
		slog.Error("failed to dispatch payment verification task", "error", err)
	} else {
		slog.Info("Payment verification task dispatched", "task_id", taskID, "action", payload["verify_action"])
	}
}

// handlePaymentVerificationResult processes the OrderAgent's payment verification result.
func (h *Handler) handlePaymentVerificationResult(result rabbitmq.ResultMessage) {
	orderIDStr, _ := result.Data["order_id"].(string)
	paymentStatus, _ := result.Data["payment_status"].(string)
	trxID, _ := result.Data["extracted_trx_id"].(string)
	customerPSID, _ := result.Data["customer_psid"].(string)
	pageID, _ := result.Data["page_id"].(string)
	convIDStr, _ := result.Data["conversation_id"].(string)
	shopIDStr, _ := result.Data["shop_id"].(string)
	verifiedBy, _ := result.Data["verified_by"].(string)

	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		slog.Error("invalid order_id in payment verification result", "order_id", orderIDStr)
		return
	}

	now := time.Now()
	orderUpdates := map[string]interface{}{
		"payment_status": paymentStatus,
	}

	if trxID != "" {
		orderUpdates["payment_trx_id"] = trxID
	}
	if verifiedBy != "" {
		orderUpdates["verified_by"] = verifiedBy
	}

	// Determine Messenger reply and next steps
	var messengerReply string

	switch paymentStatus {
	case "verified":
		orderUpdates["verified_at"] = &now
		messengerReply = fmt.Sprintf("✅ আপনার পেমেন্ট নিশ্চিত হয়েছে! অর্ডার #%s প্রসেস হচ্ছে। শীঘ্রই ডেলিভারি ব্যবস্থা করা হবে। 🚚", orderIDStr[:8])

		sid, _ := uuid.Parse(shopIDStr)
		var shop models.Shop
		h.DB.First(&shop, sid)

		var order models.Order
		h.DB.First(&order, orderID)

		// Send WebSocket alert to seller dashboard
		h.WSHub.SendToUser(shop.UserID.String(), websocket.Event{
			EventType: "payment.confirmed",
			Payload: map[string]interface{}{
				"order_id":      orderIDStr,
				"customer_name": order.CustomerName,
				"amount":        order.TotalAmount,
			},
		})

		// Send WhatsApp notification to shop owner about auto-verified payment
		if h.NotifSvc != nil {
			custName := ""
			if order.CustomerName != nil {
				custName = *order.CustomerName
			}
			h.NotifSvc.SendPaymentAlert(sid, orderIDStr[:8], custName, order.TotalAmount, false)
		}

		// Trigger courier booking with full credentials
		go h.triggerCourierBooking(&order, &shop)

	case "manual_required":
		messengerReply = "ধন্যবাদ! স্ক্রিনশটটি দেখছি। আমরা যাচাই করে শীঘ্রই নিশ্চিত করব। সাধারণত ১৫ মিনিটের মধ্যে confirm হয়। 🙏"

		// Send WebSocket alert to seller dashboard
		sid, _ := uuid.Parse(shopIDStr)
		var shop models.Shop
		h.DB.First(&shop, sid)

		var order models.Order
		h.DB.First(&order, orderID)

		h.WSHub.SendToUser(shop.UserID.String(), websocket.Event{
			EventType: "payment.manual_review",
			Payload: map[string]interface{}{
				"order_id":      orderIDStr,
				"trx_id":        trxID,
				"customer_name": order.CustomerName,
				"amount":        order.TotalAmount,
				"screenshot_url": order.PaymentScreenshotURL,
			},
		})

		// Send WhatsApp notification to shop owner for manual review
		if h.NotifSvc != nil {
			custName := ""
			if order.CustomerName != nil {
				custName = *order.CustomerName
			}
			h.NotifSvc.SendPaymentAlert(sid, orderIDStr[:8], custName, order.TotalAmount, true)
		}

	case "failed":
		messengerReply = "দুঃখিত, পেমেন্ট verify করা যায়নি। সঠিক Transaction ID বা screenshot পাঠান দয়া করে। 🙏"
	}

	// Update database
	h.DB.Model(&models.Order{}).Where("id = ?", orderID).Updates(orderUpdates)
	slog.Info("Payment verification result processed", "order_id", orderIDStr, "status", paymentStatus)

	// Send Messenger reply
	if messengerReply != "" && customerPSID != "" && pageID != "" {
		var page models.ConnectedPage
		if err := h.DB.Where("page_id = ?", pageID).First(&page).Error; err == nil {
			h.sendMessengerMessage(customerPSID, messengerReply, page.PageAccessToken)

			// Save outbound message to DB
			if convID, err := uuid.Parse(convIDStr); err == nil {
				h.DB.Create(&models.Message{
					ConversationID: convID,
					Direction:      models.DirectionOutbound,
					SenderType:     models.SenderAI,
					ContentType:    models.ContentText,
					ContentText:    &messengerReply,
					SentAt:         time.Now(),
				})
			}
		}
	}
}

// ── Helper for JSON response from MongoDB result ──

type AgentResult struct {
	TaskID      string          `json:"task_id"`
	AgentType   string          `json:"agent_type"`
	Status      string          `json:"status"`
	Input       json.RawMessage `json:"input"`
	Result      json.RawMessage `json:"result"`
	ReportURL   *string         `json:"s3_report_url"`
	CreatedAt   string          `json:"created_at"`
	CompletedAt *string         `json:"completed_at"`
}

// triggerCourierBooking dispatches a courier booking task if the shop has delivery API credentials,
// otherwise sends a WhatsApp notification to the shop owner for manual booking.
func (h *Handler) triggerCourierBooking(order *models.Order, shop *models.Shop) {
	hasDeliveryAPI := false

	if shop.CourierPreference == "steadfast" && shop.SteadfastAPIKey != nil && *shop.SteadfastAPIKey != "" {
		hasDeliveryAPI = true
	} else if shop.PathaoClientID != nil && *shop.PathaoClientID != "" {
		hasDeliveryAPI = true
	}

	phone := ""
	if order.CustomerPhone != nil {
		phone = *order.CustomerPhone
	}
	address := ""
	if order.CustomerAddress != nil {
		address = *order.CustomerAddress
	}

	if hasDeliveryAPI {
		// Dispatch to AI Order worker for courier booking
		payload := map[string]interface{}{
			"action":           "book_courier",
			"order_id":         order.ID.String(),
			"amount":           order.TotalAmount,
			"customer_phone":   phone,
			"customer_address": address,
			"shop_id":          shop.ID.String(),
			"courier_preference": shop.CourierPreference,
		}

		// Include courier credentials
		if shop.PathaoClientID != nil {
			payload["pathao_client_id"] = *shop.PathaoClientID
		}
		if shop.PathaoClientSecret != nil {
			payload["pathao_client_secret"] = *shop.PathaoClientSecret
		}
		if shop.PathaoUsername != nil {
			payload["pathao_username"] = *shop.PathaoUsername
		}
		if shop.PathaoPassword != nil {
			payload["pathao_password"] = *shop.PathaoPassword
		}
		if shop.SteadfastAPIKey != nil {
			payload["steadfast_api_key"] = *shop.SteadfastAPIKey
		}
		if shop.SteadfastSecretKey != nil {
			payload["steadfast_secret_key"] = *shop.SteadfastSecretKey
		}

		taskID := uuid.New()
		msg := &rabbitmq.TaskMessage{
			TaskID:    taskID.String(),
			UserID:    shop.UserID.String(),
			AgentType: "order",
			Priority:  1,
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
			Payload:   payload,
		}

		if h.RabbitMQ != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := h.RabbitMQ.PublishTask(ctx, msg); err != nil {
				slog.Error("failed to dispatch courier booking task", "error", err, "order_id", order.ID)
			} else {
				slog.Info("Courier booking task dispatched", "task_id", taskID, "order_id", order.ID)
			}
		}
	} else {
		// No delivery API — send WhatsApp notification to shop owner for manual booking
		slog.Info("No delivery API configured — notifying shop owner for manual courier booking", "shop_id", shop.ID, "order_id", order.ID)

		if h.NotifSvc != nil {
			custName := ""
			if order.CustomerName != nil {
				custName = *order.CustomerName
			}
			h.NotifSvc.SendDeliveryManualAlert(shop.ID, order.ID.String()[:8], custName, address, order.TotalAmount)
		}

		// Also send WebSocket event so dashboard shows it
		h.WSHub.SendToUser(shop.UserID.String(), websocket.Event{
			EventType: "delivery.manual_required",
			Payload: map[string]interface{}{
				"order_id":         order.ID.String(),
				"customer_name":    order.CustomerName,
				"customer_address": address,
				"amount":           order.TotalAmount,
			},
		})
	}
}

