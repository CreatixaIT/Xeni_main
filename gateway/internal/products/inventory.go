package products

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/xeni-ai/gateway/internal/models"
)

// Restock handles POST /api/products/:id/restock
func (h *Handler) Restock(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	shop, err := h.getUserShop(userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Shop not found"})
	}

	pid, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid product ID"})
	}

	var req struct {
		Quantity int     `json:"quantity"`
		Notes    *string `json:"notes"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.Quantity <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Quantity must be positive"})
	}

	var product models.Product
	if err := h.DB.Where("id = ? AND shop_id = ?", pid, shop.ID).First(&product).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Product not found"})
	}

	tx := h.DB.Begin()

	oldStock := product.CurrentStock
	newStock := oldStock + req.Quantity

	// Update product stock
	if err := tx.Model(&product).Updates(map[string]interface{}{
		"current_stock":   newStock,
		"is_out_of_stock": newStock == 0,
	}).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update stock"})
	}

	// Log the restock
	notes := "Manual restock"
	if req.Notes != nil {
		notes = *req.Notes
	}
	if err := tx.Create(&models.InventoryLog{
		ProductID: pid,
		Type:      models.MovementRestock,
		Quantity:  req.Quantity,
		OldStock:  oldStock,
		NewStock:  newStock,
		Notes:     &notes,
	}).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to log restock"})
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to commit transaction"})
	}

	h.DB.First(&product, product.ID)
	return c.JSON(fiber.Map{"success": true, "data": product})
}

// Adjust handles POST /api/products/:id/adjust
func (h *Handler) Adjust(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	shop, err := h.getUserShop(userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Shop not found"})
	}

	pid, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid product ID"})
	}

	var req struct {
		Quantity int     `json:"quantity"`
		Notes    *string `json:"notes"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.Quantity == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Quantity cannot be zero"})
	}

	var product models.Product
	if err := h.DB.Where("id = ? AND shop_id = ?", pid, shop.ID).First(&product).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Product not found"})
	}

	tx := h.DB.Begin()

	oldStock := product.CurrentStock
	newStock := oldStock + req.Quantity

	if newStock < 0 {
		tx.Rollback()
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot adjust below zero stock"})
	}

	// Update product stock
	if err := tx.Model(&product).Updates(map[string]interface{}{
		"current_stock":   newStock,
		"is_out_of_stock": newStock == 0,
	}).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update stock"})
	}

	// Log the adjustment
	notes := "Manual adjustment"
	if req.Notes != nil {
		notes = *req.Notes
	}
	if err := tx.Create(&models.InventoryLog{
		ProductID: pid,
		Type:      models.MovementAdjustment,
		Quantity:  req.Quantity,
		OldStock:  oldStock,
		NewStock:  newStock,
		Notes:     &notes,
	}).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to log adjustment"})
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to commit transaction"})
	}

	h.DB.First(&product, product.ID)
	return c.JSON(fiber.Map{"success": true, "data": product})
}

// Return handles POST /api/products/:id/return
func (h *Handler) Return(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	shop, err := h.getUserShop(userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Shop not found"})
	}

	pid, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid product ID"})
	}

	var req struct {
		Quantity int     `json:"quantity"`
		Notes    *string `json:"notes"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.Quantity <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Quantity must be positive"})
	}

	var product models.Product
	if err := h.DB.Where("id = ? AND shop_id = ?", pid, shop.ID).First(&product).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Product not found"})
	}

	tx := h.DB.Begin()

	oldStock := product.CurrentStock
	newStock := oldStock + req.Quantity

	// Update product stock
	if err := tx.Model(&product).Updates(map[string]interface{}{
		"current_stock":   newStock,
		"is_out_of_stock": newStock == 0,
	}).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update stock"})
	}

	// Log the return
	notes := "Product return"
	if req.Notes != nil {
		notes = *req.Notes
	}
	if err := tx.Create(&models.InventoryLog{
		ProductID: pid,
		Type:      models.MovementReturn,
		Quantity:  req.Quantity,
		OldStock:  oldStock,
		NewStock:  newStock,
		Notes:     &notes,
	}).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to log return"})
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to commit transaction"})
	}

	h.DB.First(&product, product.ID)
	return c.JSON(fiber.Map{"success": true, "data": product})
}

// GetInventoryHistory handles GET /api/products/:id/inventory
func (h *Handler) GetInventoryHistory(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	shop, err := h.getUserShop(userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Shop not found"})
	}

	pid, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid product ID"})
	}

	// Verify product belongs to user's shop
	var product models.Product
	if err := h.DB.Where("id = ? AND shop_id = ?", pid, shop.ID).First(&product).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Product not found"})
	}

	page := c.QueryInt("page", 1)
	perPage := c.QueryInt("per_page", 20)

	if perPage > 100 {
		perPage = 100
	}

	var total int64
	h.DB.Model(&models.InventoryLog{}).Where("product_id = ?", pid).Count(&total)

	var logs []models.InventoryLog
	h.DB.Where("product_id = ?", pid).
		Preload("Variant").
		Order("created_at DESC").
		Offset((page - 1) * perPage).
		Limit(perPage).
		Find(&logs)

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data":    logs,
		"meta": fiber.Map{
			"page":        page,
			"per_page":    perPage,
			"total":       total,
			"total_pages": totalPages,
		},
	})
}
