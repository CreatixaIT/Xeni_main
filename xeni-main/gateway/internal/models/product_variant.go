package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProductVariant represents a specific variation of a product (e.g., Red-XL).
type ProductVariant struct {
	ID            uuid.UUID `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	ProductID     uuid.UUID `gorm:"type:uuid;not null;index" json:"product_id"`
	SKU           string    `gorm:"size:100;uniqueIndex;not null" json:"sku"`
	Color         *string   `gorm:"size:50" json:"color"`
	Size          *string   `gorm:"size:50" json:"size"`
	PriceModifier float64   `gorm:"type:decimal(12,2);default:0" json:"price_modifier"` // Added to base product price
	Stock         int       `gorm:"default:0;not null" json:"stock"`
	IsActive      bool      `gorm:"default:true;not null" json:"is_active"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	Product Product `gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE" json:"-"`
}

func (pv *ProductVariant) BeforeCreate(tx *gorm.DB) error {
	if pv.ID == uuid.Nil {
		pv.ID = uuid.New()
	}
	return nil
}
