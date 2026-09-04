package cart

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
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

type CreateCartRequest struct {
	SessionID *string `json:"session_id,omitempty"`
}

type AddCartItemRequest struct {
	ProductID string `json:"product_id" validate:"required"`
	Quantity  int    `json:"quantity" validate:"required,min=1"`
}

type UpdateCartItemRequest struct {
	Quantity int `json:"quantity" validate:"required,min=0"`
}

// GetOrCreateCart gets an existing cart or creates a new one
func (h *Handler) GetOrCreateCart(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	sessionID := c.Query("session_id")

	var cart models.Cart
	var err error

	if userID != "" {
		// Authenticated user: get cart by user_id
		err = h.DB.Where("user_id = ? AND expires_at > ?", userID, time.Now()).
			Preload("CartItems.Product").
			First(&cart).Error
	} else if sessionID != "" {
		// Guest user: get cart by session_id
		err = h.DB.Where("session_id = ? AND expires_at > ?", sessionID, time.Now()).
			Preload("CartItems.Product").
			First(&cart).Error
	} else {
		return response.Unauthorized(c, "Authentication required")
	}

	if err == gorm.ErrRecordNotFound {
		// Create new cart
		if userID != "" {
			cart = models.Cart{
				UserID:    uuid.MustParse(userID),
				ExpiresAt: time.Now().Add(24 * time.Hour), // 24 hour expiry
			}
		} else if sessionID != "" {
			cart = models.Cart{
				SessionID: &sessionID,
				ExpiresAt: time.Now().Add(24 * time.Hour),
			}
		}
		if err := h.DB.Create(&cart).Error; err != nil {
			return response.InternalError(c)
		}
	} else if err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, cart)
}

// AddItem adds an item to the cart
func (h *Handler) AddItem(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	sessionID := c.Query("session_id")

	var req AddCartItemRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	productID, err := uuid.Parse(req.ProductID)
	if err != nil {
		return response.BadRequest(c, "Invalid product ID")
	}

	// Verify product exists
	var product models.Product
	if err := h.DB.First(&product, productID).Error; err != nil {
		return response.BadRequest(c, "Product not found")
	}

	// Get or create cart
	var cart models.Cart
	var errCart error

	if userID != "" {
		errCart = h.DB.Where("user_id = ? AND expires_at > ?", userID, time.Now()).
			First(&cart).Error
	} else if sessionID != "" {
		errCart = h.DB.Where("session_id = ? AND expires_at > ?", sessionID, time.Now()).
			First(&cart).Error
	} else {
		return response.Unauthorized(c, "Authentication required")
	}

	if errCart == gorm.ErrRecordNotFound {
		if userID != "" {
			cart = models.Cart{
				UserID:    uuid.MustParse(userID),
				ExpiresAt: time.Now().Add(24 * time.Hour),
			}
		} else if sessionID != "" {
			cart = models.Cart{
				SessionID: &sessionID,
				ExpiresAt: time.Now().Add(24 * time.Hour),
			}
		}
		if err := h.DB.Create(&cart).Error; err != nil {
			return response.InternalError(c)
		}
	} else if errCart != nil {
		return response.InternalError(c)
	}

	// Check if item already exists in cart
	var cartItem models.CartItem
	err = h.DB.Where("cart_id = ? AND product_id = ?", cart.ID, productID).
		First(&cartItem).Error

	if err == gorm.ErrRecordNotFound {
		// Create new cart item
		cartItem = models.CartItem{
			CartID:    cart.ID,
			ProductID: productID,
			Quantity:  req.Quantity,
		}
		if err := h.DB.Create(&cartItem).Error; err != nil {
			return response.InternalError(c)
		}
	} else if err != nil {
		return response.InternalError(c)
	} else {
		// Update existing item quantity
		cartItem.Quantity += req.Quantity
		if err := h.DB.Save(&cartItem).Error; err != nil {
			return response.InternalError(c)
		}
	}

	// Reload cart with items
	h.DB.Preload("CartItems.Product").First(&cart, cart.ID)

	return response.Success(c, cart)
}

// UpdateItem updates the quantity of a cart item
func (h *Handler) UpdateItem(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	sessionID := c.Query("session_id")
	cartItemID := c.Params("id")

	var req UpdateCartItemRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	cartItemUUID, err := uuid.Parse(cartItemID)
	if err != nil {
		return response.BadRequest(c, "Invalid cart item ID")
	}

	// Verify cart item belongs to user's cart
	var cartItem models.CartItem
	query := h.DB.Joins("JOIN carts ON cart_items.cart_id = carts.id")

	if userID != "" {
		query = query.Where("cart_items.id = ? AND carts.user_id = ?", cartItemUUID, userID)
	} else if sessionID != "" {
		query = query.Where("cart_items.id = ? AND carts.session_id = ?", cartItemUUID, sessionID)
	} else {
		return response.Unauthorized(c, "Authentication required")
	}

	err = query.Preload("Cart").First(&cartItem).Error

	if err == gorm.ErrRecordNotFound {
		return response.NotFound(c, "Cart item not found")
	} else if err != nil {
		return response.InternalError(c)
	}

	if req.Quantity == 0 {
		// Remove item if quantity is 0
		if err := h.DB.Delete(&cartItem).Error; err != nil {
			return response.InternalError(c)
		}
	} else {
		// Update quantity
		cartItem.Quantity = req.Quantity
		if err := h.DB.Save(&cartItem).Error; err != nil {
			return response.InternalError(c)
		}
	}

	// Reload cart
	var cart models.Cart
	h.DB.Preload("CartItems.Product").First(&cart, cartItem.CartID)

	return response.Success(c, cart)
}

// RemoveItem removes an item from the cart
func (h *Handler) RemoveItem(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	sessionID := c.Query("session_id")
	cartItemID := c.Params("id")

	cartItemUUID, err := uuid.Parse(cartItemID)
	if err != nil {
		return response.BadRequest(c, "Invalid cart item ID")
	}

	// Verify cart item belongs to user's cart
	var cartItem models.CartItem
	query := h.DB.Joins("JOIN carts ON cart_items.cart_id = carts.id")

	if userID != "" {
		query = query.Where("cart_items.id = ? AND carts.user_id = ?", cartItemUUID, userID)
	} else if sessionID != "" {
		query = query.Where("cart_items.id = ? AND carts.session_id = ?", cartItemUUID, sessionID)
	} else {
		return response.Unauthorized(c, "Authentication required")
	}

	err = query.First(&cartItem).Error

	if err == gorm.ErrRecordNotFound {
		return response.NotFound(c, "Cart item not found")
	} else if err != nil {
		return response.InternalError(c)
	}

	// Delete cart item
	if err := h.DB.Delete(&cartItem).Error; err != nil {
		return response.InternalError(c)
	}

	// Reload cart
	var cart models.Cart
	h.DB.Preload("CartItems.Product").First(&cart, cartItem.CartID)

	return response.Success(c, cart)
}

// ClearCart removes all items from the cart
func (h *Handler) ClearCart(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	sessionID := c.Query("session_id")

	var cart models.Cart
	var err error

	if userID != "" {
		err = h.DB.Where("user_id = ? AND expires_at > ?", userID, time.Now()).
			First(&cart).Error
	} else if sessionID != "" {
		err = h.DB.Where("session_id = ? AND expires_at > ?", sessionID, time.Now()).
			First(&cart).Error
	} else {
		return response.Unauthorized(c, "Authentication required")
	}

	if err == gorm.ErrRecordNotFound {
		return response.NotFound(c, "Cart not found")
	} else if err != nil {
		return response.InternalError(c)
	}

	// Delete all cart items
	if err := h.DB.Where("cart_id = ?", cart.ID).Delete(&models.CartItem{}).Error; err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, map[string]string{"message": "Cart cleared"})
}
