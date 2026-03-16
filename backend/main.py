from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database.mongodb import close_mongodb, connect_mongodb
from routers import auth, chat, dashboard, datasets, query, report

# Optional import for AWS Lambda deployment
try:
    from mangum import Mangum
    handler = None  # Will be set at the end
except ImportError:
    print("⚠️  Mangum not available - AWS Lambda deployment not supported")
    Mangum = None

app = FastAPI(title="Narralytics API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
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
