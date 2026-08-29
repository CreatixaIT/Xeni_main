package content

import (
	"github.com/google/uuid"
	"github.com/xeni-ai/gateway/internal/models"
	"gorm.io/gorm"
)

// Repository handles all database operations for content and reviews.
type Repository struct {
	DB *gorm.DB
}

// NewRepository creates a new content repository.
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{DB: db}
}

// ── Content Sections ──

// GetSection retrieves a content section by key.
func (r *Repository) GetSection(key string) (*models.ContentSection, error) {
	var section models.ContentSection
	if err := r.DB.Where("section_key = ?", key).First(&section).Error; err != nil {
		return nil, err
	}
	return &section, nil
}

// UpdateSection updates the content of a section by key.
func (r *Repository) UpdateSection(key string, contentEN, contentBN models.JSON, adminID uuid.UUID) error {
	return r.DB.Model(&models.ContentSection{}).
		Where("section_key = ?", key).
		Updates(map[string]interface{}{
			"content_en": contentEN,
			"content_bn": contentBN,
			"updated_by": adminID,
		}).Error
}

// SeedDefaultSections creates default CMS sections if they don't exist.
func (r *Repository) SeedDefaultSections() {
	defaults := []struct {
		Key       string
		ContentEN string
		ContentBN string
	}{
		{
			Key:       "hero",
			ContentEN: `{"headline":"Your Online Shop AI Employee","subheadline":"Automate conversations, orders, and content 24/7","cta_text":"Start Free","badge_text":"Now with AI Image Generation"}`,
			ContentBN: `{"headline":"আপনার অনলাইন শপের AI কর্মী","subheadline":"কথোপকথন, অর্ডার এবং কন্টেন্ট ২৪/৭ স্বয়ংক্রিয় করুন","cta_text":"বিনামূল্যে শুরু করুন","badge_text":"এখন AI ইমেজ জেনারেশনসহ"}`,
		},
		{
			Key:       "banner",
			ContentEN: `{"text":"","color":"violet","link":"","is_active":false}`,
			ContentBN: `{"text":"","color":"violet","link":"","is_active":false}`,
		},
		{
			Key:       "faq",
			ContentEN: `{"items":[]}`,
			ContentBN: `{"items":[]}`,
		},
		{
			Key:       "pricing_settings",
			ContentEN: `{"show_most_popular":true,"most_popular_plan_id":""}`,
			ContentBN: `{}`,
		},
	}

	for _, d := range defaults {
		var count int64
		r.DB.Model(&models.ContentSection{}).Where("section_key = ?", d.Key).Count(&count)
		if count == 0 {
			r.DB.Create(&models.ContentSection{
				SectionKey: d.Key,
				ContentEN:  models.JSON(d.ContentEN),
				ContentBN:  models.JSON(d.ContentBN),
				IsActive:   true,
			})
		}
	}
}

// ── Reviews ──

// CreateReview inserts a new review.
func (r *Repository) CreateReview(review *models.Review) error {
	return r.DB.Create(review).Error
}

// GetApprovedReviews returns approved reviews for the landing page.
func (r *Repository) GetApprovedReviews(maxCount int) ([]models.Review, error) {
	var reviews []models.Review
	err := r.DB.Where("status = ? AND show_on_landing = ?", models.ReviewApproved, true).
		Order("display_order ASC, created_at DESC").
		Limit(maxCount).
		Find(&reviews).Error
	return reviews, err
}

// GetReviewsByStatus returns reviews filtered by status with pagination.
func (r *Repository) GetReviewsByStatus(status string, page, limit int) ([]models.Review, int64, error) {
	var reviews []models.Review
	var total int64

	query := r.DB.Model(&models.Review{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	query.Count(&total)

	err := query.Order("created_at DESC").
		Offset((page - 1) * limit).
		Limit(limit).
		Find(&reviews).Error
	return reviews, total, err
}

// GetReviewByID retrieves a single review by ID.
func (r *Repository) GetReviewByID(id uuid.UUID) (*models.Review, error) {
	var review models.Review
	if err := r.DB.Where("id = ?", id).First(&review).Error; err != nil {
		return nil, err
	}
	return &review, nil
}

// UpdateReview updates a review record.
func (r *Repository) UpdateReview(review *models.Review) error {
	return r.DB.Save(review).Error
}

// DeleteReview hard-deletes a review.
func (r *Repository) DeleteReview(id uuid.UUID) error {
	return r.DB.Where("id = ?", id).Delete(&models.Review{}).Error
}

// UpdateReviewOrders bulk-updates display_order for reviews.
func (r *Repository) UpdateReviewOrders(orderedIDs []uuid.UUID) error {
	tx := r.DB.Begin()
	for i, id := range orderedIDs {
		if err := tx.Model(&models.Review{}).Where("id = ?", id).Update("display_order", i).Error; err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit().Error
}

// GetReviewStats returns aggregate stats for approved reviews.
func (r *Repository) GetReviewStats() (float64, int64, error) {
	var avgRating float64
	var totalCount int64

	r.DB.Model(&models.Review{}).Where("status = ?", models.ReviewApproved).Count(&totalCount)

	if totalCount > 0 {
		r.DB.Model(&models.Review{}).
			Where("status = ?", models.ReviewApproved).
			Select("COALESCE(AVG(star_rating), 0)").
			Scan(&avgRating)
	}

	return avgRating, totalCount, nil
}

// ── Review Settings ──

// GetReviewSettings returns the global review settings (single row).
func (r *Repository) GetReviewSettings() (*models.ReviewSettings, error) {
	var settings models.ReviewSettings
	err := r.DB.First(&settings).Error
	if err == gorm.ErrRecordNotFound {
		// Seed default
		settings = models.ReviewSettings{
			ID:                  1,
			AutoApprovePremium:  false,
			ShowStarRating:      true,
			MinStarToShow:       4,
			MaxReviewsOnLanding: 6,
		}
		r.DB.Create(&settings)
		return &settings, nil
	}
	return &settings, err
}

// UpdateReviewSettings updates the global review settings.
func (r *Repository) UpdateReviewSettings(settings *models.ReviewSettings) error {
	return r.DB.Save(settings).Error
}
