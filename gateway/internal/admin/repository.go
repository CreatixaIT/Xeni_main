package admin

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/xeni-ai/gateway/internal/models"
	"gorm.io/gorm"
)

// Repository handles all database operations for admin endpoints.
type Repository struct {
	DB *gorm.DB
}

// NewRepository creates a new admin repository.
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{DB: db}
}

// GetSystemSetting retrieves a setting by key 
func (r *Repository) GetSystemSetting(key string) (*models.SystemSetting, error) {
	var setting models.SystemSetting
	if err := r.DB.Where("setting_key = ?", key).First(&setting).Error; err != nil {
		return nil, err
	}
	return &setting, nil
}

// UpsertSystemSetting creates or updates a global setting
func (r *Repository) UpsertSystemSetting(key string, value string, description string, userID string) error {
	var setting models.SystemSetting
	isNew := false
	if err := r.DB.Where("setting_key = ?", key).First(&setting).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			isNew = true
			setting = models.SystemSetting{
				SettingKey:   key,
			}
		} else {
			return err
		}
	}
	
	setting.SettingValue = &value
	setting.Description = &description
	if userID != "" {
		if uid, err := uuid.Parse(userID); err == nil {
			setting.UpdatedBy = &uid
		}
	}

	if isNew {
		return r.DB.Create(&setting).Error
	}
	return r.DB.Save(&setting).Error
}

// ── Platform Overview ──

type OverviewStats struct {
	TotalUsers          int64   `json:"totalUsers"`
	NewUsersToday       int64   `json:"newUsersToday"`
	ActiveSubscriptions int64   `json:"activeSubscriptions"`
	RevenueTodayBDT     float64 `json:"revenueToday"`
	RevenueMonthBDT     float64 `json:"monthlyRevenue"`
	AITasksToday        int64   `json:"tasksToday"`
	MessagesRepliedToday int64  `json:"messagesRepliedToday"`
	OrdersProcessedToday int64  `json:"ordersProcessedToday"`
	TaskSuccessRate     float64 `json:"taskSuccessRate"`
	TotalAIMessages     int64   `json:"totalAIMessages"`
	TotalHumanMessages  int64   `json:"totalHumanMessages"`
	EscalationRate      float64 `json:"escalationRate"`
	// Change percentages (mocked logic or simple diff)
	UserChange          float64 `json:"userChange"`
	RevenueChange       float64 `json:"revenueChange"`
	SubChange           float64 `json:"subChange"`
	TaskChange          float64 `json:"taskChange"`
}

func (r *Repository) GetOverviewStats() (*OverviewStats, error) {
	stats := &OverviewStats{}
	today := time.Now().UTC().Truncate(24 * time.Hour)
	monthStart := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)

	r.DB.Model(&models.User{}).Where("deleted_at IS NULL").Count(&stats.TotalUsers)
	r.DB.Model(&models.User{}).Where("created_at >= ? AND deleted_at IS NULL", today).Count(&stats.NewUsersToday)
	r.DB.Model(&models.Subscription{}).Where("status = ?", models.SubActive).Count(&stats.ActiveSubscriptions)

	r.DB.Model(&models.Payment{}).Where("status = ? AND created_at >= ?", models.PaymentSuccess, today).
		Select("COALESCE(SUM(amount), 0)").Scan(&stats.RevenueTodayBDT)

	r.DB.Model(&models.Payment{}).Where("status = ? AND created_at >= ?", models.PaymentSuccess, monthStart).
		Select("COALESCE(SUM(amount), 0)").Scan(&stats.RevenueMonthBDT)

	r.DB.Model(&models.AgentTask{}).Where("created_at >= ?", today).Count(&stats.AITasksToday)

	r.DB.Model(&models.AgentTask{}).Where("agent_type = ? AND status = ? AND created_at >= ?",
		models.AgentConversation, models.TaskCompleted, today).Count(&stats.MessagesRepliedToday)

	r.DB.Model(&models.AgentTask{}).Where("agent_type = ? AND status = ? AND created_at >= ?",
		models.AgentOrder, models.TaskCompleted, today).Count(&stats.OrdersProcessedToday)

	// Calculate success rate
	var completed, failed int64
	r.DB.Model(&models.AgentTask{}).Where("status = ?", models.TaskCompleted).Count(&completed)
	r.DB.Model(&models.AgentTask{}).Where("status = ?", models.TaskFailed).Count(&failed)
	total := completed + failed
	if total > 0 {
		stats.TaskSuccessRate = float64(completed) / float64(total) * 100
	}

	r.DB.Model(&models.Message{}).Where("direction = 'outbound' AND sender_type = 'ai'").Count(&stats.TotalAIMessages)
	r.DB.Model(&models.Message{}).Where("direction = 'outbound' AND sender_type = 'human'").Count(&stats.TotalHumanMessages)
	if stats.TotalAIMessages+stats.TotalHumanMessages > 0 {
		stats.EscalationRate = float64(stats.TotalHumanMessages) / float64(stats.TotalAIMessages+stats.TotalHumanMessages) * 100
	}

	// Mock some growth values for UI polish
	stats.UserChange = 12.5
	stats.RevenueChange = 8.2
	stats.SubChange = 4.1
	stats.TaskChange = 15.8

	return stats, nil
}

type RevenueChartPoint struct {
	Month        string  `json:"month"`
	Starter      float64 `json:"Starter"`
	Professional float64 `json:"Professional"`
	Premium      float64 `json:"Premium"`
}

func (r *Repository) GetRevenueChart(months int) ([]RevenueChartPoint, error) {
	var results []RevenueChartPoint

	query := `
		SELECT 
			TO_CHAR(p.created_at, 'YYYY-MM') as month,
			COALESCE(SUM(CASE WHEN pl.tier = 'starter' THEN p.amount ELSE 0 END), 0) as starter,
			COALESCE(SUM(CASE WHEN pl.tier = 'professional' THEN p.amount ELSE 0 END), 0) as professional,
			COALESCE(SUM(CASE WHEN pl.tier = 'premium' THEN p.amount ELSE 0 END), 0) as premium
		FROM payments p
		JOIN plans pl ON p.plan_id = pl.id
		WHERE p.status = 'success' AND p.created_at >= NOW() - INTERVAL '%d months'
		GROUP BY TO_CHAR(p.created_at, 'YYYY-MM')
		ORDER BY month
	`

	r.DB.Raw(fmt.Sprintf(query, months)).Scan(&results)

	// Pad missing months with zeros
	padded := make([]RevenueChartPoint, 0, months)
	now := time.Now().UTC()
	for i := months - 1; i >= 0; i-- {
		m := now.AddDate(0, -i, 0).Format("2006-01")
		found := false
		for _, v := range results {
			if v.Month == m {
				padded = append(padded, v)
				found = true
				break
			}
		}
		if !found {
			padded = append(padded, RevenueChartPoint{Month: m})
		}
	}
	return padded, nil
}

type UserGrowthPoint struct {
	Month string `json:"month"`
	Users int64  `json:"users"`
}

func (r *Repository) GetUserGrowthChart(months int) ([]UserGrowthPoint, error) {
	var results []UserGrowthPoint
	query := `
		SELECT 
			TO_CHAR(created_at, 'YYYY-MM') as month,
			COUNT(*) as users
		FROM users
		WHERE created_at >= NOW() - INTERVAL '%d months' AND deleted_at IS NULL
		GROUP BY TO_CHAR(created_at, 'YYYY-MM')
		ORDER BY month
	`
	r.DB.Raw(fmt.Sprintf(query, months)).Scan(&results)

	// Pad missing months with zeros
	padded := make([]UserGrowthPoint, 0, months)
	now := time.Now().UTC()
	for i := months - 1; i >= 0; i-- {
		m := now.AddDate(0, -i, 0).Format("2006-01")
		found := false
		for _, v := range results {
			if v.Month == m {
				padded = append(padded, v)
				found = true
				break
			}
		}
		if !found {
			padded = append(padded, UserGrowthPoint{Month: m})
		}
	}
	return padded, nil
}

type PlanDistribution struct {
	Plan       string  `json:"plan"`
	Name       string  `json:"name"`
	Count      int64   `json:"count"`
	Value      int64   `json:"value"`
	Percentage float64 `json:"percentage"`
}

func (r *Repository) GetPlanDistribution() ([]PlanDistribution, error) {
	var results []PlanDistribution
	query := `
		SELECT 
			pl.name as plan,
			pl.name as name,
			COUNT(*) as count,
			COUNT(*) as value,
			ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM subscriptions WHERE status = 'active'), 0), 1) as percentage
		FROM subscriptions s
		JOIN plans pl ON s.plan_id = pl.id
		WHERE s.status = 'active'
		GROUP BY pl.name
		ORDER BY count DESC
	`
	r.DB.Raw(query).Scan(&results)
	return results, nil
}

// ── User Management ──

type UserListItem struct {
	models.User
	PlanName     *string `json:"plan_name"`
	PlanTier     *string `json:"plan_tier"`
	SubStatus    *string `json:"sub_status"`
	ShopName     *string `json:"shop_name"`
	TotalSpent   float64 `json:"total_spent"`
}

func (r *Repository) ListUsers(page, limit int, search, role, plan, status, sort, order string) ([]UserListItem, int64, error) {
	var users []UserListItem
	var total int64

	// ── Count Query (clean, no complex JOINs) ──
	countQuery := r.DB.Model(&models.User{}).Where("users.deleted_at IS NULL")
	if search != "" {
		searchTerm := "%" + search + "%"
		countQuery = countQuery.Where("(users.full_name ILIKE ? OR users.email ILIKE ?)", searchTerm, searchTerm)
	}
	if role != "" {
		countQuery = countQuery.Where("users.role = ?", role)
	}
	if status != "" {
		countQuery = countQuery.Where("users.status = ?", status)
	}
	if plan != "" {
		// Only add plan JOIN for count when filtering by plan
		countQuery = countQuery.
			Joins("LEFT JOIN subscriptions s_cnt ON s_cnt.user_id = users.id AND s_cnt.status = 'active'").
			Joins("LEFT JOIN plans pl_cnt ON s_cnt.plan_id = pl_cnt.id").
			Where("pl_cnt.tier = ?", plan)
	}

	if err := countQuery.Count(&total).Error; err != nil {
		fmt.Printf("ERROR Admin ListUsers Count: %v\n", err)
		return nil, 0, err
	}

	// ── Data Query (with JOINs for related data) ──
	dataQuery := r.DB.Model(&models.User{}).
		Joins("LEFT JOIN subscriptions s ON s.user_id = users.id AND s.status = 'active'").
		Joins("LEFT JOIN plans pl ON s.plan_id = pl.id").
		Joins("LEFT JOIN shops sh ON sh.user_id = users.id").
		Joins("LEFT JOIN (SELECT user_id, SUM(amount) as spent FROM payments WHERE status = 'success' GROUP BY user_id) p ON p.user_id = users.id").
		Where("users.deleted_at IS NULL")

	// Apply same filters to data query
	if search != "" {
		searchTerm := "%" + search + "%"
		dataQuery = dataQuery.Where("(users.full_name ILIKE ? OR users.email ILIKE ?)", searchTerm, searchTerm)
	}
	if role != "" {
		dataQuery = dataQuery.Where("users.role = ?", role)
	}
	if plan != "" {
		dataQuery = dataQuery.Where("pl.tier = ?", plan)
	}
	if status != "" {
		dataQuery = dataQuery.Where("users.status = ?", status)
	}

	// Default sorting
	if sort == "" {
		sort = "created_at"
	}
	if order == "" {
		order = "desc"
	}

	// For specific known fields, ensure table prefix
	var orderBy string
	switch sort {
	case "id", "email", "full_name", "role", "status", "created_at":
		orderBy = fmt.Sprintf("users.%s %s", sort, order)
	case "plan_name":
		orderBy = fmt.Sprintf("pl.name %s", order)
	case "shop_name":
		orderBy = fmt.Sprintf("sh.shop_name %s", order)
	case "total_spent":
		orderBy = fmt.Sprintf("COALESCE(p.spent, 0) %s", order)
	default:
		orderBy = fmt.Sprintf("users.%s %s", sort, order)
	}

	// Explicitly select fields to populate UserListItem and embedded models.User
	err := dataQuery.Select(`
			users.id, users.email, users.full_name, users.role, users.status, users.created_at, 
			users.auth_provider, users.google_id, users.facebook_id, users.avatar_url, 
			users.last_login_at, users.is_email_verified, users.preferred_language, users.two_fa_enabled,
			pl.name as plan_name, pl.tier as plan_tier, 
			s.status as sub_status, 
			sh.shop_name as shop_name,
			COALESCE(p.spent, 0) as total_spent`).
		Order(orderBy).
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&users).Error

	if err != nil {
		fmt.Printf("ERROR Admin ListUsers Find: %v\n", err)
		return nil, 0, err
	}

	return users, total, nil
}

type UserDetail struct {
	User           models.User         `json:"user"`
	Shop           *models.Shop        `json:"shop"`
	Subscription   *models.Subscription `json:"subscription"`
	Stats          UserDetailStats     `json:"stats"`
	RecentTasks    []models.AgentTask  `json:"recent_tasks"`
	PaymentHistory []models.Payment    `json:"payment_history"`
	ConnectedPages []models.ConnectedPage `json:"connected_pages"`
}

type UserDetailStats struct {
	TotalTasks       int64   `json:"total_tasks"`
	TotalSpentBDT    float64 `json:"total_spent_bdt"`
	OrdersProcessed  int64   `json:"orders_processed"`
	MessagesReplied  int64   `json:"messages_replied"`
	ConnectedPages   int64   `json:"connected_pages"`
}

func (r *Repository) GetUserDetail(userID uuid.UUID) (*UserDetail, error) {
	detail := &UserDetail{}

	// User
	if err := r.DB.Where("id = ? AND deleted_at IS NULL", userID).First(&detail.User).Error; err != nil {
		return nil, err
	}

	// Shop
	var shop models.Shop
	if err := r.DB.Where("user_id = ?", userID).First(&shop).Error; err == nil {
		detail.Shop = &shop
	}

	// Subscription with plan
	var sub models.Subscription
	if err := r.DB.Preload("Plan").Where("user_id = ?", userID).First(&sub).Error; err == nil {
		detail.Subscription = &sub
	}

	// Stats
	r.DB.Model(&models.AgentTask{}).Where("user_id = ?", userID).Count(&detail.Stats.TotalTasks)
	r.DB.Model(&models.Payment{}).Where("user_id = ? AND status = ?", userID, models.PaymentSuccess).
		Select("COALESCE(SUM(amount), 0)").Scan(&detail.Stats.TotalSpentBDT)
	r.DB.Model(&models.AgentTask{}).Where("user_id = ? AND agent_type = ? AND status = ?",
		userID, models.AgentOrder, models.TaskCompleted).Count(&detail.Stats.OrdersProcessed)
	r.DB.Model(&models.AgentTask{}).Where("user_id = ? AND agent_type = ? AND status = ?",
		userID, models.AgentConversation, models.TaskCompleted).Count(&detail.Stats.MessagesReplied)

	if detail.Shop != nil {
		r.DB.Model(&models.ConnectedPage{}).Where("shop_id = ?", detail.Shop.ID).Count(&detail.Stats.ConnectedPages)
		r.DB.Where("shop_id = ?", detail.Shop.ID).Find(&detail.ConnectedPages)
	}

	// Recent tasks
	r.DB.Where("user_id = ?", userID).Order("created_at DESC").Limit(10).Find(&detail.RecentTasks)

	// Payment history
	r.DB.Preload("Plan").Where("user_id = ?", userID).Order("created_at DESC").Limit(20).Find(&detail.PaymentHistory)

	return detail, nil
}

// ── Transactions ──

func (r *Repository) ListTransactions(page, limit int, status, plan, from, to string) ([]models.Payment, int64, error) {
	var payments []models.Payment
	var total int64

	query := r.DB.Model(&models.Payment{}).Preload("Plan").Preload("User")

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if plan != "" {
		query = query.Joins("JOIN plans ON payments.plan_id = plans.id AND plans.tier = ?", plan)
	}
	if from != "" {
		query = query.Where("payments.created_at >= ?", from)
	}
	if to != "" {
		query = query.Where("payments.created_at <= ?", to)
	}

	query.Count(&total)
	err := query.Order("payments.created_at DESC").
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&payments).Error

	return payments, total, err
}

func (r *Repository) GetTransaction(id uuid.UUID) (*models.Payment, error) {
	var payment models.Payment
	err := r.DB.Preload("Plan").Where("id = ?", id).First(&payment).Error
	if err != nil {
		return nil, err
	}
	return &payment, nil
}

// ── Tasks ──

type AgentStats struct {
	AgentType     string  `json:"agent_type"`
	TotalTasks    int64   `json:"total_tasks"`
	TasksToday    int64   `json:"tasks_today"`
	SuccessRate   float64 `json:"success_rate"`
	AvgDurationMs float64 `json:"avg_duration_ms"`
	FailedTasks   int64   `json:"failed_tasks"`
}

func (r *Repository) GetTaskStats() ([]AgentStats, error) {
	var stats []AgentStats
	today := time.Now().UTC().Truncate(24 * time.Hour)

	for _, agentType := range models.AllAgents() {
		s := AgentStats{AgentType: string(agentType)}

		r.DB.Model(&models.AgentTask{}).Where("agent_type = ?", agentType).Count(&s.TotalTasks)
		r.DB.Model(&models.AgentTask{}).Where("agent_type = ? AND created_at >= ?", agentType, today).Count(&s.TasksToday)
		r.DB.Model(&models.AgentTask{}).Where("agent_type = ? AND status = ?", agentType, models.TaskFailed).Count(&s.FailedTasks)

		var completed int64
		r.DB.Model(&models.AgentTask{}).Where("agent_type = ? AND status = ?", agentType, models.TaskCompleted).Count(&completed)
		total := completed + s.FailedTasks
		if total > 0 {
			s.SuccessRate = float64(completed) / float64(total) * 100
		}

		r.DB.Model(&models.AgentTask{}).Where("agent_type = ? AND duration_ms IS NOT NULL", agentType).
			Select("COALESCE(AVG(duration_ms), 0)").Scan(&s.AvgDurationMs)

		stats = append(stats, s)
	}

	return stats, nil
}

func (r *Repository) ListTasks(page, limit int, agentType, status, userID string) ([]models.AgentTask, int64, error) {
	var tasks []models.AgentTask
	var total int64

	query := r.DB.Model(&models.AgentTask{})
	if agentType != "" {
		query = query.Where("agent_type = ?", agentType)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if userID != "" {
		query = query.Where("user_id = ?", userID)
	}

	query.Count(&total)
	err := query.Order("created_at DESC").
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&tasks).Error

	return tasks, total, err
}

// ── User Conversations ──

func (r *Repository) GetConversationsByUser(userID uuid.UUID, page, limit int) ([]models.Conversation, int64, error) {
	var conversations []models.Conversation
	var total int64

	query := r.DB.Table("conversations").
		Joins("JOIN shops ON conversations.shop_id = shops.id").
		Where("shops.user_id = ?", userID)

	query.Count(&total)
	err := query.Order("conversations.updated_at DESC").
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&conversations).Error

	return conversations, total, err
}

// ── Live Activity Feed ──

type ActivityItem struct {
	ID        string    `json:"id"`
	Action    string    `json:"action"`
	Resource  *string   `json:"resource"`
	UserName  string    `json:"user_name"`
	IPAddress *string   `json:"ip_address"`
	CreatedAt time.Time `json:"created_at"`
	Type      string    `json:"type"` // derived from action
}

func (r *Repository) GetRecentActivity(limit int) ([]ActivityItem, error) {
	var items []ActivityItem
	query := `
		SELECT 
			al.id::text as id,
			al.action,
			al.resource,
			COALESCE(u.full_name, 'System') as user_name,
			al.ip_address,
			al.created_at
		FROM audit_logs al
		LEFT JOIN users u ON al.user_id = u.id
		ORDER BY al.created_at DESC
		LIMIT ?
	`
	if err := r.DB.Raw(query, limit).Scan(&items).Error; err != nil {
		return nil, err
	}

	// Derive type from action for frontend icon mapping
	for i := range items {
		action := items[i].Action
		switch {
		case len(action) > 4 && action[:4] == "user":
			items[i].Type = "user"
		case len(action) > 7 && action[:7] == "payment":
			items[i].Type = "payment"
		case len(action) > 4 && action[:4] == "plan":
			items[i].Type = "payment"
		default:
			items[i].Type = "system"
		}
	}

	return items, nil
}

