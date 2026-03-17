from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from datetime import UTC, datetime
from typing import Any, Dict

from config import settings
from database.mongodb import close_mongodb, connect_mongodb, client
from routers import auth, chat, dashboard, datasets, query, report

# Optional import for AWS Lambda deployment
try:
    from mangum import Mangum
    handler = None  # Will be set at the end
except ImportError:
    print("⚠️  Mangum not available - AWS Lambda deployment not supported")
    Mangum = None

app = FastAPI(title="Narralytics API", version="2.0.0")

import os

# Build allowed origins from both FRONTEND_URL and FRONTEND_ORIGINS
_origins = [settings.FRONTEND_URL]
if settings.FRONTEND_ORIGINS:
    _origins.extend([o.strip() for o in settings.FRONTEND_ORIGINS.split(",") if o.strip()])
_origins = list(set(_origins))  # deduplicate

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    await connect_mongodb()


@app.on_event("shutdown")
async def shutdown() -> None:
    await close_mongodb()


@app.get("/health", tags=["system"])
async def health() -> dict:
    return {"status": "ok"}


@app.get("/api/health", tags=["system"])
async def api_health() -> dict:
    """
    Comprehensive health check endpoint that verifies:
    - Server is running
    - MongoDB connection is active
    - System timestamp
    - Gemini API quota status
    """
    from llm.quota_manager import quota_manager
    
    health_status: Dict[str, Any] = {
        "status": "healthy",
        "timestamp": datetime.now(UTC).isoformat(),
        "services": {
            "api": "healthy",
            "database": "unknown",
            "gemini_quota": "unknown"
        }
    }
    
    # Check MongoDB connection
    try:
        if client is not None:
            # Ping MongoDB with a timeout
            await asyncio.wait_for(client.admin.command('ping'), timeout=5.0)
            health_status["services"]["database"] = "healthy"
        else:
            health_status["services"]["database"] = "disconnected"
            health_status["status"] = "degraded"
    except asyncio.TimeoutError:
        health_status["services"]["database"] = "timeout"
        health_status["status"] = "degraded"
    except Exception as e:
        health_status["services"]["database"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check Gemini API quota status
    try:
        quota_available = quota_manager.is_quota_available()
        if quota_available:
            health_status["services"]["gemini_quota"] = "available"
            health_status["gemini_requests_used"] = quota_manager.daily_requests
        else:
            health_status["services"]["gemini_quota"] = "exhausted"
            health_status["gemini_requests_used"] = quota_manager.daily_requests
            health_status["quota_reset_time"] = quota_manager.quota_exhausted_until.isoformat() if quota_manager.quota_exhausted_until else None
            if health_status["status"] == "healthy":
                health_status["status"] = "limited"  # Still functional but with limitations
    except Exception as e:
        health_status["services"]["gemini_quota"] = f"error: {str(e)}"
    
    return health_status


app.include_router(auth.router)
app.include_router(datasets.router)
app.include_router(dashboard.router)
app.include_router(query.router)
app.include_router(chat.router)
app.include_router(report.router)

# AWS Lambda handler (optional)
if Mangum is not None:
    handler = Mangum(app)
else:
    handler = None
