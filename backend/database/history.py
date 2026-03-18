from datetime import datetime, timezone
from typing import Any

from database.mongodb import get_db


def _serialize_document(document: dict | None) -> dict | None:
    if not document:
        return None

    serialized: dict[str, Any] = {}
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


def _normalize_message(message: dict[str, Any] | None, role: str, timestamp: datetime) -> dict[str, Any]:
    payload = dict(message or {})
    payload["role"] = role
    payload.setdefault("timestamp", timestamp)
    if not payload.get("id"):
        payload["id"] = f"{role}-{int(timestamp.timestamp() * 1000)}"
    return payload


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


async def upsert_chat_session(
    user_id: str,
    session_id: str,
    title: str | None = None,
    dataset_id: str | None = None,
    dataset_name: str | None = None,
) -> None:
    try:
        db = get_db()
        now = datetime.now(timezone.utc)
        session_title = (title or "New Chat").strip() or "New Chat"

        update_payload: dict[str, Any] = {"updated_at": now, "title": session_title}
        if dataset_id is not None:
            update_payload["dataset_id"] = dataset_id
        if dataset_name is not None:
            update_payload["dataset_name"] = dataset_name

        await db.chat_sessions.update_one(
            {"user_id": user_id, "session_id": session_id},
            {
                "$set": update_payload,
                "$setOnInsert": {
                    "user_id": user_id,
                    "session_id": session_id,
                    "created_at": now,
                    "messages": [],
                    "message_count": 0,
                    "preview": "",
                },
            },
            upsert=True,
        )
    except Exception as exc:
        print(f"Session upsert failed (non-fatal): {exc}")


async def save_chat_exchange(
    user_id: str,
    session_id: str,
    user_message: dict[str, Any],
    ai_message: dict[str, Any],
    dataset_id: str | None = None,
    dataset_name: str | None = None,
) -> None:
    try:
        db = get_db()
        now = datetime.now(timezone.utc)
        normalized_user = _normalize_message(user_message, "user", now)
        normalized_ai = _normalize_message(ai_message, "assistant", now)

        first_prompt = str(normalized_user.get("content") or "").strip()
        title = (first_prompt[:80] if first_prompt else "New Chat").strip() or "New Chat"
        preview = str(normalized_ai.get("content") or first_prompt or "").strip()[:240]

        update_payload: dict[str, Any] = {
            "updated_at": now,
            "preview": preview,
            "title": title,
        }
        if dataset_id is not None:
            update_payload["dataset_id"] = dataset_id
        if dataset_name is not None:
            update_payload["dataset_name"] = dataset_name

        await db.chat_sessions.update_one(
            {"user_id": user_id, "session_id": session_id},
            {
                "$set": update_payload,
                "$setOnInsert": {
                    "user_id": user_id,
                    "session_id": session_id,
                    "created_at": now,
                },
                "$push": {"messages": {"$each": [normalized_user, normalized_ai]}},
                "$inc": {"message_count": 2},
            },
            upsert=True,
        )
    except Exception as exc:
        print(f"Session message save failed (non-fatal): {exc}")


async def list_chat_sessions(user_id: str, limit: int = 50) -> list[dict]:
    try:
        db = get_db()
        bounded_limit = max(1, min(limit, 500))

        # New chat session store (rich message snapshots).
        cursor = db.chat_sessions.find({"user_id": user_id}).sort("updated_at", -1).limit(
            bounded_limit
        )
        chat_session_docs = await cursor.to_list(length=bounded_limit)

        # Legacy store from conversation_history (prompt/summary events).
        legacy_pipeline = [
            {
                "$match": {
                    "user_id": user_id,
                    "session_id": {"$exists": True, "$ne": None},
                }
            },
            {"$sort": {"timestamp": -1}},
            {
                "$group": {
                    "_id": "$session_id",
                    "updated_at": {"$first": "$timestamp"},
                    "dataset_id": {"$first": "$dataset_id"},
                    "title": {"$first": "$payload.prompt"},
                    "preview": {"$first": "$payload.response_summary"},
                    "message_count": {"$sum": 1},
                }
            },
            {"$limit": bounded_limit * 3},
        ]
        legacy_docs = await db.conversation_history.aggregate(legacy_pipeline).to_list(
            length=bounded_limit * 3
        )

        merged_by_session: dict[str, dict[str, Any]] = {}

        for doc in chat_session_docs:
            session_id = str(doc.get("session_id") or "")
            if not session_id:
                continue
            merged_by_session[session_id] = {
                "user_id": user_id,
                "session_id": session_id,
                "title": doc.get("title") or "New Chat",
                "preview": doc.get("preview") or "",
                "dataset_id": doc.get("dataset_id"),
                "dataset_name": doc.get("dataset_name"),
                "message_count": int(doc.get("message_count") or 0),
                "updated_at": doc.get("updated_at") or doc.get("created_at"),
                "created_at": doc.get("created_at") or doc.get("updated_at"),
                "source": "chat_sessions",
            }

        for doc in legacy_docs:
            session_id = str(doc.get("_id") or "")
            if not session_id:
                continue

            existing = merged_by_session.get(session_id)
            if existing:
                # Fill missing metadata from legacy history if needed.
                if not existing.get("title") and doc.get("title"):
                    existing["title"] = doc.get("title")
                if not existing.get("preview") and doc.get("preview"):
                    existing["preview"] = doc.get("preview")
                if not existing.get("dataset_id") and doc.get("dataset_id"):
                    existing["dataset_id"] = doc.get("dataset_id")
                if not existing.get("updated_at") and doc.get("updated_at"):
                    existing["updated_at"] = doc.get("updated_at")
                if not existing.get("message_count"):
                    existing["message_count"] = int(doc.get("message_count") or 0)
                continue

            title = str(doc.get("title") or "").strip() or "Legacy Chat"
            preview = str(doc.get("preview") or "").strip()
            merged_by_session[session_id] = {
                "user_id": user_id,
                "session_id": session_id,
                "title": title[:80],
                "preview": preview[:240],
                "dataset_id": doc.get("dataset_id"),
                "dataset_name": None,
                "message_count": int(doc.get("message_count") or 0),
                "updated_at": doc.get("updated_at"),
                "created_at": doc.get("updated_at"),
                "source": "conversation_history",
            }

        merged_sessions = list(merged_by_session.values())
        merged_sessions.sort(
            key=lambda item: item.get("updated_at") or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )

        return [_serialize_document(document) for document in merged_sessions[:bounded_limit]]
    except Exception as exc:
        print(f"Session list failed (non-fatal): {exc}")
        return []


async def get_chat_session(user_id: str, session_id: str) -> dict | None:
    try:
        db = get_db()
        document = await db.chat_sessions.find_one({"user_id": user_id, "session_id": session_id})
        if document and document.get("messages"):
            return _serialize_document(document)

        # Fallback for legacy sessions stored only in conversation_history.
        legacy_cursor = (
            db.conversation_history.find({"user_id": user_id, "session_id": session_id})
            .sort("timestamp", 1)
        )
        legacy_rows = await legacy_cursor.to_list(length=5000)
        if not legacy_rows:
            return _serialize_document(document)

        messages: list[dict[str, Any]] = []
        dataset_id: str | None = None
        created_at: datetime | None = None
        updated_at: datetime | None = None
        last_user_dedupe_key: str | None = None

        for idx, row in enumerate(legacy_rows):
            timestamp = row.get("timestamp") or datetime.now(timezone.utc)
            payload = row.get("payload") or {}
            interaction_type = str(row.get("type") or "").lower()

            if not dataset_id and row.get("dataset_id"):
                dataset_id = row.get("dataset_id")
            if created_at is None:
                created_at = timestamp
            updated_at = timestamp

            prompt = str(payload.get("prompt") or "").strip()
            response_summary = str(payload.get("response_summary") or "").strip()
            cannot_answer = response_summary == "cannot_answer" or bool(payload.get("reason"))

            if prompt:
                dedupe_bucket = int(timestamp.timestamp() // 10)
                user_dedupe_key = f"{prompt.lower()}::{dedupe_bucket}"
                if user_dedupe_key != last_user_dedupe_key:
                    messages.append(
                        {
                            "id": f"legacy-user-{idx}",
                            "role": "user",
                            "content": prompt,
                            "timestamp": timestamp,
                            "meta": {"source": "conversation_history", "type": interaction_type},
                        }
                    )
                    last_user_dedupe_key = user_dedupe_key

            # Generate assistant side from stored legacy summary data.
            assistant_content = ""
            if cannot_answer:
                assistant_content = "Data is insufficient for this request."
            elif response_summary:
                assistant_content = response_summary

            if assistant_content:
                messages.append(
                    {
                        "id": f"legacy-ai-{idx}",
                        "role": "assistant",
                        "content": assistant_content,
                        "timestamp": timestamp,
                        "meta": {"source": "conversation_history", "type": interaction_type},
                    }
                )

        if not messages and document:
            return _serialize_document(document)
        if not messages:
            return None

        title_seed = next(
            (str(message.get("content") or "").strip() for message in messages if message.get("role") == "user"),
            "Legacy Chat",
        )
        title = title_seed[:80] or "Legacy Chat"
        preview_seed = next(
            (
                str(message.get("content") or "").strip()
                for message in reversed(messages)
                if message.get("role") == "assistant"
            ),
            title_seed,
        )

        synthesized = {
            "user_id": user_id,
            "session_id": session_id,
            "dataset_id": dataset_id,
            "dataset_name": None,
            "title": title,
            "preview": preview_seed[:240],
            "messages": messages,
            "message_count": len(messages),
            "created_at": created_at or datetime.now(timezone.utc),
            "updated_at": updated_at or datetime.now(timezone.utc),
            "source": "conversation_history",
        }
        return _serialize_document(synthesized)
    except Exception as exc:
        print(f"Session fetch failed (non-fatal): {exc}")
        return None
