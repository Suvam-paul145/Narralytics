from motor.motor_asyncio import AsyncIOMotorClient

from config import settings

client: AsyncIOMotorClient | None = None
db = None


async def connect_mongodb() -> None:
    global client, db
    if client is not None:
        return
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB]


async def close_mongodb() -> None:
    global client, db
    if client is not None:
        client.close()
    client = None
    db = None


def get_db():
    if db is None:
        raise RuntimeError("MongoDB connection has not been initialized")
    return db
