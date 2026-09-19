package public

import (
	"encoding/json"
	"log/slog"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/pkg/response"
)

// Handler holds public API dependencies.
type Handler struct {
	DB *gorm.DB
}

// NewHandler creates a new public API handler.
func NewHandler(db *gorm.DB) *Handler {
	return &Handler{DB: db}
}

// PublicProduct represents a sanitized product for public API responses.
type PublicProduct struct {
	ID            string           `json:"id"`
	Name          string           `json:"name"`
	NameBN        *string          `json:"name_bn,omitempty"`
	Description   *string          `json:"description,omitempty"`
	DescriptionBN *string          `json:"description_bn,omitempty"`
	Price         float64          `json:"price"`
	SKU           *string          `json:"sku,omitempty"`
	CurrentStock  int              `json:"current_stock"`
	IsOutOfStock  bool             `json:"is_out_of_stock"`
	IsActive      bool             `json:"is_active"`
	Images        []string         `json:"images"`
	Variants      []PublicVariant  `json:"variants,omitempty"`
	Store         PublicStore      `json:"store"`
	Category      *PublicCategory  `json:"category,omitempty"`
	Categories    []PublicCategory `json:"categories,omitempty"`
	CreatedAt     time.Time        `json:"created_at"`
	UpdatedAt     time.Time        `json:"updated_at"`
}

// PublicVariant represents a sanitized product variant for public API responses.
type PublicVariant struct {
	ID            string  `json:"id"`
	SKU           string  `json:"sku"`
	Color         *string `json:"color,omitempty"`
	Size          *string `json:"size,omitempty"`
	PriceModifier float64 `json:"price_modifier"`
	Stock         int     `json:"stock"`
	IsActive      bool    `json:"is_active"`
}

// PublicStore represents a sanitized store for public API responses.
type PublicStore struct {
	ID                  string  `json:"id"`
	ShopSlug            *string `json:"shop_slug,omitempty"`
	ShopName            string  `json:"shop_name"`
	ShopDescription     *string `json:"shop_description,omitempty"`
	ShopLogoURL         *string `json:"shop_logo_url,omitempty"`
	District            *string `json:"district,omitempty"`
	PreferredLanguage   string  `json:"preferred_language"`
	StoreTheme          string  `json:"store_theme"`
	StorefrontPublished bool    `json:"storefront_published"`
}

// PublicCategory represents a sanitized category for public API responses.
type PublicCategory struct {
	ID           string           `json:"id"`
	Slug         string           `json:"slug"`
	Name         string           `json:"name"`
	NameBN       *string          `json:"name_bn,omitempty"`
	ParentID     *string          `json:"parent_id,omitempty"`
	IsActive     bool             `json:"is_active"`
	Description  *string          `json:"description,omitempty"`
	DisplayOrder int              `json:"display_order"`
	Children     []PublicCategory `json:"children,omitempty"`
}

// ListProducts handles GET /api/public/v1/products
func (h *Handler) ListProducts(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	perPage := c.QueryInt("per_page", 20)
	search := c.Query("search")
	categorySlug := c.Query("category")
	storeID := c.Query("store_id")
	sortBy := c.Query("sort", "created_at")
	sortOrder := c.Query("order", "desc")

	// Validate pagination
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	// Build query
	query := h.DB.Model(&models.Product{}).
		Joins("JOIN shops ON products.shop_id = shops.id").
		Where("is_active = ?", true).
		Where("shops.storefront_published = ?", true)

	// Search filter
	if search != "" {
		query = query.Where("name ILIKE ? OR name_bn ILIKE ? OR sku ILIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	// Category filter
	if categorySlug != "" {
		var category models.Category
		if err := h.DB.Where("slug = ? AND is_active = ?", categorySlug, true).First(&category).Error; err == nil {
			query = query.Joins("JOIN product_categories ON products.id = product_categories.product_id").
				Where("product_categories.category_id = ?", category.ID)
		}
	}

	// Store filter
	if storeID != "" {
		if _, err := uuid.Parse(storeID); err == nil {
			query = query.Where("shop_id = ?", storeID)
		}
	}

	// Count total
	var total int64
	if err := query.Count(&total).Error; err != nil {
		slog.Error("failed to count products", "error", err)
		return response.InternalError(c)
	}

	// Validate sort field
	validSortFields := map[string]bool{
		"created_at": true, "name": true, "price": true, "total_sold": true,
	}
	if !validSortFields[sortBy] {
		sortBy = "created_at"
	}

	// Validate sort order
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "desc"
	}

	// Fetch products with relations
	var products []models.Product
	query.Preload("Shop").
		Preload("Variants").
		Preload("Category").
		Preload("Categories").
		Order(sortBy + " " + sortOrder).
		Offset((page - 1) * perPage).
		Limit(perPage).
		Find(&products)

	// Convert to public response
	publicProducts := make([]PublicProduct, len(products))
	for i, product := range products {
		publicProducts[i] = h.toPublicProduct(product)
	}

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	return response.SuccessWithMeta(c, publicProducts, response.PaginationMeta{
		Page:       page,
		PerPage:    perPage,
		Total:      total,
		TotalPages: totalPages,
	})
}

// GetProduct handles GET /api/public/v1/products/:identifier
func (h *Handler) GetProduct(c *fiber.Ctx) error {
	identifier := c.Params("identifier")

	// Try parsing as UUID first
	var product models.Product
	query := h.DB.Model(&models.Product{}).
		Joins("JOIN shops ON products.shop_id = shops.id").
		Where("is_active = ?", true).
		Where("shops.storefront_published = ?", true)

	if parsedUUID, err := uuid.Parse(identifier); err == nil {
		query = query.Where("products.id = ?", parsedUUID)
	} else {
		// If not UUID, search by slug (we'll need to add slug field to products in future)
		// For now, only UUID is supported
		return response.BadRequest(c, "Invalid product identifier. Use UUID.")
	}

	// Fetch product with relations
	if err := query.Preload("Shop").
		Preload("Variants").
		Preload("Category").
		Preload("Categories").
		First(&product).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return response.NotFound(c, "Product not found")
		}
		slog.Error("failed to fetch product", "error", err)
		return response.InternalError(c)
	}

	return response.Success(c, h.toPublicProduct(product))
}

// ListStores handles GET /api/public/v1/stores
func (h *Handler) ListStores(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	perPage := c.QueryInt("per_page", 20)
	search := c.Query("search")
	district := c.Query("district")
	published := c.Query("published", "true") // Default to only published stores

	// Validate pagination
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	// Build query
	query := h.DB.Model(&models.Shop{})

	// Filter by published status (default to true for public API)
	if published == "true" {
		query = query.Where("storefront_published = ?", true)
	}

	// Search filter
	if search != "" {
		query = query.Where("shop_name ILIKE ? OR shop_description ILIKE ?",
			"%"+search+"%", "%"+search+"%")
	}

	// District filter
	if district != "" {
		query = query.Where("district = ?", district)
	}

	// Count total
	var total int64
	if err := query.Count(&total).Error; err != nil {
		slog.Error("failed to count stores", "error", err)
		return response.InternalError(c)
	}

	// Fetch stores
	var shops []models.Shop
	query.Order("created_at DESC").
		Offset((page - 1) * perPage).
		Limit(perPage).
		Find(&shops)

	// Convert to public response
	publicStores := make([]PublicStore, len(shops))
	for i, shop := range shops {
		publicStores[i] = h.toPublicStore(shop)
	}

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	return response.SuccessWithMeta(c, publicStores, response.PaginationMeta{
		Page:       page,
		PerPage:    perPage,
		Total:      total,
		TotalPages: totalPages,
	})
}

// GetStore handles GET /api/public/v1/stores/:identifier
func (h *Handler) GetStore(c *fiber.Ctx) error {
	identifier := c.Params("identifier")

	// Try parsing as UUID first
	var shop models.Shop
	query := h.DB.Model(&models.Shop{})

	if parsedUUID, err := uuid.Parse(identifier); err == nil {
		query = query.Where("id = ?", parsedUUID)
	} else {
		// If not UUID, try slug
		query = query.Where("shop_slug = ?", identifier)
	}

	if err := query.First(&shop).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return response.NotFound(c, "Store not found")
		}
		slog.Error("failed to fetch store", "error", err)
		return response.InternalError(c)
	}

	// Fetch store's products
	var products []models.Product
	h.DB.Model(&models.Product{}).
		Where("shop_id = ? AND is_active = ?", shop.ID, true).
		Preload("Variants").
		Preload("Category").
		Preload("Categories").
		Find(&products)

	publicProducts := make([]PublicProduct, len(products))
	for i, product := range products {
		publicProducts[i] = h.toPublicProduct(product)
	}

	return response.Success(c, map[string]interface{}{
		"store":         h.toPublicStore(shop),
		"products":      publicProducts,
		"product_count": len(products),
	})
}

// ListCategories handles GET /api/public/v1/categories
func (h *Handler) ListCategories(c *fiber.Ctx) error {
	var categories []models.Category
	if err := h.DB.Where("is_active = ?", true).
		Preload("Children").
		Order("display_order ASC, name ASC").
		Find(&categories).Error; err != nil {
		slog.Error("failed to fetch categories", "error", err)
		return response.InternalError(c)
	}

	publicCategories := make([]PublicCategory, len(categories))
	for i, category := range categories {
		publicCategories[i] = h.toPublicCategory(category)
	}

	return response.Success(c, publicCategories)
}

// GetCategory handles GET /api/public/v1/categories/:slug
func (h *Handler) GetCategory(c *fiber.Ctx) error {
	slug := c.Params("slug")

	var category models.Category
	if err := h.DB.Where("slug = ? AND is_active = ?", slug, true).
		Preload("Children").
		First(&category).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return response.NotFound(c, "Category not found")
		}
		slog.Error("failed to fetch category", "error", err)
		return response.InternalError(c)
	}

	return response.Success(c, h.toPublicCategory(category))
}

// GetFeaturedProducts handles GET /api/public/v1/products/featured
func (h *Handler) GetFeaturedProducts(c *fiber.Ctx) error {
	perPage := c.QueryInt("per_page", 12)
	if perPage < 1 || perPage > 50 {
		perPage = 12
	}

	// For now, return products with highest stock as "featured"
	// In future, this could be based on actual sales data, admin flags, etc.
	var products []models.Product
	h.DB.Model(&models.Product{}).
		Joins("JOIN shops ON products.shop_id = shops.id").
		Where("is_active = ?", true).
		Where("shops.storefront_published = ?", true).
		Preload("Shop").
		Preload("Variants").
		Preload("Category").
		Preload("Categories").
		Order("current_stock DESC, created_at DESC").
		Limit(perPage).
		Find(&products)

	publicProducts := make([]PublicProduct, len(products))
	for i, product := range products {
		publicProducts[i] = h.toPublicProduct(product)
	}

	return response.Success(c, publicProducts)
}

// GetBestSellingProducts handles GET /api/public/v1/products/bestselling
func (h *Handler) GetBestSellingProducts(c *fiber.Ctx) error {
	perPage := c.QueryInt("per_page", 12)
	if perPage < 1 || perPage > 50 {
		perPage = 12
	}

	// Return products sorted by total_sold (sales volume)
	var products []models.Product
	h.DB.Model(&models.Product{}).
		Joins("JOIN shops ON products.shop_id = shops.id").
		Where("is_active = ?", true).
		Where("shops.storefront_published = ?", true).
		Preload("Shop").
		Preload("Variants").
		Preload("Category").
		Preload("Categories").
		Order("total_sold DESC, created_at DESC").
		Limit(perPage).
		Find(&products)

	publicProducts := make([]PublicProduct, len(products))
	for i, product := range products {
		publicProducts[i] = h.toPublicProduct(product)
	}

	return response.Success(c, publicProducts)
}

// GetNewProducts handles GET /api/public/v1/products/new
func (h *Handler) GetNewProducts(c *fiber.Ctx) error {
	perPage := c.QueryInt("per_page", 12)
	if perPage < 1 || perPage > 50 {
		perPage = 12
	}

	// Return newest products
	var products []models.Product
	h.DB.Model(&models.Product{}).
		Joins("JOIN shops ON products.shop_id = shops.id").
		Where("is_active = ?", true).
		Where("shops.storefront_published = ?", true).
		Preload("Shop").
		Preload("Variants").
		Preload("Category").
		Preload("Categories").
		Order("created_at DESC").
		Limit(perPage).
		Find(&products)

	publicProducts := make([]PublicProduct, len(products))
	for i, product := range products {
		publicProducts[i] = h.toPublicProduct(product)
	}

	return response.Success(c, publicProducts)
}

// Helper functions to convert models to public responses

func (h *Handler) toPublicProduct(product models.Product) PublicProduct {
	variants := make([]PublicVariant, len(product.Variants))
	for i, v := range product.Variants {
		variants[i] = PublicVariant{
			ID:            v.ID.String(),
			SKU:           v.SKU,
			Color:         v.Color,
			Size:          v.Size,
			PriceModifier: v.PriceModifier,
			Stock:         v.Stock,
			IsActive:      v.IsActive,
		}
	}

	// Parse images JSON
	var images []string
	if len(product.Images) > 0 {
		json.Unmarshal(product.Images, &images)
	}

	// Convert categories
	categories := make([]PublicCategory, len(product.Categories))
	for i, cat := range product.Categories {
		categories[i] = h.toPublicCategory(cat)
	}

	var category *PublicCategory
	if product.Category != nil {
		cat := h.toPublicCategory(*product.Category)
		category = &cat
	}

	return PublicProduct{
		ID:            product.ID.String(),
		Name:          product.Name,
		NameBN:        product.NameBN,
		Description:   product.Description,
		DescriptionBN: product.DescriptionBN,
		Price:         product.Price,
		SKU:           product.SKU,
		CurrentStock:  product.CurrentStock,
		IsOutOfStock:  product.IsOutOfStock,
		IsActive:      product.IsActive,
		Images:        images,
		Variants:      variants,
		Store:         h.toPublicStore(product.Shop),
		Category:      category,
		Categories:    categories,
		CreatedAt:     product.CreatedAt,
		UpdatedAt:     product.UpdatedAt,
	}
}

func (h *Handler) toPublicStore(store models.Shop) PublicStore {
	return PublicStore{
		ID:                  store.ID.String(),
		ShopSlug:            store.ShopSlug,
		ShopName:            store.ShopName,
		ShopDescription:     store.ShopDescription,
		ShopLogoURL:         store.ShopLogoURL,
		District:            store.District,
		PreferredLanguage:   store.PreferredLanguage,
		StoreTheme:          string(store.StoreTheme),
		StorefrontPublished: store.StorefrontPublished,
	}
}

func (h *Handler) toPublicCategory(category models.Category) PublicCategory {
	var parentID *string
	if category.ParentID != nil {
		pid := category.ParentID.String()
		parentID = &pid
	}

	children := make([]PublicCategory, len(category.Children))
	for i, child := range category.Children {
		children[i] = h.toPublicCategory(child)
	}

	return PublicCategory{
		ID:           category.ID.String(),
		Slug:         category.Slug,
		Name:         category.Name,
		NameBN:       category.NameBN,
		ParentID:     parentID,
		IsActive:     category.IsActive,
		Description:  category.Description,
		DisplayOrder: category.DisplayOrder,
		Children:     children,
	}
}
