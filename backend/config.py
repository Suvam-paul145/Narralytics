from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    REDIRECT_URI: str = "http://localhost:8000/auth/callback"
    FRONTEND_URL: str = "http://localhost:5173"

    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "narralytics"

    GEMINI_API_KEY: str = ""

    UPLOAD_DIR: str = "./uploads"
    AWS_REGION: str = "us-east-1"
    AWS_BUCKET: str = ""
    DYNAMODB_TABLE: str = "narralytics_history"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
