package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StockMovementType string

const (
	MovementSale       StockMovementType = "sale"
	MovementRestock    StockMovementType = "restock"
	MovementAdjustment StockMovementType = "adjustment"
	MovementReturn     StockMovementType = "return"
)

// InventoryLog represents a stock movement ledger (audit trail).
type InventoryLog struct {
	ID           uuid.UUID         `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	ProductID    uuid.UUID         `gorm:"type:uuid;not null;index" json:"product_id"`
	VariantID    *uuid.UUID        `gorm:"type:uuid;index" json:"variant_id,omitempty"`
	Type         StockMovementType `gorm:"type:stock_movement_type;not null;index" json:"type"`
	Quantity     int               `gorm:"not null" json:"quantity"` // Positive for increases, negative for decreases
	OldStock     int               `gorm:"not null" json:"old_stock"`
	NewStock     int               `gorm:"not null" json:"new_stock"`
	ReferenceID  *string           `gorm:"size:255;index" json:"reference_id,omitempty"` // e.g. Order ID or internal Note
	Notes        *string           `gorm:"type:text" json:"notes,omitempty"`
	CreatedAt    time.Time         `gorm:"autoCreateTime;index" json:"created_at"`

	Product Product         `gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE" json:"-"`
	Variant *ProductVariant `gorm:"foreignKey:VariantID;constraint:OnDelete:SET NULL" json:"-"`
}

func (il *InventoryLog) BeforeCreate(tx *gorm.DB) error {
	if il.ID == uuid.Nil {
		il.ID = uuid.New()
	}
	return nil
}
