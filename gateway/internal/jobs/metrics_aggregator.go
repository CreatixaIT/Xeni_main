package jobs

import (
	"context"
	"log/slog"
	"time"

	"github.com/xeni-ai/gateway/internal/cache"
	"github.com/xeni-ai/gateway/internal/models"
	"gorm.io/gorm"
)

// MetricAggregator computes daily metrics and updates platform_metrics_cache.
type MetricAggregator struct {
	DB    *gorm.DB
	Cache *cache.Client
}

// NewMetricAggregator creates a new MetricAggregator.
func NewMetricAggregator(db *gorm.DB, cacheClient *cache.Client) *MetricAggregator {
	return &MetricAggregator{DB: db, Cache: cacheClient}
}

// Run executes the aggregation for the given date.
func (j *MetricAggregator) Run(metricDate time.Time) {
	dateStr := metricDate.Format("2006-01-02")
	slog.Info("Running daily metrics aggregator", "date", dateStr)

	stats := &models.PlatformMetricsCache{
		MetricDate: metricDate,
	}

	todayStart := time.Date(metricDate.Year(), metricDate.Month(), metricDate.Day(), 0, 0, 0, 0, metricDate.Location())
	todayEnd := todayStart.Add(24 * time.Hour)
	monthStart := time.Date(metricDate.Year(), metricDate.Month(), 1, 0, 0, 0, 0, metricDate.Location())

	// Total and new users
	j.DB.Model(&models.User{}).Where("deleted_at IS NULL").Count(func() *int64 { var v int64; return &v }())
	var totalUsers int64
	j.DB.Model(&models.User{}).Where("deleted_at IS NULL").Count(&totalUsers)
	stats.TotalUsers = int(totalUsers)

	var newUsers int64
	j.DB.Model(&models.User{}).Where("created_at >= ? AND created_at < ? AND deleted_at IS NULL", todayStart, todayEnd).Count(&newUsers)
	stats.NewUsersToday = int(newUsers)

	// Active subscriptions
	var activeSubs int64
	j.DB.Model(&models.Subscription{}).Where("status = ?", models.SubActive).Count(&activeSubs)
	stats.ActiveSubscriptions = int(activeSubs)

	// Revenue
	j.DB.Model(&models.Payment{}).Where("status = 'success' AND created_at >= ? AND created_at < ?", todayStart, todayEnd).
		Select("COALESCE(SUM(amount), 0)").Scan(&stats.RevenueToday)

	j.DB.Model(&models.Payment{}).Where("status = 'success' AND created_at >= ? AND created_at < ?", monthStart, todayEnd).
		Select("COALESCE(SUM(amount), 0)").Scan(&stats.RevenueMonth)

	// AI tasks
	var aiTasks int64
	j.DB.Model(&models.AgentTask{}).Where("created_at >= ? AND created_at < ?", todayStart, todayEnd).Count(&aiTasks)
	stats.AITasksToday = int(aiTasks)

	var convTasks int64
	j.DB.Model(&models.AgentTask{}).Where("agent_type = 'conversation' AND status = 'completed' AND created_at >= ? AND created_at < ?", todayStart, todayEnd).Count(&convTasks)
	stats.MessagesRepliedToday = int(convTasks)

	var orderTasks int64
	j.DB.Model(&models.AgentTask{}).Where("agent_type = 'order' AND status = 'completed' AND created_at >= ? AND created_at < ?", todayStart, todayEnd).Count(&orderTasks)
	stats.OrdersProcessedToday = int(orderTasks)

	var completed, failed int64
	j.DB.Model(&models.AgentTask{}).Where("status = 'completed' AND created_at >= ? AND created_at < ?", todayStart, todayEnd).Count(&completed)
	j.DB.Model(&models.AgentTask{}).Where("status = 'failed' AND created_at >= ? AND created_at < ?", todayStart, todayEnd).Count(&failed)
	totalT := completed + failed
	if totalT > 0 {
		stats.TaskSuccessRate = float64(completed) / float64(totalT) * 100
	}

	// Upsert into platform_metrics_cache
	err := j.DB.Save(stats).Error // Ensure model handles conflict properly if needed, but Save updates if ID exists. Actually let's use explicit upsert or where constraint
	
	// Explicit upsert
	var existing models.PlatformMetricsCache
	if err := j.DB.Where("metric_date = ?", stats.MetricDate).First(&existing).Error; err == nil {
		stats.ID = existing.ID
		stats.ComputedAt = existing.ComputedAt
	}
	err = j.DB.Save(stats).Error

	if err != nil {
		slog.Error("failed to save metrics cache", "error", err)
	}

	// Invalidate redis cache
	if j.Cache != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		j.Cache.Delete(ctx, cache.KeyAdminOverview)
	}
	slog.Info("completed daily metrics aggregation", "date", dateStr)
}
