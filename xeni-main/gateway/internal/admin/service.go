package admin

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/xeni-ai/gateway/internal/cache"
	"github.com/xeni-ai/gateway/internal/models"
	ws "github.com/xeni-ai/gateway/internal/websocket"
	"gorm.io/gorm"
)

// Service contains business logic for admin operations.
type Service struct {
	Repo  *Repository
	DB    *gorm.DB
	Cache *cache.Client
	Hub   *ws.Hub
}

// NewService creates a new admin service.
func NewService(db *gorm.DB, cacheClient *cache.Client, hub *ws.Hub) *Service {
	return &Service{
		Repo:  NewRepository(db),
		DB:    db,
		Cache: cacheClient,
		Hub:   hub,
	}
}

// ── Platform Overview ──

type AdminOverview struct {
	Stats             *OverviewStats       `json:"stats"`
	RevenueChart      []RevenueChartPoint  `json:"revenue_chart"`
	UserGrowthChart   []UserGrowthPoint    `json:"user_growth_chart"`
	PlanDistribution  []PlanDistribution   `json:"plan_distribution"`
	RecentTransactions []models.Payment    `json:"recent_transactions"`
	TopUsers          []UserListItem       `json:"top_users"`
}

func (s *Service) GetOverview() (*AdminOverview, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// Check cache first
	if s.Cache != nil {
		data, err := s.Cache.GetJSON(ctx, cache.KeyAdminOverview)
		if err == nil && data != nil {
			var overview AdminOverview
			if json.Unmarshal(data, &overview) == nil {
				return &overview, nil
			}
		}
	}

	// Cache miss — compute from DB
	overview := &AdminOverview{}

	stats, err := s.Repo.GetOverviewStats()
	if err != nil {
		return nil, err
	}
	overview.Stats = stats

	overview.RevenueChart, _ = s.Repo.GetRevenueChart(12)
	overview.UserGrowthChart, _ = s.Repo.GetUserGrowthChart(12)
	overview.PlanDistribution, _ = s.Repo.GetPlanDistribution()

	// Recent transactions (last 10)
	var recentPayments []models.Payment
	s.DB.Preload("Plan").Order("created_at DESC").Limit(10).Find(&recentPayments)
	overview.RecentTransactions = recentPayments

	// Top users by spending
	topUsers, _, _ := s.Repo.ListUsers(1, 5, "", "", "", "", "total_spent", "desc")
	overview.TopUsers = topUsers

	// Cache result for 5 minutes
	if s.Cache != nil {
		if data, err := json.Marshal(overview); err == nil {
			s.Cache.SetJSON(ctx, cache.KeyAdminOverview, data, 5*time.Minute)
		}
	}

	return overview, nil
}

// GetSystemSetting passes through to Repo
func (s *Service) GetSystemSetting(key string) (*models.SystemSetting, error) {
	return s.Repo.GetSystemSetting(key)
}

// UpsertSystemSetting passes through to Repo and can log audit
func (s *Service) UpsertSystemSetting(key string, value string, description string, userID string) error {
	err := s.Repo.UpsertSystemSetting(key, value, description, userID)
	if err == nil {
		slog.Info("Admin updated system setting", "key", key, "admin_id", userID)
	}
	return err
}

// InvalidateOverviewCache invalidates the admin overview cache.
func (s *Service) InvalidateOverviewCache() {
	if s.Cache != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		s.Cache.Delete(ctx, cache.KeyAdminOverview)
	}
}

// ── User Management ──

// ChangeUserRole changes a user's role with business rule validation.
func (s *Service) ChangeUserRole(targetUserID uuid.UUID, newRole models.UserRole, adminID uuid.UUID, adminRole string) error {
	// Cannot change own role
	if targetUserID == adminID {
		return ErrCannotChangeOwnRole
	}

	// Only super_admin can promote to admin
	if newRole == models.RoleAdmin && adminRole != string(models.RoleSuperAdmin) {
		return ErrInsufficientPermissions
	}

	// Cannot set super_admin role via API
	if newRole == models.RoleSuperAdmin {
		return ErrCannotSetSuperAdmin
	}

	result := s.DB.Model(&models.User{}).Where("id = ? AND deleted_at IS NULL", targetUserID).Update("role", newRole)
	if result.RowsAffected == 0 {
		return ErrUserNotFound
	}

	// Invalidate user list cache
	s.invalidateUserListCache()

	return nil
}

// OverrideUserPlan force-changes a user's subscription without payment.
func (s *Service) OverrideUserPlan(targetUserID uuid.UUID, planID uuid.UUID, reason string) error {
	// Find the plan
	var plan models.Plan
	if err := s.DB.Where("id = ?", planID).First(&plan).Error; err != nil {
		return ErrPlanNotFound
	}

	now := time.Now().UTC()
	end := now.AddDate(1, 0, 0)

	var sub models.Subscription
	result := s.DB.Where("user_id = ?", targetUserID).First(&sub)
	if result.Error != nil {
		sub = models.Subscription{
			UserID:             targetUserID,
			PlanID:             plan.ID,
			Status:             models.SubActive,
			BillingCycle:       "manual",
			CurrentPeriodStart: now,
			CurrentPeriodEnd:   end,
		}
		s.DB.Create(&sub)
	} else {
		s.DB.Model(&sub).Updates(map[string]interface{}{
			"plan_id":              plan.ID,
			"status":               models.SubActive,
			"billing_cycle":        "manual",
			"current_period_start": now,
			"current_period_end":   end,
			"cancelled_at":         nil,
		})
	}

	// Invalidate subscription cache
	if s.Cache != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		s.Cache.DeleteSubscription(ctx, targetUserID.String())
	}

	s.invalidateUserListCache()
	return nil
}

// ChangeUserStatus suspends or activates a user.
func (s *Service) ChangeUserStatus(targetUserID uuid.UUID, newStatus models.UserStatus, reason string, adminRole string) error {
	// Look up target user
	var targetUser models.User
	if err := s.DB.Where("id = ? AND deleted_at IS NULL", targetUserID).First(&targetUser).Error; err != nil {
		return ErrUserNotFound
	}

	// Cannot suspend super_admin
	if targetUser.Role == models.RoleSuperAdmin && newStatus == models.StatusSuspended {
		return ErrCannotSuspendSuperAdmin
	}

	updates := map[string]interface{}{"status": newStatus}

	if newStatus == models.StatusSuspended {
		now := time.Now()
		updates["suspended_reason"] = reason
		updates["suspended_at"] = now
	} else {
		updates["suspended_reason"] = nil
		updates["suspended_at"] = nil
	}

	s.DB.Model(&models.User{}).Where("id = ?", targetUserID).Updates(updates)

	// If suspending: force logout by blocking all active JWTs — we log this action
	// The actual JWT blocklisting would require iterating active sessions
	// For simplicity we note this in audit logs and rely on token expiry + status check

	s.invalidateUserListCache()
	return nil
}

// SoftDeleteUser soft-deletes a user.
func (s *Service) SoftDeleteUser(targetUserID uuid.UUID, adminRole string) error {
	var targetUser models.User
	if err := s.DB.Where("id = ? AND deleted_at IS NULL", targetUserID).First(&targetUser).Error; err != nil {
		return ErrUserNotFound
	}

	// Cannot delete super_admin
	if targetUser.Role == models.RoleSuperAdmin {
		return ErrCannotDeleteSuperAdmin
	}

	now := time.Now()
	s.DB.Model(&models.User{}).Where("id = ?", targetUserID).Update("deleted_at", now)

	// Cancel active subscription
	s.DB.Model(&models.Subscription{}).Where("user_id = ? AND status = ?", targetUserID, models.SubActive).
		Updates(map[string]interface{}{
			"status":       models.SubCancelled,
			"cancelled_at": now,
		})

	s.invalidateUserListCache()
	return nil
}

// ── Plan Management ──

// UpdatePlan updates a plan with business rule enforcement.
func (s *Service) UpdatePlan(planID uuid.UUID, updates map[string]interface{}) error {
	var plan models.Plan
	if err := s.DB.Where("id = ?", planID).First(&plan).Error; err != nil {
		return ErrPlanNotFound
	}

	// If setting is_most_popular to true, clear it from all other plans
	if isMostPopular, ok := updates["is_most_popular"]; ok && isMostPopular == true {
		s.DB.Model(&models.Plan{}).Where("id != ?", planID).Update("is_most_popular", false)
	}

	// If deactivating, check at least one plan remains active
	if isActive, ok := updates["is_active"]; ok && isActive == false {
		var activeCount int64
		s.DB.Model(&models.Plan{}).Where("is_active = ? AND id != ?", true, planID).Count(&activeCount)
		if activeCount == 0 {
			return ErrCannotDeactivateLastPlan
		}
	}

	if err := s.DB.Model(&plan).Updates(updates).Error; err != nil {
		return err
	}

	// Invalidate plans cache
	if s.Cache != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		s.Cache.Delete(ctx, cache.KeyBillingPlans)
		s.Cache.Delete(ctx, "content:plans")
	}

	return nil
}

// ── User Conversations ──

func (s *Service) GetUserConversations(userID uuid.UUID, page, limit int) ([]models.Conversation, int64, error) {
	return s.Repo.GetConversationsByUser(userID, page, limit)
}

func (s *Service) invalidateUserListCache() {
	if s.Cache != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := s.Cache.DeleteByPattern(ctx, "admin:users:list:*"); err != nil {
			slog.Warn("failed to invalidate user list cache", "error", err)
		}
	}
}

// ── Sentinel Errors ──

type AdminError struct {
	Message string
	Code    int
}

func (e *AdminError) Error() string { return e.Message }

var (
	ErrCannotChangeOwnRole     = &AdminError{"Cannot change your own role", 400}
	ErrInsufficientPermissions = &AdminError{"Only super_admin can promote to admin", 403}
	ErrCannotSetSuperAdmin     = &AdminError{"Cannot set super_admin role via this endpoint", 400}
	ErrUserNotFound            = &AdminError{"User not found", 404}
	ErrPlanNotFound            = &AdminError{"Plan not found", 404}
	ErrCannotSuspendSuperAdmin = &AdminError{"Cannot suspend a super_admin account", 400}
	ErrCannotDeleteSuperAdmin  = &AdminError{"Cannot delete a super_admin account", 400}
	ErrCannotDeactivateLastPlan = &AdminError{"Cannot deactivate the last active plan", 400}
)
