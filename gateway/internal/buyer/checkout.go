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
	CustomerName    string  `json:"customer_name" validate:"required"`
	CustomerPhone   string  `json:"customer_phone" validate:"required"`
	CustomerAddress string  `json:"customer_address" validate:"required"`
	PaymentMethod   string  `json:"payment_method" validate:"required"`
	SessionID       *string `json:"session_id,omitempty"`  // For guest checkout
	CheckoutID      *string `json:"checkout_id,omitempty"` // Idempotency key
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
		// Authenticated user: get cart by user_id
		userUUID := uuid.MustParse(userID)
		err = h.DB.Where("user_id = ? AND expires_at > ?", &userUUID, time.Now()).
			Preload("CartItems.Product").
			Preload("CartItems.Variant").
			First(&cart).Error
	} else if sessionID != "" {
		// Guest user: get cart by session_id
		err = h.DB.Where("session_id = ? AND expires_at > ?", sessionID, time.Now()).
			Preload("CartItems.Product").
			Preload("CartItems.Variant").
			First(&cart).Error
	} else {
		return response.Unauthorized(c, "Authentication or valid session required")
	}

	if err == gorm.ErrRecordNotFound {
		return response.BadRequest(c, "Cart not found or expired")
	} else if err != nil {
		return response.InternalError(c)
	}

	if len(cart.CartItems) == 0 {
		return response.BadRequest(c, "Cart is empty")
	}

	// Idempotency check: if checkout_id provided, check for existing order
	// Database-level unique constraint prevents duplicate checkout_id
	if req.CheckoutID != nil && *req.CheckoutID != "" {
		var existingOrder models.Order
		checkoutQuery := h.DB.Where("checkout_id = ?", *req.CheckoutID)
		if hasUser && userID != "" {
			userUUID := uuid.MustParse(userID)
			checkoutQuery = checkoutQuery.Where("buyer_id = ?", userUUID)
		}

		if err := checkoutQuery.First(&existingOrder).Error; err == nil {
			// Order already exists with this checkout_id
			// Return existing order to prevent duplicate submission
			h.DB.Preload("Shop").First(&existingOrder, existingOrder.ID)
			return response.Success(c, CheckoutResponse{Orders: []models.Order{existingOrder}})
		}
	}

	// Single transaction for entire checkout to ensure atomicity across all shops
	var createdOrders []models.Order
	err = h.DB.Transaction(func(tx *gorm.DB) error {
		// Group cart items by shop for multi-store support
		shopGroups := make(map[uuid.UUID][]models.CartItem)
		for _, cartItem := range cart.CartItems {
			shopGroups[cartItem.Product.ShopID] = append(shopGroups[cartItem.Product.ShopID], cartItem)
		}

		// Process each shop group
		for shopID, items := range shopGroups {
			// Step 1: Get shop for delivery charge
			var shop models.Shop
			if err := tx.First(&shop, shopID).Error; err != nil {
				return err
			}

			// Step 2: Validate all items and calculate totals
			orderItemsData := make([]map[string]interface{}, 0, len(items))
			totalAmount := 0.0

			for _, cartItem := range items {
				// Re-fetch product to get current authoritative data
				var product models.Product
				if err := tx.Where("id = ? AND is_active = ?", cartItem.ProductID, true).
					First(&product).Error; err != nil {
					return err
				}

				var unitPrice float64
				var oldStock int
				var newStock int

				if cartItem.VariantID != nil {
					// Variant product handling
					var variant models.ProductVariant
					if err := tx.Where("id = ? AND product_id = ? AND is_active = ?",
						*cartItem.VariantID, product.ID, true).First(&variant).Error; err != nil {
						return err
					}

					// Atomic variant stock decrement
					result := tx.Model(&models.ProductVariant{}).
						Where("id = ? AND stock >= ?", variant.ID, cartItem.Quantity).
						Update("stock", gorm.Expr("stock - ?", cartItem.Quantity))

					if result.RowsAffected == 0 {
						return gorm.ErrRecordNotFound // Insufficient variant stock
					}

					// Get updated stock for inventory log
					tx.Model(&models.ProductVariant{}).
						Where("id = ?", variant.ID).
						Pluck("stock", &newStock)
					oldStock = newStock + cartItem.Quantity

					// Authoritative price: product base + variant modifier
					unitPrice = product.Price + variant.PriceModifier

					// Create inventory log for variant
					refID := uuid.New().String()
					inventoryLog := models.InventoryLog{
						ProductID:   product.ID,
						VariantID:   cartItem.VariantID,
						Type:        models.MovementSale,
						Quantity:    -cartItem.Quantity,
						OldStock:    oldStock,
						NewStock:    newStock,
						ReferenceID: &refID,
					}
					if err := tx.Create(&inventoryLog).Error; err != nil {
						return err
					}

					// Build order item with variant info
					orderItem := map[string]interface{}{
						"product_id":   cartItem.ProductID,
						"variant_id":   *cartItem.VariantID,
						"quantity":     cartItem.Quantity,
						"price":        unitPrice,
						"product_name": product.Name,
						"variant_sku":  variant.SKU,
						"color":        variant.Color,
						"size":         variant.Size,
					}
					orderItemsData = append(orderItemsData, orderItem)
				} else {
					// Non-variant product handling
					if product.HasVariants {
						return gorm.ErrRecordNotFound // Variant required but not provided
					}

					// Atomic product stock decrement
					result := tx.Model(&models.Product{}).
						Where("id = ? AND current_stock >= ?", product.ID, cartItem.Quantity).
						Update("current_stock", gorm.Expr("current_stock - ?", cartItem.Quantity))

					if result.RowsAffected == 0 {
						return gorm.ErrRecordNotFound // Insufficient product stock
					}

					// Get updated stock for inventory log
					tx.Model(&models.Product{}).
						Where("id = ?", product.ID).
						Pluck("current_stock", &newStock)
					oldStock = newStock + cartItem.Quantity

					// Authoritative price: product base price only
					unitPrice = product.Price

					// Create inventory log for product
					refID := uuid.New().String()
					inventoryLog := models.InventoryLog{
						ProductID:   product.ID,
						VariantID:   nil,
						Type:        models.MovementSale,
						Quantity:    -cartItem.Quantity,
						OldStock:    oldStock,
						NewStock:    newStock,
						ReferenceID: &refID,
					}
					if err := tx.Create(&inventoryLog).Error; err != nil {
						return err
					}

					// Update product out-of-stock state
					isOutOfStock := newStock <= 0
					tx.Model(&models.Product{}).
						Where("id = ?", product.ID).
						Update("is_out_of_stock", isOutOfStock)

					// Build order item
					orderItem := map[string]interface{}{
						"product_id":   cartItem.ProductID,
						"variant_id":   nil,
						"quantity":     cartItem.Quantity,
						"price":        unitPrice,
						"product_name": product.Name,
					}
					orderItemsData = append(orderItemsData, orderItem)
				}

				// Increment product total_sold
				tx.Model(&models.Product{}).
					Where("id = ?", product.ID).
					UpdateColumn("total_sold", gorm.Expr("total_sold + ?", cartItem.Quantity))

				totalAmount += float64(cartItem.Quantity) * unitPrice
			}

			// Step 3: Add delivery charge
			deliveryCharge := shop.DeliveryChargeInside
			totalAmount += deliveryCharge

			// Step 4: Convert to JSON for OrderItems field
			orderItemsJSON, err := json.Marshal(orderItemsData)
			if err != nil {
				return err
			}

			// Step 5: Create order
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
				CheckoutID:      req.CheckoutID,
			}

			if err := tx.Create(&order).Error; err != nil {
				return err
			}

			// Step 6: Update inventory logs with actual order ID
			// Update logs for this shop's items
			for _, cartItem := range items {
				var logs []models.InventoryLog
				query := tx.Where("product_id = ?", cartItem.ProductID)
				if cartItem.VariantID != nil {
					query = query.Where("variant_id = ?", *cartItem.VariantID)
				} else {
					query = query.Where("variant_id IS NULL")
				}
				if err := query.Order("created_at DESC").Limit(len(items)).Find(&logs).Error; err != nil {
					return err
				}
				for i := range logs {
					tx.Model(&logs[i]).Update("reference_id", order.ID)
				}
			}

			// Step 7: Update product out-of-stock state for all affected products
			affectedProductIDs := make([]uuid.UUID, 0, len(items))
			for _, cartItem := range items {
				// Deduplicate product IDs
				alreadyAdded := false
				for _, pid := range affectedProductIDs {
					if pid == cartItem.ProductID {
						alreadyAdded = true
						break
					}
				}
				if !alreadyAdded {
					affectedProductIDs = append(affectedProductIDs, cartItem.ProductID)
				}
			}
			if err := h.BatchUpdateProductOutOfStock(tx, affectedProductIDs); err != nil {
				return err
			}

			createdOrders = append(createdOrders, order)
		}

		// Step 7: Clear cart items as part of the same transaction
		if err := tx.Where("cart_id = ?", cart.ID).Delete(&models.CartItem{}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return response.BadRequest(c, "Some items are no longer available or insufficient inventory")
		}
		return response.InternalError(c)
	}

	// Reload orders with relations
	for i := range createdOrders {
		h.DB.Preload("Shop").First(&createdOrders[i], createdOrders[i].ID)
	}

	return response.Success(c, CheckoutResponse{Orders: createdOrders})
}

// GetBuyerOrders returns orders for the authenticated buyer
func (h *Handler) GetBuyerOrders(c *fiber.Ctx) error {
	userID, hasUser := c.Locals("user_id").(string)
	if !hasUser || userID == "" {
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
	userID, hasUser := c.Locals("user_id").(string)
	if !hasUser || userID == "" {
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
