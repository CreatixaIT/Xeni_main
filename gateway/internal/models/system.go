package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SystemSetting represents the system_settings table.
type SystemSetting struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	SettingKey   string     `gorm:"size:255;not null;uniqueIndex" json:"setting_key"`
	SettingValue *string    `gorm:"type:text" json:"setting_value"`
	Description  *string    `gorm:"type:text" json:"description"`
	UpdatedAt    time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
	UpdatedBy    *uuid.UUID `gorm:"type:uuid" json:"updated_by,omitempty"`
}
// BeforeCreate generates a new UUID if not provided.
func (s *SystemSetting) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return
}
