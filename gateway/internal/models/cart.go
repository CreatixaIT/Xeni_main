package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Cart represents the carts table.
type Cart struct {
	ID        uuid.UUID  `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	UserID    *uuid.UUID `gorm:"type:uuid;index" json:"user_id,omitempty"`   // Nullable for guest carts
	SessionID *string    `gorm:"size:255;index" json:"session_id,omitempty"` // For guest carts
	ExpiresAt time.Time  `gorm:"not null;index" json:"expires_at"`
	CreatedAt time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time  `gorm:"autoUpdateTime" json:"updated_at"`

	User      User       `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	CartItems []CartItem `gorm:"foreignKey:CartID;constraint:OnDelete:CASCADE" json:"cart_items,omitempty"`
}

func (c *Cart) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

// CartItem represents the cart_items table.
type CartItem struct {
	ID        uuid.UUID `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	CartID    uuid.UUID `gorm:"type:uuid;not null;index" json:"cart_id"`
	ProductID uuid.UUID `gorm:"type:uuid;not null;index" json:"product_id"`
	Quantity  int       `gorm:"not null;default:1" json:"quantity"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	Cart    Cart    `gorm:"foreignKey:CartID;constraint:OnDelete:CASCADE" json:"-"`
	Product Product `gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE" json:"product,omitempty"`
}

func (ci *CartItem) BeforeCreate(tx *gorm.DB) error {
	if ci.ID == uuid.Nil {
		ci.ID = uuid.New()
	}
	return nil
}
