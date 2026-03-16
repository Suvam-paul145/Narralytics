from motor.motor_asyncio import AsyncIOMotorClient

from config import settings

client: AsyncIOMotorClient | None = None
db = None


async def connect_mongodb() -> None:
    global client, db
    if client is not None:
        return
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URI)
        db = client[settings.MONGODB_DB]
        # Test connection
        await client.admin.command('ping')
        print(f"✅ Connected to MongoDB: {settings.MONGODB_DB}")
    except Exception as e:
        print(f"⚠️  MongoDB connection failed: {e}")
        print("⚠️  Running in offline mode - some features may not work")
        client = None
        db = None


async def close_mongodb() -> None:
    global client, db
    if client is not None:
        client.close()
    client = None
    db = None


def get_db():
    if db is None:
        raise RuntimeError("MongoDB connection has not been initialized. Running in offline mode.")
    return db
