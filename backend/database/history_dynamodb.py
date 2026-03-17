"""
DynamoDB-backed conversation history.
Drop-in replacement for MongoDB version.
"""
import os
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

_dynamodb = None
_table = None


def _get_table():
    global _dynamodb, _table
    if _table is not None:
        return _table
    _dynamodb = boto3.resource(
        "dynamodb",
        region_name=os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "us-east-1")),
    )
    _table = _dynamodb.Table(
        os.environ.get("DYNAMODB_TABLE", "narralytics_history")
    )
    return _table


async def save_interaction(
    user_id: str,
    interaction_type: str,
    payload: dict,
    dataset_id: str | None = None,
    session_id: str | None = None,
) -> None:
    try:
        table = _get_table()
        item = {
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": interaction_type,
            "dataset_id": dataset_id or payload.get("dataset_id", ""),
            "session_id": session_id or "",
            "payload": payload,
        }
        # DynamoDB doesn't support None values — remove empty fields
        item = {k: v for k, v in item.items() if v is not None and v != ""}
        table.put_item(Item=item)
    except ClientError as exc:
        print(f"DynamoDB write failed (non-fatal): {exc.response['Error']['Message']}")
    except Exception as exc:
        print(f"History save failed (non-fatal): {exc}")


async def get_history(
    user_id: str,
    dataset_id: str | None = None,
    limit: int = 50,
) -> list[dict]:
    try:
        from boto3.dynamodb.conditions import Key, Attr
        table = _get_table()
        kwargs = {
            "KeyConditionExpression": Key("user_id").eq(user_id),
            "ScanIndexForward": False,  # Most recent first
            "Limit": limit,
        }
        if dataset_id:
            kwargs["FilterExpression"] = Attr("dataset_id").eq(dataset_id)
        response = table.query(**kwargs)
        return response.get("Items", [])
    except Exception as exc:
        print(f"DynamoDB read failed (non-fatal): {exc}")
        return []