"""XENI AI Workers — Configuration."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False
    )
    
    # RabbitMQ
    RABBITMQ_URI: str = "amqp://xeni:xeni_secret@rabbitmq:5672/xeni_vhost"

    # MongoDB
    MONGO_URI: str = "mongodb://xeni:xeni_secret@mongodb:27017/xeni_outputs?authSource=admin"

    # LLM API Keys
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    # Facebook / Meta
    META_GRAPH_API_VERSION: str = "v19.0"
    FACEBOOK_APP_SECRET: str = ""

    # Courier APIs
    PATHAO_API_BASE_URL: str = "https://hermes-api.pathao.com"
    STEADFAST_API_BASE_URL: str = "https://portal.steadfast.com.bd/api/v1"

    # MFS Verification
    BKASH_VERIFICATION_URL: str = ""
    BKASH_APP_KEY: str = ""
    BKASH_APP_SECRET: str = ""
    NAGAD_VERIFICATION_URL: str = ""
    NAGAD_MERCHANT_ID: str = ""
    NAGAD_MERCHANT_KEY: str = ""

    # Google Cloud Vision (OCR for payment screenshots)
    GOOGLE_CLOUD_VISION_KEY: str = ""

    # DigitalOcean Spaces Config
    DO_SPACES_KEY: str = ""
    DO_SPACES_SECRET: str = ""
    DO_SPACES_REGION: str = "sgp1"
    DO_SPACES_BUCKET: str = ""
    DO_SPACES_ENDPOINT: str = ""
    DO_SPACES_CDN_BASE: str = ""

    # Resend Email
    RESEND_API_KEY: str = ""

    # FCM
    FCM_SERVER_KEY: str = ""

    # AWS S3
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = "xeni-outputs"
    AWS_S3_REGION: str = "ap-southeast-1"

    # Worker-specific (overridden per container)
    TASK_QUEUE: str = "conversation_tasks"
    RESULT_QUEUE: str = "task_results"
    DLQ_NAME: str = "conversation_tasks_dlq"
    MAX_RETRIES: int = 3
    PORT: int = 8001
    AGENT_TYPE: str = "conversation"


settings = Settings()
