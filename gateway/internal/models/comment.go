package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CommentAction string

const (
	ActionIgnored      CommentAction = "ignored"
	ActionPublicReply  CommentAction = "public_reply"
	ActionPrivateReply CommentAction = "private_reply"
	ActionHidden       CommentAction = "hidden"
)

// PostComment represents the comments table for Facebook post moderation.
type PostComment struct {
	ID           uuid.UUID     `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	ShopID       uuid.UUID     `gorm:"type:uuid;not null;index" json:"shop_id"`
	PageID       string        `gorm:"size:255;not null;index" json:"page_id"`
	PostID       string        `gorm:"size:255;not null;index" json:"post_id"`
	CommentID    string        `gorm:"size:255;not null;uniqueIndex" json:"comment_id"`
	CustomerPSID string        `gorm:"size:255;not null" json:"customer_psid"` // Often user ID on feed comments
	CustomerName *string       `gorm:"size:255" json:"customer_name"`
	Message      string        `gorm:"type:text;not null" json:"message"`
	ActionTaken  CommentAction `gorm:"type:comment_action;default:'ignored';not null" json:"action_taken"`
	AIResponse   *string       `gorm:"type:text" json:"ai_response"`
	CreatedAt    time.Time     `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time     `gorm:"autoUpdateTime" json:"updated_at"`

	Shop Shop `gorm:"foreignKey:ShopID;constraint:OnDelete:CASCADE" json:"-"`
}

func (c *PostComment) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
