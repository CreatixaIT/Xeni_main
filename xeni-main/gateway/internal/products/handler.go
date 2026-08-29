package products

import (
	"encoding/json"
	
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/internal/storage"
	"github.com/xeni-ai/gateway/pkg/response"
)

type Handler struct {
	DB     *gorm.DB
	Spaces *storage.SpacesClient
}

func NewHandler(db *gorm.DB, spaces *storage.SpacesClient) *Handler {
	return &Handler{DB: db, Spaces: spaces}
}

func (h *Handler) getUserShop(userID string) (*models.Shop, error) {
	uid, _ := uuid.Parse(userID)
	var shop models.Shop
	err := h.DB.Where("user_id = ?", uid).First(&shop).Error
	return &shop, err
}

// UploadImage handles POST /api/products/upload.
func (h *Handler) UploadImage(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	shop, err := h.getUserShop(userID)
	if err != nil {
		return response.BadRequest(c, "Create a shop first")
	}

	file, err := c.FormFile("image")
	if err != nil {
		return response.BadRequest(c, "No image uploaded")
	}

	if h.Spaces == nil {
		return response.InternalError(c)
	}

	// S3 path logic: "products/{shop_id}/{uuid}_{filename}"
	path := "products/" + shop.ID.String() + "/" + uuid.New().String() + "_" + file.Filename
	url, err := h.Spaces.UploadFile(c.Context(), file, path)
	if err != nil {
		return response.InternalError(c)
	}

	return response.Success(c, map[string]string{
		"url": url,
	})
}

// CreateProduct handles POST /api/products.
func (h *Handler) CreateProduct(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	shop, err := h.getUserShop(userID)
	if err != nil {
		return response.BadRequest(c, "Create a shop first")
	}

	var req struct {
		Name              string   `json:"name"`
		NameBN            *string  `json:"name_bn"`
		Description       *string  `json:"description"`
		DescriptionBN     *string  `json:"description_bn"`
		Price             float64  `json:"price"`
		SKU               *string  `json:"sku"`
		InitialStock      int      `json:"initial_stock"`
		LowStockThreshold int      `json:"low_stock_threshold"`
		HasVariants       bool     `json:"has_variants"`
		Images            []string `json:"images"`
		Variants          []struct {
			SKU           string  `json:"sku"`
			Color         *string `json:"color"`
			Size          *string `json:"size"`
			Stock         int     `json:"stock"`
			PriceModifier float64 `json:"price_modifier"`
		} `json:"variants"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}
	if req.Name == "" {
		return response.BadRequest(c, "name is required")
	}
	if req.LowStockThreshold == 0 {
		req.LowStockThreshold = 5
	}

	product := models.Product{
		ShopID:            shop.ID,
		Name:              req.Name,
		NameBN:            req.NameBN,
		Description:       req.Description,
		DescriptionBN:     req.DescriptionBN,
		Price:             req.Price,
		SKU:               req.SKU,
		InitialStock:      req.InitialStock,
		CurrentStock:      req.InitialStock,
		LowStockThreshold: req.LowStockThreshold,
		IsOutOfStock:      req.InitialStock == 0,
		HasVariants:       req.HasVariants,
	}

	// Calculate total stock if variants are present
	if req.HasVariants && len(req.Variants) > 0 {
		totalStock := 0
		for _, v := range req.Variants {
			totalStock += v.Stock
		}
		product.InitialStock = totalStock
		product.CurrentStock = totalStock
		product.IsOutOfStock = totalStock == 0
	}

	if req.Images != nil {
		b, _ := json.Marshal(req.Images)
		product.Images = b
	}

	if err := h.DB.Create(&product).Error; err != nil {
		return response.InternalError(c)
	}

	// Create variants if any
	if req.HasVariants && len(req.Variants) > 0 {
		for _, v := range req.Variants {
			variant := models.ProductVariant{
				ProductID:     product.ID,
				SKU:           v.SKU,
				Color:         v.Color,
				Size:          v.Size,
				Stock:         v.Stock,
				PriceModifier: v.PriceModifier,
			}
			h.DB.Create(&variant)
			
			// Log initial stock for variant
			h.DB.Create(&models.InventoryLog{
				ProductID: product.ID,
				VariantID: &variant.ID,
				Type:      models.MovementRestock,
				Quantity:  v.Stock,
				OldStock:  0,
				NewStock:  v.Stock,
				Notes:     &[]string{"Initial stock"}[0],
			})
		}
	} else if req.InitialStock > 0 {
		// Log initial stock for simple product
		h.DB.Create(&models.InventoryLog{
			ProductID: product.ID,
			Type:      models.MovementRestock,
			Quantity:  req.InitialStock,
			OldStock:  0,
			NewStock:  req.InitialStock,
			Notes:     &[]string{"Initial stock"}[0],
		})
	}

	return response.Created(c, product)
}

// ListProducts handles GET /api/products.
func (h *Handler) ListProducts(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	shop, err := h.getUserShop(userID)
	if err != nil {
		return response.Success(c, []models.Product{})
	}

	page := c.QueryInt("page", 1)
	perPage := c.QueryInt("per_page", 20)
	search := c.Query("search")
	activeOnly := c.QueryBool("active_only", false)

	if perPage > 100 {
		perPage = 100
	}

	query := h.DB.Where("shop_id = ?", shop.ID)
	if search != "" {
		query = query.Where("name ILIKE ? OR sku ILIKE ?", "%"+search+"%", "%"+search+"%")
	}
	if activeOnly {
		query = query.Where("is_active = true")
	}

	var total int64
	query.Model(&models.Product{}).Count(&total)

	var products []models.Product
	query.Preload("Variants").Order("created_at DESC").Offset((page - 1) * perPage).Limit(perPage).Find(&products)

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	return response.SuccessWithMeta(c, products, response.PaginationMeta{
		Page:       page,
		PerPage:    perPage,
		Total:      total,
		TotalPages: totalPages,
	})
}

// GetProduct handles GET /api/products/:id.
func (h *Handler) GetProduct(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	shop, err := h.getUserShop(userID)
	if err != nil {
		return response.NotFound(c, "Shop not found")
	}

	pid, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid product ID")
	}

	var product models.Product
	if err := h.DB.Where("id = ? AND shop_id = ?", pid, shop.ID).First(&product).Error; err != nil {
		return response.NotFound(c, "Product not found")
	}

	return response.Success(c, product)
}

// UpdateProduct handles PUT /api/products/:id.
func (h *Handler) UpdateProduct(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	shop, err := h.getUserShop(userID)
	if err != nil {
		return response.NotFound(c, "Shop not found")
	}

	pid, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid product ID")
	}

	var product models.Product
	if err := h.DB.Where("id = ? AND shop_id = ?", pid, shop.ID).First(&product).Error; err != nil {
		return response.NotFound(c, "Product not found")
	}

	var req struct {
		Name              *string  `json:"name"`
		NameBN            *string  `json:"name_bn"`
		Description       *string  `json:"description"`
		DescriptionBN     *string  `json:"description_bn"`
		Price             *float64 `json:"price"`
		SKU               *string  `json:"sku"`
		CurrentStock      *int     `json:"current_stock"`
		LowStockThreshold *int     `json:"low_stock_threshold"`
		IsActive          *bool    `json:"is_active"`
		HasVariants       *bool    `json:"has_variants"`
		Variants          []struct {
			SKU           string  `json:"sku"`
			Color         *string `json:"color"`
			Size          *string `json:"size"`
			Stock         int     `json:"stock"`
			PriceModifier float64 `json:"price_modifier"`
		} `json:"variants"`
		Images            []string `json:"images"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.NameBN != nil {
		updates["name_bn"] = *req.NameBN
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.DescriptionBN != nil {
		updates["description_bn"] = *req.DescriptionBN
	}
	if req.Price != nil {
		updates["price"] = *req.Price
	}
	if req.SKU != nil {
		updates["sku"] = *req.SKU
	}
	if req.CurrentStock != nil {
		updates["current_stock"] = *req.CurrentStock
		updates["is_out_of_stock"] = *req.CurrentStock == 0
	}
	if req.LowStockThreshold != nil {
		updates["low_stock_threshold"] = *req.LowStockThreshold
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if req.Images != nil {
		b, _ := json.Marshal(req.Images)
		updates["images"] = b
	}

	if req.HasVariants != nil {
		updates["has_variants"] = *req.HasVariants
	}

	if len(updates) > 0 {
		h.DB.Model(&product).Updates(updates)
	}

	// Handle variants update if provided
	if req.HasVariants != nil || req.Variants != nil {
		hasVariants := product.HasVariants
		if req.HasVariants != nil {
			hasVariants = *req.HasVariants
		}

		if hasVariants && req.Variants != nil {
			// For simplicity in this update, we clear and recreate variants
			// and then recalculate the product's total stock
			h.DB.Where("product_id = ?", product.ID).Delete(&models.ProductVariant{})
			
			totalStock := 0
			for _, v := range req.Variants {
				variant := models.ProductVariant{
					ProductID:     product.ID,
					SKU:           v.SKU,
					Color:         v.Color,
					Size:          v.Size,
					Stock:         v.Stock,
					PriceModifier: v.PriceModifier,
				}
				h.DB.Create(&variant)
				totalStock += v.Stock
			}

			// Update product's total stock
			h.DB.Model(&product).Updates(map[string]interface{}{
				"initial_stock":   totalStock,
				"current_stock":   totalStock,
				"is_out_of_stock": totalStock == 0,
			})
		} else if !hasVariants {
			// If variants are turned off, delete existing variants
			h.DB.Where("product_id = ?", product.ID).Delete(&models.ProductVariant{})
		}
	}

	h.DB.First(&product, product.ID)
	return response.Success(c, product)
}

// DeleteProduct handles DELETE /api/products/:id.
func (h *Handler) DeleteProduct(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	shop, err := h.getUserShop(userID)
	if err != nil {
		return response.NotFound(c, "Shop not found")
	}

	pid, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.BadRequest(c, "Invalid product ID")
	}

	result := h.DB.Where("id = ? AND shop_id = ?", pid, shop.ID).Delete(&models.Product{})
	if result.RowsAffected == 0 {
		return response.NotFound(c, "Product not found")
	}

	return response.Success(c, map[string]string{"message": "Product deleted successfully"})
}
