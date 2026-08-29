package main

import (
	"log"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"

	"github.com/xeni-ai/gateway/internal/agents"
	"github.com/xeni-ai/gateway/internal/cache"
	"github.com/xeni-ai/gateway/internal/config"
	"github.com/xeni-ai/gateway/internal/database"
	"github.com/xeni-ai/gateway/internal/jobs"
	"github.com/xeni-ai/gateway/internal/notifications"
	"github.com/xeni-ai/gateway/internal/rabbitmq"
	"github.com/xeni-ai/gateway/internal/router"
	"github.com/xeni-ai/gateway/internal/storage"
	"github.com/xeni-ai/gateway/internal/websocket"
	jwtPkg "github.com/xeni-ai/gateway/pkg/jwt"
	"github.com/xeni-ai/gateway/pkg/logger"
	"github.com/xeni-ai/gateway/pkg/whatsapp"
)

func main() {
	godotenv.Load(".env")
	godotenv.Load("../.env")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	// Initialize logger
	logger.Init(cfg.App.Env)
	slog.Info("starting XENI Gateway",
		"env", cfg.App.Env,
		"port", cfg.App.Port,
	)

	// Connect to PostgreSQL
	db, err := database.Connect(&cfg.DB, cfg.App.Env)
	if err != nil {
		slog.Error("failed to connect to PostgreSQL", "error", err)
		os.Exit(1)
	}

	// Connect to Redis
	redisClient, err := cache.Connect(&cfg.Redis)
	if err != nil {
		slog.Error("failed to connect to Redis", "error", err)
		os.Exit(1)
	}

	// Connect to RabbitMQ
	rmqClient, err := rabbitmq.Connect(cfg.RabbitMQ.URI)
	if err != nil {
		slog.Warn("RabbitMQ not available — agent task publishing disabled", "error", err)
	}

	// Initialize JWT manager
	jwtManager := jwtPkg.NewManager(
		cfg.JWT.Secret,
		cfg.JWT.AccessExpiry,
		cfg.JWT.RefreshExpiry,
	)

	// Initialize WebSocket hub
	wsHub := websocket.NewHub()

	// Initialize Spaces client
	spacesClient, err := storage.ConnectSpaces(cfg.Spaces)
	if err != nil {
		slog.Warn("failed to connect to DO Spaces — file uploads disabled", "error", err)
	}

	// Initialize WhatsApp & Notification Service
	var waClient *whatsapp.Client
	if cfg.Meta.WhatsAppPhoneNumberID != "" && cfg.Meta.WhatsAppAccessToken != "" {
		waClient = whatsapp.NewClient(cfg.Meta.WhatsAppAccessToken, cfg.Meta.WhatsAppPhoneNumberID, cfg.Meta.APIVersion)
		slog.Info("WhatsApp system initialized", "phone_id", cfg.Meta.WhatsAppPhoneNumberID)
	} else {
		slog.Warn("WhatsApp configuration missing — notifications disabled")
	}
	notifSvc := notifications.NewService(db, waClient)

	// Initialize agent handler
	agentHandler := agents.NewHandler(db, redisClient, rmqClient, wsHub, cfg, notifSvc, spacesClient)

	// Start consuming RabbitMQ results
	if rmqClient != nil {
		defer rmqClient.Close()
		if err := rmqClient.ConsumeResults(agentHandler.HandleResult); err != nil {
			slog.Warn("failed to start result consumer", "error", err)
		}
	}

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName:      "XENI Gateway",
		ErrorHandler: errorHandler,
		BodyLimit:    50 * 1024 * 1024, // 50MB
	})

	// Setup routes
	router.Setup(app, cfg, db, redisClient, jwtManager, wsHub, agentHandler, rmqClient, spacesClient, notifSvc)

	// Initialize and start background jobs
	jobScheduler := jobs.NewScheduler(db, redisClient)
	jobScheduler.Start()
	defer jobScheduler.Stop()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := app.Listen(":" + cfg.App.Port); err != nil {
			slog.Error("server error", "error", err)
		}
	}()

	slog.Info("XENI Gateway is running", "port", cfg.App.Port)

	<-quit
	slog.Info("shutting down gracefully...")
	app.Shutdown()
}

func errorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	msg := "An internal error occurred"
	
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
		msg = e.Message
	}
	
	slog.Error("unhandled error",
		"path", c.Path(),
		"method", c.Method(),
		"error", err.Error(),
		"status", code,
	)

	return c.Status(code).JSON(fiber.Map{
		"success": false,
		"error":   msg,
	})
}
