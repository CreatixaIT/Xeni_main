package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config holds all application configuration values.
type Config struct {
	App        AppConfig
	DB         DBConfig
	Redis      RedisConfig
	RabbitMQ   RabbitMQConfig
	JWT        JWTConfig
	Google     GoogleOAuthConfig
	Facebook   FacebookOAuthConfig
	Meta       MetaConfig
	SSLCommerz SSLCommerzConfig
	Email      EmailConfig
	FCM        FCMConfig
	RateLimit  RateLimitConfig
	PageToken  PageTokenConfig
	Spaces     SpacesConfig
}

type SpacesConfig struct {
	Key      string
	Secret   string
	Region   string
	Bucket   string
	Endpoint string
	CDNBase  string
}

type AppConfig struct {
	Env         string
	Port        string
	FrontendURL string
}

type DBConfig struct {
	URI string
}

type RedisConfig struct {
	URI string
}

type RabbitMQConfig struct {
	URI string
}

type JWTConfig struct {
	Secret        string
	AccessExpiry  time.Duration
	RefreshExpiry time.Duration
}

type GoogleOAuthConfig struct {
	ClientID     string
	ClientSecret string
}

type FacebookOAuthConfig struct {
	AppID     string
	AppSecret string
}

type MetaConfig struct {
	AppSecret             string
	WebhookVerifyToken    string
	APIVersion            string
	WhatsAppPhoneNumberID string
	WhatsAppBusinessID    string
	WhatsAppAccessToken   string
}

type SSLCommerzConfig struct {
	StoreID       string
	StorePassword string
	IsSandbox     bool
}

type EmailConfig struct {
	ResendAPIKey string
	FromEmail    string
}

type FCMConfig struct {
	ServerKey string
}

type RateLimitConfig struct {
	Requests int
	Window   time.Duration
}

type PageTokenConfig struct {
	EncryptionKey string
}

// Load reads all configuration from environment variables.
func Load() (*Config, error) {
	accessExpiry, err := time.ParseDuration(getEnv("JWT_ACCESS_EXPIRY", "15m"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_ACCESS_EXPIRY: %w", err)
	}

	refreshExpiry, err := time.ParseDuration(getEnv("JWT_REFRESH_EXPIRY", "168h"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_REFRESH_EXPIRY: %w", err)
	}

	rateLimitReqs, _ := strconv.Atoi(getEnv("RATE_LIMIT_REQUESTS", "100"))
	rateLimitWindow, err := time.ParseDuration(getEnv("RATE_LIMIT_WINDOW", "60s"))
	if err != nil {
		rateLimitWindow = 60 * time.Second
	}

	sslSandbox, _ := strconv.ParseBool(getEnv("SSLCOMMERZ_IS_SANDBOX", "true"))

	return &Config{
		App: AppConfig{
			Env:         getEnv("APP_ENV", "development"),
			Port:        getEnv("PORT", "8080"),
			FrontendURL: getEnv("FRONTEND_URL", "http://localhost:3000"),
		},
		DB: DBConfig{
			URI: getEnv("POSTGRES_URI", "postgres://xeni:xeni_secret@localhost:5432/xeni_db?sslmode=disable"),
		},
		Redis: RedisConfig{
			URI: getEnv("REDIS_URI", "redis://:xeni_secret@localhost:6379/0"),
		},
		RabbitMQ: RabbitMQConfig{
			URI: getEnv("RABBITMQ_URI", "amqp://xeni:xeni_secret@localhost:5672/xeni_vhost"),
		},
		JWT: JWTConfig{
			Secret:        getEnv("JWT_SECRET", ""),
			AccessExpiry:  accessExpiry,
			RefreshExpiry: refreshExpiry,
		},
		Google: GoogleOAuthConfig{
			ClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
			ClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		},
		Facebook: FacebookOAuthConfig{
			AppID:     getEnv("FACEBOOK_APP_ID", ""),
			AppSecret: getEnv("FACEBOOK_APP_SECRET", ""),
		},
		Meta: MetaConfig{
			AppSecret:             getEnv("META_APP_SECRET", ""),
			WebhookVerifyToken:    getEnv("FACEBOOK_WEBHOOK_VERIFY_TOKEN", ""),
			APIVersion:            getEnv("META_PAGE_API_VERSION", "v21.0"),
			WhatsAppPhoneNumberID: getEnv("META_WHATSAPP_PHONE_NUMBER_ID", ""),
			WhatsAppBusinessID:    getEnv("META_WHATSAPP_BUSINESS_ACCOUNT_ID", ""),
			WhatsAppAccessToken:   getEnv("META_WHATSAPP_ACCESS_TOKEN", ""),
		},
		SSLCommerz: SSLCommerzConfig{
			StoreID:       getEnv("SSLCOMMERZ_STORE_ID", ""),
			StorePassword: getEnv("SSLCOMMERZ_STORE_PASSWORD", ""),
			IsSandbox:     sslSandbox,
		},
		Email: EmailConfig{
			ResendAPIKey: getEnv("RESEND_API_KEY", ""),
			FromEmail:    getEnv("RESEND_FROM_EMAIL", "noreply@xeni.ai"),
		},
		FCM: FCMConfig{
			ServerKey: getEnv("FCM_SERVER_KEY", ""),
		},
		RateLimit: RateLimitConfig{
			Requests: rateLimitReqs,
			Window:   rateLimitWindow,
		},
		PageToken: PageTokenConfig{
			EncryptionKey: getEnv("PAGE_TOKEN_ENCRYPTION_KEY", ""),
		},
		Spaces: SpacesConfig{
			Key:      getEnv("DO_SPACES_KEY", ""),
			Secret:   getEnv("DO_SPACES_SECRET", ""),
			Region:   getEnv("DO_SPACES_REGION", ""),
			Bucket:   getEnv("DO_SPACES_BUCKET", ""),
			Endpoint: getEnv("DO_SPACES_ENDPOINT", ""),
			CDNBase:  getEnv("DO_SPACES_CDN_BASE", ""),
		},
	}, nil
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
