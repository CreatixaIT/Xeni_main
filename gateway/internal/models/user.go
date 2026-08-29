package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserRole represents the role of a user.
type UserRole string

const (
	RoleUser       UserRole = "user"
	RoleAdmin      UserRole = "admin"
	RoleSuperAdmin UserRole = "super_admin"
)

// UserStatus represents the status of a user account.
type UserStatus string

const (
	StatusPending   UserStatus = "pending"
	StatusActive    UserStatus = "active"
	StatusSuspended UserStatus = "suspended"
)

// AuthProvider represents the authentication provider.
type AuthProvider string

const (
	AuthEmail    AuthProvider = "email"
	AuthGoogle   AuthProvider = "google"
	AuthFacebook AuthProvider = "facebook"
)

// User represents the users table.
type User struct {
	ID                uuid.UUID    `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	Email             string       `gorm:"uniqueIndex;size:255;not null" json:"email" validate:"required,email"`
	PasswordHash      *string      `gorm:"size:255" json:"-"`
	FullName          string       `gorm:"size:255;not null" json:"full_name" validate:"required,min=2,max=255"`
	AvatarURL         *string      `gorm:"type:text" json:"avatar_url"`
	Role              UserRole     `gorm:"type:user_role;default:'user';not null" json:"role"`
	Status            UserStatus   `gorm:"type:user_status;default:'pending';not null" json:"status"`
	AuthProvider      AuthProvider `gorm:"type:auth_provider;default:'email';not null" json:"auth_provider"`
	GoogleID          *string      `gorm:"uniqueIndex;size:255" json:"-"`
	FacebookID        *string      `gorm:"uniqueIndex;size:255" json:"-"`
	IsEmailVerified   bool         `gorm:"default:false;not null" json:"is_email_verified"`
	TwoFAEnabled      bool         `gorm:"column:two_fa_enabled;default:false;not null" json:"two_fa_enabled"`
	TwoFASecret       *string      `gorm:"column:two_fa_secret;size:255" json:"-"`
	PreferredLanguage string       `gorm:"size:5;default:'en';not null" json:"preferred_language"`
	LastLoginAt       *time.Time   `json:"last_login_at"`
	SuspendedReason   *string      `gorm:"type:text" json:"suspended_reason"`
	WhatsAppNumber    *string      `gorm:"column:whatsapp_number;size:20" json:"whatsapp_number"`
	SuspendedAt       *time.Time   `json:"suspended_at"`
	DeletedAt         *time.Time   `json:"deleted_at"`
	AdminNote         *string      `gorm:"type:text" json:"admin_note"`
	CreatedAt         time.Time    `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt         time.Time    `gorm:"autoUpdateTime" json:"updated_at"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

// RefreshToken represents the refresh_tokens table.
type RefreshToken struct {
	ID         uuid.UUID `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	UserID     uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	TokenHash  string    `gorm:"size:255;not null;index" json:"-"`
	DeviceInfo *string   `gorm:"type:text" json:"device_info"`
	IPAddress  *string   `gorm:"size:45" json:"ip_address"`
	ExpiresAt  time.Time `gorm:"not null;index" json:"expires_at"`
	Revoked    bool      `gorm:"default:false;not null" json:"revoked"`
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"created_at"`

	User User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

func (r *RefreshToken) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}

// OTPPurpose represents the purpose of an OTP code.
type OTPPurpose string

const (
	OTPEmailVerify   OTPPurpose = "email_verify"
	OTPPasswordReset OTPPurpose = "password_reset"
	OTPTwoFA         OTPPurpose = "two_fa"
)

// OTPCode represents the otp_codes table.
type OTPCode struct {
	ID        uuid.UUID  `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	CodeHash  string     `gorm:"size:255;not null" json:"-"`
	Purpose   OTPPurpose `gorm:"type:otp_purpose;not null" json:"purpose"`
	ExpiresAt time.Time  `gorm:"not null;index" json:"expires_at"`
	Used      bool       `gorm:"default:false;not null" json:"used"`
	CreatedAt time.Time  `gorm:"autoCreateTime" json:"created_at"`

	User User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

func (o *OTPCode) BeforeCreate(tx *gorm.DB) error {
	if o.ID == uuid.Nil {
		o.ID = uuid.New()
	}
	return nil
}
