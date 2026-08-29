package rabbitmq

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

// TaskMessage is the message envelope sent from Go to Python workers via RabbitMQ.
type TaskMessage struct {
	TaskID     string                 `json:"task_id"`
	UserID     string                 `json:"user_id"`
	AgentType  string                 `json:"agent_type"`
	Priority   int                    `json:"priority"`
	RetryCount int                    `json:"retry_count"`
	CreatedAt  string                 `json:"created_at"`
	Payload    map[string]interface{} `json:"payload"`
}

// ResultMessage is the message envelope received from Python workers.
type ResultMessage struct {
	TaskID      string                 `json:"task_id"`
	UserID      string                 `json:"user_id"`
	AgentType   string                 `json:"agent_type"`
	Status      string                 `json:"status"`
	MongoDocID  string                 `json:"mongo_doc_id"`
	Summary     string                 `json:"summary"`
	Error       *string                `json:"error"`
	DurationMs  int                    `json:"duration_ms"`
	CompletedAt string                 `json:"completed_at"`
	Data        map[string]interface{} `json:"data,omitempty"`
}

// Client manages the RabbitMQ connection.
type Client struct {
	conn    *amqp.Connection
	channel *amqp.Channel
}

// Connect establishes a connection to RabbitMQ.
func Connect(uri string) (*Client, error) {
	conn, err := amqp.Dial(uri)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to open RabbitMQ channel: %w", err)
	}

	// Declare exchange to ensure it exists before publishing
	err = ch.ExchangeDeclare(
		"xeni.tasks", // name
		"direct",      // type — must match definitions.json (direct, not topic)
		true,          // durable
		false,         // auto-deleted
		false,         // internal
		false,         // no-wait
		nil,           // arguments
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return nil, fmt.Errorf("failed to declare RabbitMQ exchange: %w", err)
	}

	// Set QoS for fair dispatch
	if err := ch.Qos(1, 0, false); err != nil {
		return nil, fmt.Errorf("failed to set QoS: %w", err)
	}

	slog.Info("connected to RabbitMQ and declared exchanges")
	return &Client{conn: conn, channel: ch}, nil
}

// PublishTask publishes a task message to the tasks exchange with the agent's routing key.
func (c *Client) PublishTask(ctx context.Context, msg *TaskMessage) error {
	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal task message: %w", err)
	}

	publishCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	return c.channel.PublishWithContext(
		publishCtx,
		"xeni.tasks",  // exchange
		msg.AgentType, // routing key (matches binding)
		false,         // mandatory
		false,         // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         body,
			Timestamp:    time.Now(),
			MessageId:    msg.TaskID,
		},
	)
}

// ConsumeResults starts consuming from the task_results queue and calls the handler for each message.
func (c *Client) ConsumeResults(handler func(ResultMessage) error) error {
	msgs, err := c.channel.Consume(
		"task_results", // queue
		"go-gateway",   // consumer tag
		false,          // auto-ack (manual ack for reliability)
		false,          // exclusive
		false,          // no-local
		false,          // no-wait
		nil,            // args
	)
	if err != nil {
		return fmt.Errorf("failed to register consumer: %w", err)
	}

	go func() {
		for msg := range msgs {
			var result ResultMessage
			if err := json.Unmarshal(msg.Body, &result); err != nil {
				slog.Error("failed to unmarshal result message", "error", err)
				msg.Nack(false, false) // don't requeue malformed messages
				continue
			}

			if err := handler(result); err != nil {
				slog.Error("failed to handle result message",
					"task_id", result.TaskID,
					"error", err,
				)
				msg.Nack(false, true) // requeue on handler error
				continue
			}

			msg.Ack(false)
		}
	}()

	slog.Info("started consuming from task_results queue")
	return nil
}

// Close closes the RabbitMQ connection and channel.
func (c *Client) Close() {
	if c.channel != nil {
		c.channel.Close()
	}
	if c.conn != nil {
		c.conn.Close()
	}
}
