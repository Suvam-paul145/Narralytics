# AWS Lambda Durable Functions Example

This directory contains a complete example of AWS Lambda durable functions for long-running data processing workflows.

## What This Example Demonstrates

- **Multi-step workflow**: Data validation → Analysis → Review → Insights → Notifications
- **Long-running operations**: Can execute for hours or days
- **Human-in-the-loop**: Waits for external approval when needed
- **Automatic recovery**: Resumes from checkpoints if interrupted
- **Proper error handling**: Graceful failure and retry logic

## Files Overview

- `data_processing_workflow.py` - Main durable function implementation
- `test_data_processing.py` - Local testing examples
- `template.yaml` - AWS SAM deployment template
- `requirements.txt` - Python dependencies
- `deploy.sh` - Deployment script
- `README.md` - This file

## Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **Python 3.11+** installed
3. **AWS SAM CLI** for deployment (optional, can use direct Lambda deployment)

## Installation

1. Install the durable execution SDK:
   ```bash
   pip install aws-durable-execution-sdk-python aws-durable-execution-sdk-python-testing
   ```

2. Install other dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Local Testing

Run the test file to see how durable functions work locally:

```bash
python test_data_processing.py
```

This will show you:
- How to test durable functions
- How operations are tracked and named
- How to verify workflow execution

## Deployment Options

### Option 1: Using AWS SAM (Recommended)

1. Install AWS SAM CLI
2. Run the deployment script:
   ```bash
   ./deploy.sh dev  # or staging, prod
   ```

### Option 2: Direct Lambda Deployment

1. Create a deployment package:
   ```bash
   pip install -r requirements.txt -t .
   zip -r function.zip .
   ```

2. Create the Lambda function with durable execution enabled:
   ```bash
   aws lambda create-function \
     --function-name narralytics-data-processing \
     --runtime python3.13 \
     --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-durable-role \
     --handler data_processing_workflow.data_processing_handler \
     --zip-file fileb://function.zip \
     --durable-execution Enabled=true
   ```

## Usage Examples

### Invoke via AWS CLI

```bash
# Create test payload
cat > test_payload.json << EOF
{
  "dataset_id": "sales_data_2026_q1",
  "row_count": 15000,
  "columns": ["sales", "region", "date", "product"],
  "data_source": "s3://narralytics-data/sales_2026_q1.csv",
  "notify_users": ["analyst@company.com", "manager@company.com"]
}
EOF

# Invoke the function (note: requires qualified ARN)
aws lambda invoke \
  --function-name narralytics-data-processing-dev:1 \
  --payload file://test_payload.json \
  output.json

# Check the result
cat output.json
```

### Invoke via API Gateway

```bash
curl -X POST https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/Prod/process-data \
  -H "Content-Type: application/json" \
  -d @test_payload.json
```

## Key Concepts Demonstrated

### 1. Durable Steps
Each step is atomic and will not re-execute on replay:
```python
result = context.step(
    lambda _: process_data(input_data),
    name="process_data"  # Important: always name your steps
)
```

### 2. Wait Operations
Wait for external events or timeouts:
```python
review_result = context.wait(
    duration=Duration.from_hours(24),
    name="await_human_review"
)
```

### 3. Replay-Safe Logging
Use context.logger for replay-aware logging:
```python
context.logger.info("This won't duplicate on replay")
```

### 4. Error Handling
Steps automatically retry on transient failures:
```python
# This will retry automatically on network errors
result = context.step(
    lambda _: call_external_api(),
    name="api_call"
)
```

## Monitoring and Troubleshooting

### View Execution History
```bash
# Get execution ID from CloudWatch logs, then:
aws lambda get-durable-execution-state \
  --function-name narralytics-data-processing-dev:1 \
  --execution-id YOUR_EXECUTION_ID
```

### CloudWatch Logs
- Function logs: `/aws/lambda/narralytics-data-processing-dev`
- Look for execution IDs to track specific workflow runs

### Common Issues

1. **Function not found**: Ensure you're using qualified ARN (with version/alias)
2. **Permission denied**: Check IAM role has `AWSLambdaBasicDurableExecutionRolePolicy`
3. **Replay errors**: Ensure all non-deterministic code is in steps

## Next Steps

1. **Install the SDK** once network connectivity is restored
2. **Run local tests** to understand the concepts
3. **Deploy to AWS** using the provided templates
4. **Integrate with your existing Narralytics backend** for real data processing workflows

## Integration with Narralytics

This durable function can be integrated with your existing backend to:
- Process large datasets uploaded to your system
- Run long-running AI analysis workflows
- Handle multi-step report generation
- Manage human approval workflows for sensitive data

The function can be triggered by:
- API calls from your FastAPI backend
- S3 events when new data is uploaded
- Scheduled CloudWatch events
- Manual invocations for testing