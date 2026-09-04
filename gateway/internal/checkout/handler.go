package checkout

import (
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
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

type CheckoutRequest struct {
	CustomerName    string `json:"customer_name" validate:"required"`
	CustomerPhone   string `json:"customer_phone" validate:"required"`
	CustomerAddress string `json:"customer_address" validate:"required"`
	PaymentMethod   string `json:"payment_method" validate:"required"`
}

type OrderItemRequest struct {
	ProductID string  `json:"product_id"`
	Quantity  int     `json:"quantity"`
	Price     float64 `json:"price"`
}

// Checkout converts cart to order
func (h *Handler) Checkout(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	var req CheckoutRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	// Get user's cart
	var cart models.Cart
	err := h.DB.Where("user_id = ? AND expires_at > ?", userID, time.Now()).
		Preload("CartItems.Product").
		First(&cart).Error

	if err == gorm.ErrRecordNotFound {
		return response.BadRequest(c, "Cart not found or expired")
	} else if err != nil {
		return response.InternalError(c)
	}

	if len(cart.CartItems) == 0 {
		return response.BadRequest(c, "Cart is empty")
	}

	// Get user's shop (for order)
	var shop models.Shop
	err = h.DB.Where("user_id = ?", userID).First(&shop).Error
	if err != nil {
		return response.BadRequest(c, "Shop not found. Please create a shop first.")
	}

	// Convert cart items to order items format
	orderItemsData := make([]map[string]interface{}, 0, len(cart.CartItems))
	totalAmount := 0.0

	for _, cartItem := range cart.CartItems {
		orderItem := map[string]interface{}{
			"product_id": cartItem.ProductID,
			"quantity":   cartItem.Quantity,
			"price":      cartItem.Product.Price,
		}
		orderItemsData = append(orderItemsData, orderItem)
		totalAmount += float64(cartItem.Quantity) * cartItem.Product.Price
	}

	// Convert to JSON for OrderItems field
	orderItemsJSON, err := json.Marshal(orderItemsData)
	if err != nil {
		return response.InternalError(c)
	}

	// Create order
	order := models.Order{
		ShopID:          shop.ID,
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

	if err := h.DB.Create(&order).Error; err != nil {
		return response.InternalError(c)
	}

	// Update product stock
	for _, cartItem := range cart.CartItems {
		var product models.Product
		if err := h.DB.First(&product, cartItem.ProductID).Error; err == nil {
			product.CurrentStock -= cartItem.Quantity
			if product.CurrentStock < 0 {
				product.CurrentStock = 0
				product.IsOutOfStock = true
			}
			h.DB.Save(&product)
		}
	}

	// Clear cart
	h.DB.Where("cart_id = ?", cart.ID).Delete(&models.CartItem{})

	// Reload order with relations
	h.DB.Preload("Shop").First(&order, order.ID)

	return response.Success(c, order)
}
