from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/ragdocs"

    # Auth
    nextauth_secret: str = ""

    # AWS (Bedrock + S3 — shared credentials)
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    storage_bucket: str = ""

    # Bedrock model IDs (inference profiles)
    embedding_model: str = "amazon.titan-embed-text-v2:0"
    chat_model: str = "us.anthropic.claude-sonnet-4-6-20250514-v1:0"
    classify_model: str = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    embedding_dimensions: int = 1024

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Sentry
    sentry_dsn: str = ""

    # App
    log_level: str = "info"
    backend_url: str = "http://localhost:8000"
    max_file_size_mb: int = 50
    chunk_size_prose: int = 512
    chunk_size_table: int = 256
    chunk_overlap: int = 64
    retrieval_top_k: int = 20
    rerank_top_k: int = 5


@lru_cache
def get_settings() -> Settings:
    return Settings()
