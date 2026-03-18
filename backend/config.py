from pathlib import Path
from typing import Any

from pydantic import ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    REDIRECT_URI: str = "http://localhost:8000/auth/callback"
    OAUTH_STATE_SECRET: str = "dev-state-secret"
    FRONTEND_URL: str = "http://localhost:5173"
    FRONTEND_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "narralytics"

    GEMINI_API_KEY: str = ""  # Legacy – no longer used; kept for backwards compatibility
    GROQ_API_KEY: str = ""

    UPLOAD_DIR: str = "./uploads"
    AWS_REGION: str = "us-east-1"
    AWS_BUCKET: str = ""
    DYNAMODB_TABLE: str = "narralytics_history"

    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    @field_validator("GROQ_API_KEY", "GEMINI_API_KEY", mode="before")
    @classmethod
    def strip_api_keys(cls, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        return str(value).strip()

    @field_validator("DEBUG", mode="before")
    @classmethod
    def normalize_debug(cls, value: Any) -> bool:
        if isinstance(value, bool):
            return value

        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
                return False

        raise ValueError("DEBUG must be a boolean-like value")

    @field_validator("OAUTH_STATE_SECRET", mode="before")
    @classmethod
    def require_state_secret(cls, value: Any, info: ValidationInfo) -> str:
        secret = str(value or "").strip()
        if not secret:
            raise ValueError("OAUTH_STATE_SECRET must be configured")

        env = str(info.data.get("ENVIRONMENT", "")).lower()
        if secret == "dev-state-secret" and env not in {"", "development", "dev", "debug"}:
            raise ValueError("OAUTH_STATE_SECRET must be set to a secure value outside development")
        return secret

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")


settings = Settings()
