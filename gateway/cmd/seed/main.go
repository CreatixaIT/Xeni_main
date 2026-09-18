package main

import (
	"flag"
	"log"

	"github.com/joho/godotenv"
	"github.com/xeni-ai/gateway/internal/config"
	"github.com/xeni-ai/gateway/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Parse flags
	dbURI := flag.String("db-uri", "", "Database URI (overrides .env)")
	demoPassword := flag.String("demo-password", "", "Demo seller password (required)")
	flag.Parse()

	// Require demo password for security
	if *demoPassword == "" {
		log.Fatal("ERROR: --demo-password is required. Do not use default passwords in production.")
	}

	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found, using default values")
	}

	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Override DB URI if provided via flag
	uri := cfg.DB.URI
	if *dbURI != "" {
		uri = *dbURI
	}

	// Connect to database directly (bypassing AutoMigrate for seed command)
	db, err := gorm.Open(postgres.Open(uri), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Connected to database successfully")

	// Seed demo data
	if err := seedDemoData(db, *demoPassword); err != nil {
		log.Fatalf("Failed to seed demo data: %v", err)
	}

	log.Println("Demo data seeded successfully")
}

func seedDemoData(db *gorm.DB, demoPassword string) error {
	// Check if demo seller already exists
	var demoUser models.User
	err := db.Where("email = ?", "demo-seller@example.com").First(&demoUser).Error
	if err == nil {
		log.Println("Demo seller already exists, skipping creation")
		return nil
	}

	log.Println("Creating demo seller, shop, and products...")

	// Hash the demo password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(demoPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	// Create demo user
	demoUser = models.User{
		Email:           "demo-seller@example.com",
		PasswordHash:    strPtr(string(hashedPassword)),
		FullName:        "Demo Seller",
		Role:            models.RoleUser,
		Status:          models.StatusActive,
		AuthProvider:    models.AuthEmail,
		IsEmailVerified: true,
	}
	if err := db.Create(&demoUser).Error; err != nil {
		return err
	}
	log.Println("Created demo user")

	// Create demo shop
	demoShop := models.Shop{
		UserID:                demoUser.ID,
		ShopName:              "E-Pic Demo Store",
		ShopDescription:       strPtr("Demo store for E-Pic Marketplace testing"),
		PreferredLanguage:     "en",
		CourierPreference:     "pathao",
		DeliveryChargeInside:  60,
		DeliveryChargeOutside: 120,
		AutoReplyEnabled:      true,
		AutoOrderEnabled:      true,
	}
	if err := db.Create(&demoShop).Error; err != nil {
		return err
	}
	log.Println("Created demo shop")

	// Get categories
	var fashionCategory, techCategory, homeCategory models.Category
	db.Where("slug = ?", "fashion").First(&fashionCategory)
	db.Where("slug = ?", "technology").First(&techCategory)
	db.Where("slug = ?", "home").First(&homeCategory)

	// Create demo products
	demoProducts := []models.Product{
		{
			ShopID:            demoShop.ID,
			Name:              "Classic Cotton T-Shirt",
			NameBN:            strPtr("ক্লাসিক কটন টি-শার্ট"),
			Description:       strPtr("Comfortable 100% cotton t-shirt, perfect for everyday wear"),
			Price:             450.00,
			SKU:               strPtr("EPIC-DEMO-001"),
			InitialStock:      50,
			CurrentStock:      50,
			LowStockThreshold: 10,
			IsActive:          true,
			IsOutOfStock:      false,
			CategoryID:        &fashionCategory.ID,
		},
		{
			ShopID:            demoShop.ID,
			Name:              "Wireless Bluetooth Earbuds",
			NameBN:            strPtr("ওয়্যারলেস ব্লুটুথ ইয়ারবাড"),
			Description:       strPtr("High-quality wireless earbuds with noise cancellation"),
			Price:             1250.00,
			SKU:               strPtr("EPIC-DEMO-002"),
			InitialStock:      30,
			CurrentStock:      30,
			LowStockThreshold: 5,
			IsActive:          true,
			IsOutOfStock:      false,
			CategoryID:        &techCategory.ID,
		},
		{
			ShopID:            demoShop.ID,
			Name:              "Ceramic Coffee Mug",
			NameBN:            strPtr("সিরামিক কফি মগ"),
			Description:       strPtr("Elegant ceramic mug, 350ml capacity"),
			Price:             250.00,
			SKU:               strPtr("EPIC-DEMO-003"),
			InitialStock:      100,
			CurrentStock:      100,
			LowStockThreshold: 20,
			IsActive:          true,
			IsOutOfStock:      false,
			CategoryID:        &homeCategory.ID,
		},
		{
			ShopID:            demoShop.ID,
			Name:              "Denim Jeans",
			NameBN:            strPtr("ডেনিম জিন্স"),
			Description:       strPtr("Classic fit denim jeans, comfortable and stylish"),
			Price:             950.00,
			SKU:               strPtr("EPIC-DEMO-004"),
			InitialStock:      40,
			CurrentStock:      40,
			LowStockThreshold: 8,
			IsActive:          true,
			IsOutOfStock:      false,
			CategoryID:        &fashionCategory.ID,
		},
		{
			ShopID:            demoShop.ID,
			Name:              "USB-C Charging Cable",
			NameBN:            strPtr("ইউএসবি-সি চার্জিং কেবল"),
			Description:       strPtr("Fast charging USB-C cable, 2 meters long"),
			Price:             350.00,
			SKU:               strPtr("EPIC-DEMO-005"),
			InitialStock:      80,
			CurrentStock:      80,
			LowStockThreshold: 15,
			IsActive:          true,
			IsOutOfStock:      false,
			CategoryID:        &techCategory.ID,
		},
		{
			ShopID:            demoShop.ID,
			Name:              "Bed Sheet Set",
			NameBN:            strPtr("বিছানার চাদর সেট"),
			Description:       strPtr("Premium cotton bed sheet set, king size"),
			Price:             1800.00,
			SKU:               strPtr("EPIC-DEMO-006"),
			InitialStock:      25,
			CurrentStock:      25,
			LowStockThreshold: 5,
			IsActive:          true,
			IsOutOfStock:      false,
			CategoryID:        &homeCategory.ID,
		},
		{
			ShopID:            demoShop.ID,
			Name:              "Sports Sneakers",
			NameBN:            strPtr("স্পোর্টস স্নিকার্স"),
			Description:       strPtr("Comfortable sports sneakers for running and casual wear"),
			Price:             2200.00,
			SKU:               strPtr("EPIC-DEMO-007"),
			InitialStock:      35,
			CurrentStock:      35,
			LowStockThreshold: 7,
			IsActive:          true,
			IsOutOfStock:      false,
			CategoryID:        &fashionCategory.ID,
		},
		{
			ShopID:            demoShop.ID,
			Name:              "Smart Watch",
			NameBN:            strPtr("স্মার্ট ওয়াচ"),
			Description:       strPtr("Feature-rich smart watch with fitness tracking"),
			Price:             3500.00,
			SKU:               strPtr("EPIC-DEMO-008"),
			InitialStock:      20,
			CurrentStock:      20,
			LowStockThreshold: 4,
			IsActive:          true,
			IsOutOfStock:      false,
			CategoryID:        &techCategory.ID,
		},
		{
			ShopID:            demoShop.ID,
			Name:              "Decorative Throw Pillow",
			NameBN:            strPtr("সাজসজ্জার কুশন"),
			Description:       strPtr("Soft decorative throw pillow, 16x16 inches"),
			Price:             450.00,
			SKU:               strPtr("EPIC-DEMO-009"),
			InitialStock:      60,
			CurrentStock:      60,
			LowStockThreshold: 12,
			IsActive:          true,
			IsOutOfStock:      false,
			CategoryID:        &homeCategory.ID,
		},
		{
			ShopID:            demoShop.ID,
			Name:              "Casual Polo Shirt",
			NameBN:            strPtr("ক্যাজুয়াল পোলো শার্ট"),
			Description:       strPtr("Comfortable polo shirt, available in multiple colors"),
			Price:             650.00,
			SKU:               strPtr("EPIC-DEMO-010"),
			InitialStock:      45,
			CurrentStock:      45,
			LowStockThreshold: 9,
			IsActive:          true,
			IsOutOfStock:      false,
			CategoryID:        &fashionCategory.ID,
		},
		{
			ShopID:            demoShop.ID,
			Name:              "Laptop Backpack",
			NameBN:            strPtr("ল্যাপটপ ব্যাকপ্যাক"),
			Description:       strPtr("Water-resistant laptop backpack, 15.6 inch compatible"),
			Price:             1100.00,
			SKU:               strPtr("EPIC-DEMO-011"),
			InitialStock:      25,
			CurrentStock:      25,
			LowStockThreshold: 5,
			IsActive:          true,
			IsOutOfStock:      false,
			CategoryID:        &techCategory.ID,
		},
		{
			ShopID:            demoShop.ID,
			Name:              "Kitchen Towel Set",
			NameBN:            strPtr("রান্নাঘরের তোয়ালে সেট"),
			Description:       strPtr("Set of 4 kitchen towels, highly absorbent"),
			Price:             400.00,
			SKU:               strPtr("EPIC-DEMO-012"),
			InitialStock:      70,
			CurrentStock:      70,
			LowStockThreshold: 14,
			IsActive:          true,
			IsOutOfStock:      false,
			CategoryID:        &homeCategory.ID,
		},
	}

	for _, product := range demoProducts {
		if err := db.Create(&product).Error; err != nil {
			return err
		}
		log.Printf("Created product: %s (SKU: %s)", product.Name, *product.SKU)
	}

	log.Printf("Created %d demo products", len(demoProducts))
	return nil
}

func strPtr(s string) *string {
	return &s
}
