package buyer

import (
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/pkg/response"
)

type CheckoutRequest struct {
	CustomerName    string `json:"customer_name" validate:"required"`
	CustomerPhone   string `json:"customer_phone" validate:"required"`
	CustomerAddress string `json:"customer_address" validate:"required"`
	PaymentMethod   string `json:"payment_method" validate:"required"`
	SessionID       *string `json:"session_id,omitempty"`
}

type OrderItemRequest struct {
	ProductID string  `json:"product_id"`
	Quantity  int     `json:"quantity"`
	Price     float64 `json:"price"` // NOT used for validation, only for client display
}

type CheckoutResponse struct {
	Orders []models.Order `json:"orders"`
}

// Checkout converts cart to order with proper price validation and inventory locking
func (h *Handler) Checkout(c *fiber.Ctx) error {
	userID, hasUser := c.Locals("user_id").(string)
	sessionID := c.Query("session_id")

	var req CheckoutRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Validate payment method
	validPaymentMethods := map[string]bool{
		"bkash": true,
		"nagad": true,
		"cod":   true,
	}
	if !validPaymentMethods[req.PaymentMethod] {
		return response.BadRequest(c, "Invalid payment method")
	}

	// Get user's cart
	var cart models.Cart
	var err error

	if hasUser && userID != "" {
		userUUID := uuid.MustParse(userID)
		err = h.DB.Where("user_id = ? AND expires_at > ?", userUUID, time.Now()).
			Preload("CartItems.Product").
			First(&cart).Error
	} else if sessionID != "" {
		err = h.DB.Where("session_id = ? AND expires_at > ?", sessionID, time.Now()).
			Preload("CartItems.Product").
			First(&cart).Error
	} else {
		return response.Unauthorized(c, "Authentication required")
	}

	if err == gorm.ErrRecordNotFound {
		return response.BadRequest(c, "Cart not found or expired")
	} else if err != nil {
		return response.InternalError(c)
	}

	if len(cart.CartItems) == 0 {
		return response.BadRequest(c, "Cart is empty")
	}

	// Transaction: create orders with inventory locking
	var createdOrders []models.Order
	
	// Group cart items by shop for multi-store support
	shopGroups := make(map[uuid.UUID][]models.CartItem)
	for _, cartItem := range cart.CartItems {
		shopGroups[cartItem.Product.ShopID] = append(shopGroups[cartItem.Product.ShopID], cartItem)
	}

	// Process each shop group in a transaction
	for shopID, items := range shopGroups {
		err := h.DB.Transaction(func(tx *gorm.DB) error {
			// Step 1: Validate all products and retrieve current prices
			var shop models.Shop
			if err := tx.First(&shop, shopID).Error; err != nil {
				return err
			}

			// Step 2: Calculate totals with current prices
			orderItemsData := make([]map[string]interface{}, 0, len(items))
			totalAmount := 0.0

			for _, cartItem := range items {
				// Re-fetch product to get current price
				var product models.Product
				if err := tx.Where("id = ? AND is_active = ?", cartItem.ProductID, true).
					First(&product).Error; err != nil {
					return err
				}

				// Step 3: Validate inventory with locking
				// Use atomic conditional update to prevent race conditions
				result := tx.Model(&models.Product{}).
					Where("id = ? AND current_stock >= ?", product.ID, cartItem.Quantity).
					Update("current_stock", gorm.Expr("current_stock - ?", cartItem.Quantity))

				if result.RowsAffected == 0 {
					// Inventory insufficient or product changed
					return gorm.ErrRecordNotFound
				}

				// Step 4: Calculate with authoritative price
				itemTotal := float64(cartItem.Quantity) * product.Price
				totalAmount += itemTotal

				orderItem := map[string]interface{}{
					"product_id": cartItem.ProductID,
					"quantity":   cartItem.Quantity,
					"price":      product.Price, // Use authoritative price
				}
				orderItemsData = append(orderItemsData, orderItem)
			}

			// Step 5: Add delivery charge
			deliveryCharge := shop.DeliveryChargeInside // Default to inside district
			totalAmount += deliveryCharge

			// Step 6: Convert to JSON for OrderItems field
			orderItemsJSON, err := json.Marshal(orderItemsData)
			if err != nil {
				return err
			}

			// Step 7: Create order
			var buyerID *uuid.UUID
			if hasUser && userID != "" {
				buyerUUID := uuid.MustParse(userID)
				buyerID = &buyerUUID
			}

			order := models.Order{
				ShopID:          shopID,
				BuyerID:         buyerID,
				CustomerName:    &req.CustomerName,
				CustomerPhone:   &req.CustomerPhone,
				CustomerAddress: &req.CustomerAddress,
				OrderItems:      models.JSON(orderItemsJSON),
				TotalAmount:     totalAmount,
				PaymentMethod:   (*models.OrderPaymentMethod)(&req.PaymentMethod),
				PaymentStatus:   models.OrderPayPending,
				DeliveryStatus:  models.DeliveryPending,
				PlacedBy:        models.PlacedByHuman,
			}

			if err := tx.Create(&order).Error; err != nil {
				return err
			}

			// Step 8: Update product total_sold
			for _, cartItem := range items {
				tx.Model(&models.Product{}).
					Where("id = ?", cartItem.ProductID).
					UpdateColumn("total_sold", gorm.Expr("total_sold + ?", cartItem.Quantity))
			}

			createdOrders = append(createdOrders, order)
			return nil
		})

		if err != nil {
			if err == gorm.ErrRecordNotFound {
				return response.BadRequest(c, "Some items are no longer available or insufficient inventory")
			}
			return response.InternalError(c)
		}
	}

	// Step 9: Clear cart after successful checkout
	if err := h.DB.Where("cart_id = ?", cart.ID).Delete(&models.CartItem{}).Error; err != nil {
		// Log error but don't fail the response
		// Cart cleanup can be handled by background job
	}

	// Step 10: Reload orders with relations
	for i := range createdOrders {
		h.DB.Preload("Shop").First(&createdOrders[i], createdOrders[i].ID)
	}

	return response.Success(c, CheckoutResponse{Orders: createdOrders})
}

// GetBuyerOrders returns orders for the authenticated buyer
func (h *Handler) GetBuyerOrders(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return response.Unauthorized(c, "Authentication required")
	}

	userUUID := uuid.MustParse(userID)

	var orders []models.Order
	err := h.DB.Where("buyer_id = ?", userUUID).
		Preload("Shop").
		Order("created_at DESC").
		Find(&orders).Error

	if err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, orders)
}

// GetBuyerOrder returns a specific order for the authenticated buyer
func (h *Handler) GetBuyerOrder(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	if userID == "" {
		return response.Unauthorized(c, "Authentication required")
	}

	orderID := c.Params("id")
	orderUUID, err := uuid.Parse(orderID)
	if err != nil {
		return response.BadRequest(c, "Invalid order ID")
	}

	userUUID := uuid.MustParse(userID)

	var order models.Order
	err = h.DB.Where("id = ? AND buyer_id = ?", orderUUID, userUUID).
		Preload("Shop").
		First(&order).Error

	if err == gorm.ErrRecordNotFound {
		return response.NotFound(c, "Order not found")
	} else if err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, order)
}
