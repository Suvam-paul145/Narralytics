from datetime import datetime, timezone

from database.mongodb import get_db


def _serialize_document(document: dict | None) -> dict | None:
    if not document:
        return None

    serialized = {}
    for key, value in document.items():
        if key == "_id":
            continue
        if isinstance(value, datetime):
            serialized[key] = value.isoformat()
        elif isinstance(value, list):
            serialized[key] = [
                _serialize_document(item) if isinstance(item, dict) else item for item in value
            ]
        elif isinstance(value, dict):
            serialized[key] = _serialize_document(value)
        else:
            serialized[key] = value
    return serialized


async def save_dataset_metadata(meta: dict) -> dict:
    db = get_db()
    document = {
        **meta,
        "uploaded_at": meta.get("uploaded_at", datetime.now(timezone.utc)),
        "last_queried": meta.get("last_queried"),
    }
    await db.datasets.update_one(
        {"dataset_id": document["dataset_id"]},
        {"$set": document},
        upsert=True,
    )
    stored = await db.datasets.find_one({"dataset_id": document["dataset_id"]})
    return _serialize_document(stored) or {}


async def get_dataset(dataset_id: str, user_id: str) -> dict | None:
    db = get_db()
    document = await db.datasets.find_one({"dataset_id": dataset_id, "user_id": user_id})
    return _serialize_document(document)


async def get_user_datasets(user_id: str) -> list[dict]:
    db = get_db()
    cursor = db.datasets.find({"user_id": user_id}).sort("uploaded_at", -1)
    documents = await cursor.to_list(length=200)
    return [_serialize_document(document) for document in documents]


async def delete_dataset_meta(dataset_id: str, user_id: str) -> None:
    db = get_db()
    await db.datasets.delete_one({"dataset_id": dataset_id, "user_id": user_id})


async def touch_dataset(dataset_id: str) -> None:
    db = get_db()
    await db.datasets.update_one(
        {"dataset_id": dataset_id},
        {"$set": {"last_queried": datetime.now(timezone.utc)}},
    )
