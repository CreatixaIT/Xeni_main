package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AgentType represents the type of AI agent.
type AgentType string

const (
	AgentConversation AgentType = "conversation"
	AgentOrder        AgentType = "order"
	AgentInventory    AgentType = "inventory"
	AgentCreative     AgentType = "creative"
	AgentIntelligence AgentType = "intelligence"
)

// AllAgents returns all valid agent types.
func AllAgents() []AgentType {
	return []AgentType{
		AgentConversation, AgentOrder, AgentInventory,
		AgentCreative, AgentIntelligence,
	}
}

// AgentSlugToType maps URL slugs to agent types.
var AgentSlugToType = map[string]AgentType{
	"conversation": AgentConversation,
	"order":        AgentOrder,
	"inventory":    AgentInventory,
	"creative":     AgentCreative,
	"intelligence": AgentIntelligence,
}

// AgentTypeToQueue maps agent types to RabbitMQ routing keys.
var AgentTypeToQueue = map[AgentType]string{
	AgentConversation: "conversation",
	AgentOrder:        "order",
	AgentInventory:    "inventory",
	AgentCreative:     "creative",
	AgentIntelligence: "intelligence",
}

// TaskStatus represents the status of an agent task.
type TaskStatus string

const (
	TaskQueued     TaskStatus = "queued"
	TaskProcessing TaskStatus = "processing"
	TaskCompleted  TaskStatus = "completed"
	TaskFailed     TaskStatus = "failed"
)

// AgentTask represents the agent_tasks table.
type AgentTask struct {
	ID           uuid.UUID  `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	UserID       uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	ShopID       *uuid.UUID `gorm:"type:uuid;index" json:"shop_id"`
	AgentType    AgentType  `gorm:"type:agent_type;not null;index" json:"agent_type"`
	TaskID       uuid.UUID  `gorm:"type:uuid;uniqueIndex;not null" json:"task_id"`
	Status       TaskStatus `gorm:"type:task_status;default:'queued';not null;index" json:"status"`
	MongoDocID   *string    `gorm:"size:255" json:"mongo_doc_id"`
	Summary      *string    `gorm:"type:text" json:"summary"`
	Result       JSON       `gorm:"type:jsonb;default:'{}'" json:"result"`
	ErrorMessage *string    `gorm:"type:text" json:"error_message"`
	DurationMs   *int       `json:"duration_ms"`
	CreatedAt    time.Time  `gorm:"autoCreateTime;index" json:"created_at"`
	CompletedAt  *time.Time `json:"completed_at"`

	User User  `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Shop *Shop `gorm:"foreignKey:ShopID;constraint:OnDelete:SET NULL" json:"-"`
}

func (a *AgentTask) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	if a.TaskID == uuid.Nil {
		a.TaskID = uuid.New()
	}
	return nil
}

// AuditLog represents the audit_logs table.
type AuditLog struct {
	ID        uuid.UUID  `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	UserID    *uuid.UUID `gorm:"type:uuid;index" json:"user_id"`
	Action    string     `gorm:"size:255;not null;index" json:"action"`
	Resource  *string    `gorm:"size:255" json:"resource"`
	Metadata  JSON       `gorm:"type:jsonb;default:'{}'" json:"metadata"`
	IPAddress *string    `gorm:"size:45" json:"ip_address"`
	UserAgent *string    `gorm:"type:text" json:"user_agent"`
	CreatedAt time.Time  `gorm:"autoCreateTime;index" json:"created_at"`

	User *User `gorm:"foreignKey:UserID;constraint:OnDelete:SET NULL" json:"-"`
}

func (a *AuditLog) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
