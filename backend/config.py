from pathlib import Path
from typing import Any

from pydantic import ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    REDIRECT_URI: str = "http://localhost:8000/auth/callback"
    OAUTH_STATE_SECRET: str | None = None
    FRONTEND_URL: str = "http://localhost:5173"
    FRONTEND_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "narralytics"

    GEMINI_API_KEY: str = ""  # Legacy single key fallback
    GEMINI_API_KEY_1: str = ""
    GEMINI_API_KEY_2: str = ""
    GEMINI_API_KEY_3: str = ""
    GROQ_API_KEY: str = ""  # Deprecated/ignored (kept for backwards compatibility)

    UPLOAD_DIR: str = "./uploads"
    AWS_REGION: str = "us-east-1"
    AWS_BUCKET: str = ""
    DYNAMODB_TABLE: str = "narralytics_history"

    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    @field_validator(
        "GEMINI_API_KEY",
        "GEMINI_API_KEY_1",
        "GEMINI_API_KEY_2",
        "GEMINI_API_KEY_3",
        "GROQ_API_KEY",
        mode="before",
    )
    @classmethod
    def strip_api_keys(cls, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        return str(value).strip()

    @property
    def gemini_api_keys(self) -> list[str]:
        keys = [
            self.GEMINI_API_KEY_1,
            self.GEMINI_API_KEY_2,
            self.GEMINI_API_KEY_3,
            self.GEMINI_API_KEY,
        ]
        # Keep order and drop empty values + duplicates.
        seen: set[str] = set()
        filtered: list[str] = []
        for key in keys:
            if key and key not in seen:
                seen.add(key)
                filtered.append(key)
        return filtered

    @field_validator("DEBUG", mode="before")
    @classmethod
    def normalize_debug(cls, value: Any) -> bool:
        if isinstance(value, bool):
            return value

        if isinstance(value, (int, float)):
            return bool(value)

        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
                return True
            if normalized in {
                "0",
                "false",
                "no",
                "off",
                "release",
                "production",
                "prod",
                "info",
                "warn",
                "warning",
                "error",
                "critical",
                "fatal",
            }:
                return False
            # Be permissive for environment-level DEBUG values (for example DEBUG=WARN)
            # so app startup does not fail due to a non-boolean setting.
            return False

        raise ValueError("DEBUG must be a boolean-like value")

    @field_validator("OAUTH_STATE_SECRET", mode="before")
    @classmethod
    def require_state_secret(cls, value: Any, info: ValidationInfo) -> str:
        env = str(info.data.get("ENVIRONMENT", "")).lower()
        secret = str(value or "").strip()

        if not secret:
            if env in {"", "development", "dev", "debug"}:
                return "dev-state-secret"
            raise ValueError("OAUTH_STATE_SECRET must be configured")

        if secret == "dev-state-secret" and env not in {"", "development", "dev", "debug"}:
            raise ValueError("OAUTH_STATE_SECRET must be set to a secure value outside development")
        return secret

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")


settings = Settings()
