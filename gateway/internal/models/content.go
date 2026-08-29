package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ContentSection represents the content_sections table for dynamic CMS content.
type ContentSection struct {
	ID         uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	SectionKey string     `gorm:"size:50;uniqueIndex;not null" json:"section_key"`
	ContentEN  JSON       `gorm:"type:jsonb;default:'{}';not null" json:"content_en"`
	ContentBN  JSON       `gorm:"type:jsonb;default:'{}';not null" json:"content_bn"`
	IsActive   bool       `gorm:"default:true" json:"is_active"`
	UpdatedBy  *uuid.UUID `gorm:"type:uuid" json:"updated_by"`
	UpdatedAt  time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
	CreatedAt  time.Time  `gorm:"autoCreateTime" json:"created_at"`

	Updater *User `gorm:"foreignKey:UpdatedBy;constraint:OnDelete:SET NULL" json:"-"`
}

func (cs *ContentSection) BeforeCreate(tx *gorm.DB) error {
	if cs.ID == uuid.Nil {
		cs.ID = uuid.New()
	}
	return nil
}

// ReviewStatus represents the moderation status of a review.
type ReviewStatus string

const (
	ReviewPending  ReviewStatus = "pending"
	ReviewApproved ReviewStatus = "approved"
	ReviewRejected ReviewStatus = "rejected"
)

// Review represents the reviews table for user testimonials.
type Review struct {
	ID               uuid.UUID    `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID           *uuid.UUID   `gorm:"type:uuid" json:"user_id"`
	ReviewerName     string       `gorm:"size:100;not null" json:"reviewer_name"`
	ReviewerAvatarURL *string     `gorm:"size:500" json:"reviewer_avatar_url"`
	PlanAtReview     *string      `gorm:"size:50" json:"plan_at_review"`
	StarRating       int          `gorm:"type:smallint;not null" json:"star_rating"`
	ReviewText       string       `gorm:"type:text;not null" json:"review_text"`
	Status           ReviewStatus `gorm:"size:20;default:'pending';not null" json:"status"`
	DisplayOrder     int          `gorm:"default:0" json:"display_order"`
	ModeratedBy      *uuid.UUID   `gorm:"type:uuid" json:"moderated_by"`
	ModeratedAt      *time.Time   `json:"moderated_at"`
	AdminNote        *string      `gorm:"type:text" json:"admin_note"`
	ShowOnLanding    bool         `gorm:"default:false" json:"show_on_landing"`
	CreatedAt        time.Time    `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt        time.Time    `gorm:"autoUpdateTime" json:"updated_at"`

	User      *User `gorm:"foreignKey:UserID;constraint:OnDelete:SET NULL" json:"-"`
	Moderator *User `gorm:"foreignKey:ModeratedBy;constraint:OnDelete:SET NULL" json:"-"`
}

func (r *Review) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}

// ReviewSettings represents the review_settings table (single row).
type ReviewSettings struct {
	ID                  int       `gorm:"primaryKey;default:1" json:"id"`
	AutoApprovePremium  bool      `gorm:"default:false" json:"auto_approve_premium"`
	ShowStarRating      bool      `gorm:"default:true" json:"show_star_rating"`
	MinStarToShow       int       `gorm:"type:smallint;default:4" json:"min_star_to_show"`
	MaxReviewsOnLanding int       `gorm:"default:6" json:"max_reviews_on_landing"`
	UpdatedAt           time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// PlatformMetricsCache represents cached daily metrics for the admin dashboard.
type PlatformMetricsCache struct {
	ID                   uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	MetricDate           time.Time `gorm:"type:date;uniqueIndex;not null" json:"metric_date"`
	TotalUsers           int       `gorm:"default:0" json:"total_users"`
	NewUsersToday        int       `gorm:"default:0" json:"new_users_today"`
	ActiveSubscriptions  int       `gorm:"default:0" json:"active_subscriptions"`
	RevenueToday         float64   `gorm:"type:decimal(12,2);default:0" json:"revenue_today"`
	RevenueMonth         float64   `gorm:"type:decimal(12,2);default:0" json:"revenue_month"`
	AITasksToday         int       `gorm:"default:0" json:"ai_tasks_today"`
	MessagesRepliedToday int       `gorm:"default:0" json:"messages_replied_today"`
	OrdersProcessedToday int       `gorm:"default:0" json:"orders_processed_today"`
	TaskSuccessRate      float64   `gorm:"type:decimal(5,2);default:0" json:"task_success_rate"`
	ComputedAt           time.Time `gorm:"autoCreateTime" json:"computed_at"`
}

func (p *PlatformMetricsCache) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
