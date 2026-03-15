from datetime import datetime, timezone

from pymongo import ReturnDocument

from database.mongodb import get_db


def _google_sub(google_profile: dict) -> str:
    return google_profile.get("sub") or google_profile.get("id")


async def upsert_user(google_profile: dict) -> dict:
    db = get_db()
    google_sub = _google_sub(google_profile)
    if not google_sub:
        raise ValueError("Google profile does not contain a subject identifier")

    user_data = {
        "google_sub": google_sub,
        "email": google_profile["email"],
        "name": google_profile.get("name", ""),
        "picture": google_profile.get("picture", ""),
        "last_login": datetime.now(timezone.utc),
    }

    result = await db.users.find_one_and_update(
        {"google_sub": google_sub},
        {
            "$set": user_data,
            "$setOnInsert": {
                "created_at": datetime.now(timezone.utc),
                "plan": "free",
                "datasets": [],
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return result


async def get_user_by_sub(google_sub: str) -> dict | None:
    db = get_db()
    return await db.users.find_one({"google_sub": google_sub})


async def add_dataset_to_user(google_sub: str, dataset_meta: dict) -> None:
    db = get_db()
    meta = {
        **dataset_meta,
        "uploaded_at": dataset_meta.get("uploaded_at", datetime.now(timezone.utc)),
    }
    await db.users.update_one({"google_sub": google_sub}, {"$push": {"datasets": meta}})


async def remove_dataset_from_user(google_sub: str, dataset_id: str) -> None:
    db = get_db()
    await db.users.update_one(
        {"google_sub": google_sub},
        {"$pull": {"datasets": {"dataset_id": dataset_id}}},
    )
