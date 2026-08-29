package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PlanTier represents the subscription plan tier.
type PlanTier string

const (
	TierStarter      PlanTier = "starter"
	TierProfessional PlanTier = "professional"
	TierPremium      PlanTier = "premium"
	TierEnterprise   PlanTier = "enterprise"
)

// SubscriptionStatus represents the status of a subscription.
type SubscriptionStatus string

const (
	SubActive    SubscriptionStatus = "active"
	SubPastDue   SubscriptionStatus = "past_due"
	SubCancelled SubscriptionStatus = "cancelled"
	SubTrialing  SubscriptionStatus = "trialing"
)

// PaymentStatus represents the status of a payment.
type PaymentStatus string

const (
	PaymentPending  PaymentStatus = "pending"
	PaymentSuccess  PaymentStatus = "success"
	PaymentFailed   PaymentStatus = "failed"
	PaymentRefunded PaymentStatus = "refunded"
)

// Plan represents the plans table.
type Plan struct {
	ID              uuid.UUID `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	Name            string    `gorm:"size:100;not null" json:"name"`
	Tier            PlanTier  `gorm:"type:plan_tier;uniqueIndex;not null" json:"tier"`
	PriceMonthlyBDT float64   `gorm:"column:price_monthly_bdt;type:decimal(12,2);default:0;not null" json:"price_monthly_bdt"`
	Features        JSON      `gorm:"type:jsonb;default:'{}';not null" json:"features"`
	IsActive        bool      `gorm:"default:true;not null" json:"is_active"`
	Tagline         *string   `gorm:"size:100" json:"tagline"`
	TaglineBN       *string   `gorm:"column:tagline_bn;size:200" json:"tagline_bn"`
	CTAText         string    `gorm:"column:cta_text;size:50;default:'Get Started'" json:"cta_text"`
	CTATextBN       string    `gorm:"column:cta_text_bn;size:100;default:'শুরু করুন'" json:"cta_text_bn"`
	IsMostPopular   bool      `gorm:"default:false" json:"is_most_popular"`
	DisplayOrder    int       `gorm:"default:0" json:"display_order"`
	CreatedAt       time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (p *Plan) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

// Subscription represents the subscriptions table.
type Subscription struct {
	ID                 uuid.UUID          `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	UserID             uuid.UUID          `gorm:"type:uuid;uniqueIndex;not null" json:"user_id"`
	PlanID             uuid.UUID          `gorm:"type:uuid;not null" json:"plan_id"`
	Status             SubscriptionStatus `gorm:"type:subscription_status;default:'active';not null" json:"status"`
	BillingCycle       string             `gorm:"size:20;default:'monthly';not null" json:"billing_cycle"`
	CurrentPeriodStart time.Time          `gorm:"not null" json:"current_period_start"`
	CurrentPeriodEnd   time.Time          `gorm:"not null;index" json:"current_period_end"`
	CancelledAt        *time.Time         `json:"cancelled_at"`
	CreatedAt          time.Time          `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt          time.Time          `gorm:"autoUpdateTime" json:"updated_at"`

	User User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Plan Plan `gorm:"foreignKey:PlanID" json:"plan,omitempty"`
}

func (s *Subscription) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

// Payment represents the payments table.
type Payment struct {
	ID                   uuid.UUID     `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	UserID               uuid.UUID     `gorm:"type:uuid;not null;index" json:"user_id"`
	SubscriptionID       *uuid.UUID    `gorm:"type:uuid;index" json:"subscription_id"`
	PlanID               uuid.UUID     `gorm:"type:uuid;not null" json:"plan_id"`
	Amount               float64       `gorm:"type:decimal(12,2);not null" json:"amount"`
	Currency             string        `gorm:"size:3;default:'BDT';not null" json:"currency"`
	Status               PaymentStatus `gorm:"type:payment_status;default:'pending';not null" json:"status"`
	Gateway              string        `gorm:"size:20;default:'sslcommerz';not null;index" json:"gateway"`
	GatewayTransactionID *string       `gorm:"size:255;index" json:"gateway_transaction_id"`
	GatewayResponse      JSON          `gorm:"type:jsonb" json:"gateway_response"`
	CreatedAt            time.Time     `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt            time.Time     `gorm:"autoUpdateTime" json:"updated_at"`

	User         User          `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	Subscription *Subscription `gorm:"foreignKey:SubscriptionID;constraint:OnDelete:SET NULL" json:"-"`
	Plan         Plan          `gorm:"foreignKey:PlanID" json:"plan,omitempty"`
}

func (p *Payment) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
