package jobs

import (
	"log/slog"
	"time"

	"github.com/xeni-ai/gateway/internal/cache"
	"gorm.io/gorm"
)

// Scheduler manages background jobs.
type Scheduler struct {
	DB               *gorm.DB
	Cache            *cache.Client
	MetricAggregator *MetricAggregator
	BannerExpiryJob  *BannerExpiryJob
	stopChan         chan struct{}
}

// NewScheduler creates a new job scheduler.
func NewScheduler(db *gorm.DB, cacheClient *cache.Client) *Scheduler {
	return &Scheduler{
		DB:               db,
		Cache:            cacheClient,
		MetricAggregator: NewMetricAggregator(db, cacheClient),
		BannerExpiryJob:  NewBannerExpiryJob(db, cacheClient),
		stopChan:         make(chan struct{}),
	}
}

// Start begins all scheduled jobs in background goroutines.
func (s *Scheduler) Start() {
	slog.Info("Starting background job scheduler")

	// 1. Metric Aggregator - run daily at midnight BST (18:00 UTC)
	go func() {
		for {
			now := time.Now().UTC()
			// Calculate time until next 18:00 UTC
			nextRun := time.Date(now.Year(), now.Month(), now.Day(), 18, 0, 0, 0, time.UTC)
			if now.After(nextRun) {
				nextRun = nextRun.Add(24 * time.Hour)
			}

			waitDur := nextRun.Sub(now)
			slog.Info("Daily metrics aggregator next run scheduled", "wait_duration", waitDur)

			select {
			case <-time.After(waitDur):
				s.MetricAggregator.Run(time.Now().UTC().Truncate(24 * time.Hour))
			case <-s.stopChan:
				return
			}
		}
	}()

	// 2. Banner Expiry - run every hour
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s.BannerExpiryJob.Run()
			case <-s.stopChan:
				return
			}
		}
	}()
}

// Stop shuts down the scheduler.
func (s *Scheduler) Stop() {
	slog.Info("Stopping background job scheduler")
	close(s.stopChan)
}
