package buyer

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

type GetOrCreateCartRequest struct {
	SessionID *string `json:"session_id,omitempty"`
}

type AddCartItemRequest struct {
	ProductID string  `json:"product_id" validate:"required"`
	VariantID *string `json:"variant_id,omitempty"`
	Quantity  int     `json:"quantity" validate:"required,min=1"`
}

type UpdateCartItemRequest struct {
	Quantity int `json:"quantity" validate:"required,min=0"`
}

// GetOrCreateCart gets an existing cart or creates a new one
// Supports both authenticated users (via user_id) and guest users (via session_id)
func (h *Handler) GetOrCreateCart(c *fiber.Ctx) error {
	userID, hasUser := c.Locals("user_id").(string)
	sessionID := c.Query("session_id")

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
		// No user or session - create guest cart with new session
		newSessionID := uuid.New().String()
		cart = models.Cart{
			SessionID: &newSessionID,
			ExpiresAt: time.Now().Add(24 * time.Hour),
		}
		if err := h.DB.Create(&cart).Error; err != nil {
			return response.InternalError(c)
		}
		return response.Success(c, cart)
	}

	if err == gorm.ErrRecordNotFound {
		// Create new cart
		if hasUser && userID != "" {
			userUUID := uuid.MustParse(userID)
			cart = models.Cart{
				UserID:    &userUUID,
				ExpiresAt: time.Now().Add(24 * time.Hour),
			}
		} else if sessionID != "" {
			cart = models.Cart{
				SessionID: &sessionID,
				ExpiresAt: time.Now().Add(24 * time.Hour),
			}
		} else {
			newSessionID := uuid.New().String()
			cart = models.Cart{
				SessionID: &newSessionID,
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
	userID, hasUser := c.Locals("user_id").(string)
	sessionID := c.Query("session_id")

	var req AddCartItemRequest
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	productID, err := uuid.Parse(req.ProductID)
	if err != nil {
		return response.BadRequest(c, "Invalid product ID")
	}

	// Verify product exists and is active
	var product models.Product
	if err := h.DB.Where("id = ? AND is_active = ?", productID, true).First(&product).Error; err != nil {
		return response.BadRequest(c, "Product not found or inactive")
	}

	// Validate variant selection
	var variantID *uuid.UUID
	if req.VariantID != nil {
		if !product.HasVariants {
			return response.BadRequest(c, "Product does not have variants")
		}
		variantUUID, err := uuid.Parse(*req.VariantID)
		if err != nil {
			return response.BadRequest(c, "Invalid variant ID")
		}
		variantID = &variantUUID

		// Verify variant exists, belongs to product, is active, and has stock
		var variant models.ProductVariant
		if err := h.DB.Where("id = ? AND product_id = ? AND is_active = ? AND stock > 0",
			variantUUID, productID, true).First(&variant).Error; err != nil {
			return response.BadRequest(c, "Variant not found, inactive, or out of stock")
		}
	} else {
		if product.HasVariants {
			return response.BadRequest(c, "Variant selection required for this product")
		}
	}

	// Get or create cart
	var cart models.Cart
	var errCart error

	if hasUser && userID != "" {
		userUUID := uuid.MustParse(userID)
		errCart = h.DB.Where("user_id = ? AND expires_at > ?", &userUUID, time.Now()).
			First(&cart).Error
	} else if sessionID != "" {
		errCart = h.DB.Where("session_id = ? AND expires_at > ?", sessionID, time.Now()).
			First(&cart).Error
	} else {
		return response.Unauthorized(c, "Authentication required")
	}

	if errCart == gorm.ErrRecordNotFound {
		if hasUser && userID != "" {
			userUUID := uuid.MustParse(userID)
			cart = models.Cart{
				UserID:    &userUUID,
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

	// Check if item already exists in cart (uniqueness: cart + product + variant)
	var cartItem models.CartItem
	if variantID != nil {
		err = h.DB.Where("cart_id = ? AND product_id = ? AND variant_id = ?", cart.ID, productID, *variantID).
			First(&cartItem).Error
	} else {
		err = h.DB.Where("cart_id = ? AND product_id = ? AND variant_id IS NULL", cart.ID, productID).
			First(&cartItem).Error
	}

	if err == gorm.ErrRecordNotFound {
		// Create new cart item
		cartItem = models.CartItem{
			CartID:    cart.ID,
			ProductID: productID,
			VariantID: variantID,
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

	// Reload cart with items and variants
	h.DB.Preload("CartItems.Product").Preload("CartItems.Variant").First(&cart, cart.ID)

	return response.Success(c, cart)
}

// UpdateItem updates the quantity of a cart item
func (h *Handler) UpdateItem(c *fiber.Ctx) error {
	userID, hasUser := c.Locals("user_id").(string)
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

	if hasUser && userID != "" {
		userUUID := uuid.MustParse(userID)
		query = query.Where("cart_items.id = ? AND carts.user_id = ?", cartItemUUID, userUUID)
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
	h.DB.Preload("CartItems.Product").Preload("CartItems.Variant").First(&cart, cartItem.CartID)

	return response.Success(c, cart)
}

// RemoveItem removes an item from the cart
func (h *Handler) RemoveItem(c *fiber.Ctx) error {
	userID, hasUser := c.Locals("user_id").(string)
	sessionID := c.Query("session_id")
	cartItemID := c.Params("id")

	cartItemUUID, err := uuid.Parse(cartItemID)
	if err != nil {
		return response.BadRequest(c, "Invalid cart item ID")
	}

	// Verify cart item belongs to user's cart
	var cartItem models.CartItem
	query := h.DB.Joins("JOIN carts ON cart_items.cart_id = carts.id")

	if hasUser && userID != "" {
		userUUID := uuid.MustParse(userID)
		query = query.Where("cart_items.id = ? AND carts.user_id = ?", cartItemUUID, userUUID)
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
	h.DB.Preload("CartItems.Product").Preload("CartItems.Variant").First(&cart, cartItem.CartID)

	return response.Success(c, cart)
}

// ClearCart removes all items from the cart
func (h *Handler) ClearCart(c *fiber.Ctx) error {
	userID, hasUser := c.Locals("user_id").(string)
	sessionID := c.Query("session_id")

	var cart models.Cart
	var err error

	if hasUser && userID != "" {
		userUUID := uuid.MustParse(userID)
		err = h.DB.Where("user_id = ? AND expires_at > ?", &userUUID, time.Now()).
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
