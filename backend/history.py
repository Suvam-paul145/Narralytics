import boto3, os
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

dynamodb = boto3.resource(
    "dynamodb",
    region_name=os.getenv("AWS_REGION", "us-east-1")
)
table = dynamodb.Table(os.getenv("DYNAMODB_TABLE", "Narralytics_history"))

def save_interaction(user_id: str, interaction_type: str, payload: dict):
    """
    interaction_type: "chart_query" | "chat_message"
    payload: { prompt, response_summary, chart_type (if chart), etc. }
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    try:
        table.put_item(Item={
            "user_id":   user_id,
            "timestamp": timestamp,
            "type":      interaction_type,
            "payload":   payload
        })
    except Exception as e:
        print(f"DynamoDB write failed (non-fatal): {e}")
        # Non-fatal — never let history failure break the main flow

def get_history(user_id: str, limit: int = 50) -> list:
    """Fetch last N interactions for this user."""
    try:
        response = table.query(
            KeyConditionExpression="user_id = :uid",
            ExpressionAttributeValues={":uid": user_id},
            ScanIndexForward=False,  # Most recent first
            Limit=limit
        )
        return response.get("Items", [])
    except Exception as e:
        print(f"DynamoDB read failed (non-fatal): {e}")
        return []