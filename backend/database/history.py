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


async def save_interaction(
    user_id: str,
    interaction_type: str,
    payload: dict,
    dataset_id: str | None = None,
    session_id: str | None = None,
) -> None:
    try:
        db = get_db()
        await db.conversation_history.insert_one(
            {
                "user_id": user_id,
                "session_id": session_id,
                "dataset_id": dataset_id or payload.get("dataset_id"),
                "timestamp": datetime.now(timezone.utc),
                "type": interaction_type,
                "payload": payload,
            }
        )
    except Exception as exc:
        print(f"History save failed (non-fatal): {exc}")


async def get_history(user_id: str, dataset_id: str | None = None, limit: int = 50) -> list[dict]:
    try:
        db = get_db()
        query = {"user_id": user_id}
        if dataset_id:
            query["dataset_id"] = dataset_id
        cursor = db.conversation_history.find(query).sort("timestamp", -1).limit(limit)
        documents = await cursor.to_list(length=limit)
        return [_serialize_document(document) for document in documents]
    except Exception as exc:
        print(f"History read failed (non-fatal): {exc}")
        return []
