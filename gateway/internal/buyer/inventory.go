package buyer

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/pkg/response"
)

// UpdateProductOutOfStock updates a product's out-of-stock state based on its variants
// For variant products: out-of-stock if no active variant has stock
// For non-variant products: out-of-stock if current_stock <= 0
func (h *Handler) UpdateProductOutOfStock(tx *gorm.DB, productID uuid.UUID) error {
	var product models.Product
	if err := tx.First(&product, productID).Error; err != nil {
		return err
	}

	if product.HasVariants {
		// Variant product: check if any active variant has stock
		var totalVariantStock int64
		tx.Model(&models.ProductVariant{}).
			Where("product_id = ? AND is_active = ?", productID, true).
			Select("COALESCE(SUM(stock), 0)").
			Scan(&totalVariantStock)

		isOutOfStock := totalVariantStock == 0
		return tx.Model(&models.Product{}).
			Where("id = ?", productID).
			Update("is_out_of_stock", isOutOfStock).Error
	} else {
		// Non-variant product: check current_stock
		isOutOfStock := product.CurrentStock <= 0
		return tx.Model(&models.Product{}).
			Where("id = ?", productID).
			Update("is_out_of_stock", isOutOfStock).Error
	}
}

// BatchUpdateProductOutOfStock updates out-of-stock state for multiple products
// Used after checkout or inventory changes
func (h *Handler) BatchUpdateProductOutOfStock(tx *gorm.DB, productIDs []uuid.UUID) error {
	for _, productID := range productIDs {
		if err := h.UpdateProductOutOfStock(tx, productID); err != nil {
			return err
		}
	}
	return nil
}

// ManualUpdateProductOutOfStock is an admin endpoint to manually trigger out-of-stock update
// Useful for correcting state after manual inventory adjustments
func (h *Handler) ManualUpdateProductOutOfStock(c *fiber.Ctx) error {
	productID := c.Params("id")
	productUUID, err := uuid.Parse(productID)
	if err != nil {
		return response.BadRequest(c, "Invalid product ID")
	}

	err = h.DB.Transaction(func(tx *gorm.DB) error {
		return h.UpdateProductOutOfStock(tx, productUUID)
	})

	if err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, map[string]string{"message": "Product out-of-stock state updated"})
}
