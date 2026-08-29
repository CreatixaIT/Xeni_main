package content

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/xeni-ai/gateway/internal/cache"
	"github.com/xeni-ai/gateway/internal/models"
	ws "github.com/xeni-ai/gateway/internal/websocket"
)

// Service contains business logic for content and reviews.
type Service struct {
	Repo  *Repository
	Cache *cache.Client
	Hub   *ws.Hub
}

// NewService creates a new content service.
func NewService(repo *Repository, cacheClient *cache.Client, hub *ws.Hub) *Service {
	return &Service{Repo: repo, Cache: cacheClient, Hub: hub}
}

// ── CMS Content ──

// GetSection returns a content section, trying cache first.
func (s *Service) GetSection(key string, cacheKey string) (*models.ContentSection, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Try cache
	if s.Cache != nil {
		data, err := s.Cache.GetJSON(ctx, cacheKey)
		if err == nil && data != nil {
			var section models.ContentSection
			if json.Unmarshal(data, &section) == nil {
				return &section, nil
			}
		}
	}

	// Cache miss — query DB
	section, err := s.Repo.GetSection(key)
	if err != nil {
		// Auto-repair missing sections (hero, banner, faq)
		if key == "hero" || key == "banner" || key == "faq" {
			slog.Info("auto-repairing missing content section", "key", key)
			section = &models.ContentSection{
				SectionKey: key,
				ContentEN:  models.JSON(`{"headline":"","subheadline":"","text":""}`),
				ContentBN:  models.JSON(`{"headline":"","subheadline":"","text":""}`),
			}
			if key == "hero" {
				section.ContentEN = models.JSON(`{"headline":"I'm XENI | Your | Smart Assistant","subheadline":"Scale Your F-commerce Smartly","cta_text":"Start Free"}`)
				section.ContentBN = models.JSON(`{"headline":"আমি জেনি (XENI) | আপনার | স্মার্ট অ্যাসিস্ট্যান্ট","subheadline":"আপনার এফ-কমার্স ব্যবসা স্মার্টলি স্কেল করুন","cta_text":"শুরু করুন"}`)
			}
			if err := s.Repo.DB.Create(section).Error; err == nil {
				return section, nil
			}
		}
		return nil, err
	}

	// Populate cache
	if s.Cache != nil {
		if data, err := json.Marshal(section); err == nil {
			s.Cache.SetJSON(ctx, cacheKey, data, 60*time.Second)
		}
	}

	return section, nil
}

// UpdateSection updates a CMS section and invalidates cache.
func (s *Service) UpdateSection(key string, contentEN, contentBN models.JSON, adminID uuid.UUID, cacheKey string) error {
	if err := s.Repo.UpdateSection(key, contentEN, contentBN, adminID); err != nil {
		return err
	}

	// Invalidate cache synchronously
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if s.Cache != nil {
		s.Cache.Delete(ctx, cacheKey)
	}

	return nil
}

// ── Reviews ──

// SubmitReview creates a new review and handles auto-approve logic.
func (s *Service) SubmitReview(review *models.Review, userPlan string) error {
	// Check auto-approve settings
	settings, err := s.Repo.GetReviewSettings()
	if err != nil {
		slog.Warn("could not fetch review settings for auto-approve check", "error", err)
	}

	isPremium := userPlan == "premium" || userPlan == "enterprise"

	if settings != nil && settings.AutoApprovePremium && isPremium {
		review.Status = models.ReviewApproved
		review.ShowOnLanding = true
	} else {
		review.Status = models.ReviewPending
		review.ShowOnLanding = false
	}

	if err := s.Repo.CreateReview(review); err != nil {
		return err
	}

	// Notify admin room via WebSocket (fire-and-forget)
	if s.Hub != nil {
		s.Hub.PublishToAdmin("review.submitted", map[string]interface{}{
			"review_id":     review.ID.String(),
			"reviewer_name": review.ReviewerName,
			"star_rating":   review.StarRating,
			"timestamp":     time.Now(),
		})
	}

	// If auto-approved, invalidate reviews cache
	if review.Status == models.ReviewApproved {
		s.invalidateReviewsCache()
	}

	return nil
}

// GetApprovedReviews returns approved reviews from cache or DB.
func (s *Service) GetApprovedReviews() ([]models.Review, *models.ReviewSettings, float64, int64, error) {
	settings, err := s.Repo.GetReviewSettings()
	if err != nil {
		return nil, nil, 0, 0, err
	}

	reviews, err := s.Repo.GetApprovedReviews(settings.MaxReviewsOnLanding)
	if err != nil {
		return nil, nil, 0, 0, err
	}

	avgRating, totalCount, _ := s.Repo.GetReviewStats()

	return reviews, settings, avgRating, totalCount, nil
}

// ApproveReview sets a review as approved (idempotent).
func (s *Service) ApproveReview(reviewID uuid.UUID, editText *string, moderatorID uuid.UUID) (*models.Review, error) {
	review, err := s.Repo.GetReviewByID(reviewID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	review.Status = models.ReviewApproved
	review.ShowOnLanding = true
	review.ModeratedBy = &moderatorID
	review.ModeratedAt = &now

	if editText != nil && *editText != "" {
		review.ReviewText = *editText
	}

	if err := s.Repo.UpdateReview(review); err != nil {
		return nil, err
	}

	s.invalidateReviewsCache()
	return review, nil
}

// RejectReview sets a review as rejected.
func (s *Service) RejectReview(reviewID uuid.UUID, adminNote string, moderatorID uuid.UUID) (*models.Review, error) {
	review, err := s.Repo.GetReviewByID(reviewID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	review.Status = models.ReviewRejected
	review.ShowOnLanding = false
	review.ModeratedBy = &moderatorID
	review.ModeratedAt = &now
	review.AdminNote = &adminNote

	if err := s.Repo.UpdateReview(review); err != nil {
		return nil, err
	}

	s.invalidateReviewsCache()
	return review, nil
}

func (s *Service) invalidateReviewsCache() {
	if s.Cache != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		s.Cache.Delete(ctx, cache.KeyContentReviews)
	}
}
