package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Category represents product categories for the marketplace.
type Category struct {
	ID          uuid.UUID  `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	Slug        string     `gorm:"size:50;uniqueIndex;not null" json:"slug"`
	Name        string     `gorm:"size:100;not null" json:"name"`
	NameBN      *string    `gorm:"column:name_bn;size:100" json:"name_bn,omitempty"`
	ParentID    *uuid.UUID  `gorm:"type:uuid;index" json:"parent_id,omitempty"`
	IsActive    bool       `gorm:"default:true;not null" json:"is_active"`
	Description *string    `gorm:"type:text" json:"description,omitempty"`
	DisplayOrder int      `gorm:"default:0" json:"display_order"`
	CreatedAt   time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time  `gorm:"autoUpdateTime" json:"updated_at"`

	Parent   *Category  `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	Children []Category `gorm:"foreignKey:ParentID" json:"children,omitempty"`
}

func (c *Category) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

// ProductCategory represents the many-to-many relationship between products and categories.
type ProductCategory struct {
	ID         uuid.UUID `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	ProductID  uuid.UUID `gorm:"type:uuid;not null;index" json:"product_id"`
	CategoryID uuid.UUID `gorm:"type:uuid;not null;index" json:"category_id"`
	IsPrimary  bool      `gorm:"default:false;not null" json:"is_primary"`
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"created_at"`

	Product  Product  `gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE" json:"-"`
	Category Category `gorm:"foreignKey:CategoryID;constraint:OnDelete:CASCADE" json:"-"`
}

func (pc *ProductCategory) BeforeCreate(tx *gorm.DB) error {
	if pc.ID == uuid.Nil {
		pc.ID = uuid.New()
	}
	return nil
}