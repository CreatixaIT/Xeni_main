package jobs

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/xeni-ai/gateway/internal/cache"
	"github.com/xeni-ai/gateway/internal/models"
	"gorm.io/gorm"
)

// BannerExpiryJob disables the announcement banner if it has expired.
type BannerExpiryJob struct {
	DB    *gorm.DB
	Cache *cache.Client
}

// NewBannerExpiryJob creates a new BannerExpiryJob.
func NewBannerExpiryJob(db *gorm.DB, cacheClient *cache.Client) *BannerExpiryJob {
	return &BannerExpiryJob{DB: db, Cache: cacheClient}
}

// Run checks the banner expiration.
func (j *BannerExpiryJob) Run() {
	var section models.ContentSection
	if err := j.DB.Where("section_key = 'banner'").First(&section).Error; err != nil {
		return
	}

	if !section.IsActive {
		return
	}

	// Parse JSON to check expires_at
	var content map[string]interface{}
	if err := json.Unmarshal(section.ContentEN, &content); err != nil {
		return
	}

	expiresAtStr, ok := content["expires_at"].(string)
	if !ok || expiresAtStr == "" {
		return
	}

	expiresAt, err := time.Parse(time.RFC3339, expiresAtStr)
	if err != nil {
		return
	}

	// Disable if expired
	if time.Now().UTC().After(expiresAt) {
		slog.Info("Banner expired, disabling automatically", "key", section.SectionKey)

		content["is_active"] = false
		updatedContent, _ := json.Marshal(content)

		j.DB.Model(&models.ContentSection{}).Where("section_key = 'banner'").Updates(map[string]interface{}{
			"is_active":  false,
			"content_en": models.JSON(updatedContent),
		}) // Syncing BN optionally

		if j.Cache != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			j.Cache.Delete(ctx, cache.KeyContentBanner)
		}
	}
}
