from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/ragdocs"

    # OpenAI
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    chat_model: str = "gpt-4o"

    # Auth
    nextauth_secret: str = ""

    # AWS S3
    storage_bucket: str = ""
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"

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
