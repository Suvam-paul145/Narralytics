"""
Example: Durable Data Processing Workflow
This demonstrates a multi-step data analysis process that can run for extended periods
and automatically recover from interruptions.
"""

# Note: Install with: pip install aws-durable-execution-sdk-python
from aws_durable_execution_sdk_python import durable_execution, DurableContext
from aws_durable_execution_sdk_python.duration import Duration
import json
import logging
from typing import Dict, Any

# Configure logging
logger = logging.getLogger(__name__)

@durable_execution
def data_processing_handler(event: Dict[str, Any], context: DurableContext) -> Dict[str, Any]:
    """
    A durable function that processes data through multiple stages:
    1. Validate and prepare data
    2. Run analysis (could take hours)
    3. Generate insights
    4. Send notifications
    """
    
    # Log the start (replay-aware logging)
    context.logger.info(f"Starting data processing workflow for dataset: {event.get('dataset_id')}")
    
    # Step 1: Validate and prepare data
    validation_result = context.step(
        lambda _: validate_and_prepare_data(event),
        name="validate_data"
    )
    
    if not validation_result["valid"]:
        context.logger.error("Data validation failed")
        return {"status": "failed", "reason": "invalid_data"}
    
    # Step 2: Run intensive analysis (this could take hours)
    analysis_result = context.step(
        lambda _: run_data_analysis(validation_result["prepared_data"]),
        name="run_analysis"
    )
    
    # Step 3: Wait for external system if needed (e.g., human review)
    if analysis_result.get("requires_review"):
        context.logger.info("Analysis requires human review, waiting for callback...")
        
        # Wait for external callback (up to 24 hours)
        review_result = context.wait(
            duration=Duration.from_hours(24),
            name="await_human_review"
        )
        
        if not review_result:
            context.logger.warning("Human review timeout, proceeding with automated decision")
            review_result = {"approved": True, "notes": "Auto-approved after timeout"}
    else:
        review_result = {"approved": True, "notes": "No review required"}
    
    # Step 4: Generate insights based on analysis and review
    insights = context.step(
        lambda _: generate_insights(analysis_result, review_result),
        name="generate_insights"
    )
    
    # Step 5: Send notifications
    notification_result = context.step(
        lambda _: send_notifications(insights, event.get("notify_users", [])),
        name="send_notifications"
    )
    
    # Return final result
    result = {
        "status": "completed",
        "dataset_id": event.get("dataset_id"),
        "analysis_summary": insights["summary"],
        "processing_time": insights["processing_time"],
        "notifications_sent": notification_result["count"]
    }
    
    context.logger.info(f"Workflow completed successfully: {result}")
    return result


def validate_and_prepare_data(event: Dict[str, Any]) -> Dict[str, Any]:
    """Step function: Validate input data and prepare for analysis"""
    dataset_id = event.get("dataset_id")
    
    if not dataset_id:
        return {"valid": False, "error": "Missing dataset_id"}
    
    # Simulate data validation and preparation
    # In real implementation, this would:
    # - Check data format and integrity
    # - Load data from S3/database
    # - Clean and normalize data
    
    prepared_data = {
        "dataset_id": dataset_id,
        "row_count": event.get("row_count", 1000),
        "columns": event.get("columns", ["sales", "region", "date"]),
        "data_source": event.get("data_source", "s3://my-bucket/data.csv")
    }
    
    return {
        "valid": True,
        "prepared_data": prepared_data
    }


def run_data_analysis(prepared_data: Dict[str, Any]) -> Dict[str, Any]:
    """Step function: Run intensive data analysis"""
    import time
    
    # Simulate long-running analysis
    # In real implementation, this could:
    # - Run ML models
    # - Perform statistical analysis
    # - Generate reports
    # - Call external APIs
    
    dataset_id = prepared_data["dataset_id"]
    row_count = prepared_data["row_count"]
    
    # Simulate processing time based on data size
    processing_time = min(row_count / 100, 300)  # Max 5 minutes for demo
    
    analysis_result = {
        "dataset_id": dataset_id,
        "total_sales": 1250000.50,
        "top_region": "North America",
        "growth_rate": 15.3,
        "anomalies_detected": 2,
        "confidence_score": 0.87,
        "processing_time_seconds": processing_time,
        "requires_review": row_count > 10000  # Large datasets need review
    }
    
    return analysis_result


def generate_insights(analysis_result: Dict[str, Any], review_result: Dict[str, Any]) -> Dict[str, Any]:
    """Step function: Generate business insights from analysis"""
    
    insights = {
        "summary": f"Analysis of dataset {analysis_result['dataset_id']} completed",
        "key_findings": [
            f"Total sales: ${analysis_result['total_sales']:,.2f}",
            f"Top performing region: {analysis_result['top_region']}",
            f"Growth rate: {analysis_result['growth_rate']}%"
        ],
        "recommendations": [],
        "processing_time": analysis_result["processing_time_seconds"],
        "review_status": "approved" if review_result["approved"] else "rejected",
        "review_notes": review_result.get("notes", "")
    }
    
    # Add recommendations based on findings
    if analysis_result["growth_rate"] > 10:
        insights["recommendations"].append("Consider expanding in high-growth regions")
    
    if analysis_result["anomalies_detected"] > 0:
        insights["recommendations"].append(f"Investigate {analysis_result['anomalies_detected']} data anomalies")
    
    return insights


def send_notifications(insights: Dict[str, Any], notify_users: list) -> Dict[str, Any]:
    """Step function: Send notifications to stakeholders"""
    
    # In real implementation, this would:
    # - Send emails via SES
    # - Post to Slack/Teams
    # - Update dashboards
    # - Store results in database
    
    notifications_sent = 0
    
    for user in notify_users:
        # Simulate sending notification
        print(f"Sending notification to {user}: {insights['summary']}")
        notifications_sent += 1
    
    return {
        "count": notifications_sent,
        "recipients": notify_users,
        "timestamp": "2026-03-17T10:30:00Z"
    }


# Example usage and testing
if __name__ == "__main__":
    # This is how you would test locally (once SDK is installed)
    sample_event = {
        "dataset_id": "sales_data_2026_q1",
        "row_count": 15000,
        "columns": ["sales", "region", "date", "product"],
        "data_source": "s3://narralytics-data/sales_2026_q1.csv",
        "notify_users": ["analyst@company.com", "manager@company.com"]
    }
    
    print("Sample event for testing:")
    print(json.dumps(sample_event, indent=2))