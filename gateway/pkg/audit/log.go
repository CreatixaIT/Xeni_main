package audit

import (
	"encoding/json"
	"log/slog"

	"github.com/google/uuid"
	"github.com/xeni-ai/gateway/internal/models"
	"gorm.io/gorm"
)

// AuditAction represents categorized admin audit actions.
type AuditAction string

const (
	// Existing
	AuditLogin  AuditAction = "auth.login"
	AuditLogout AuditAction = "auth.logout"

	// Admin user actions
	AuditUserRoleChange   AuditAction = "admin.user.role_change"
	AuditUserPlanOverride AuditAction = "admin.user.plan_override"
	AuditUserSuspend      AuditAction = "admin.user.suspend"
	AuditUserActivate     AuditAction = "admin.user.activate"
	AuditUserDelete       AuditAction = "admin.user.delete"

	// Admin plan actions
	AuditPlanUpdate AuditAction = "admin.plan.update"

	// Admin content actions
	AuditContentUpdate AuditAction = "admin.content.update"

	// Admin review actions
	AuditReviewApprove AuditAction = "admin.review.approve"
	AuditReviewReject  AuditAction = "admin.review.reject"
	AuditReviewUpdate  AuditAction = "admin.review.update"
	AuditReviewDelete  AuditAction = "admin.review.delete"
)

// LogAudit creates an audit log entry for admin actions.
func LogAudit(db *gorm.DB, adminID uuid.UUID, action AuditAction, resourceID string, metadata map[string]interface{}, ip string, userAgent string) {
	metaJSON, err := json.Marshal(metadata)
	if err != nil {
		slog.Error("failed to marshal audit metadata", "error", err)
		metaJSON = []byte("{}")
	}

	ipPtr := &ip
	uaPtr := &userAgent
	resPtr := &resourceID

	entry := models.AuditLog{
		UserID:    &adminID,
		Action:    string(action),
		Resource:  resPtr,
		Metadata:  models.JSON(metaJSON),
		IPAddress: ipPtr,
		UserAgent: uaPtr,
	}

	if err := db.Create(&entry).Error; err != nil {
		slog.Error("failed to write audit log", "action", action, "admin_id", adminID, "error", err)
	}
}
