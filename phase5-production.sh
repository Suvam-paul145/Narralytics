#!/bin/bash
set -euo pipefail

REGION=${AWS_REGION:-us-east-1}
PROJECT_NAME="narralytics"
ENVIRONMENT=${ENVIRONMENT:-prod}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "=== PHASE 5: Production Readiness ==="

# Create CloudWatch Log Group
aws logs create-log-group \
  --log-group-name /aws/lambda/${PROJECT_NAME}-backend \
  --region ${REGION} 2>/dev/null || true

# Set log retention
aws logs put-retention-policy \
  --log-group-name /aws/lambda/${PROJECT_NAME}-backend \
  --retention-in-days 30 \
  --region ${REGION} 2>/dev/null || true

# Create CloudWatch Dashboard
cat > /tmp/dashboard.json << EOF
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Duration", "FunctionName", "${PROJECT_NAME}-backend"],
          [".", "Errors", ".", "."],
          [".", "Invocations", ".", "."]
        ],
        "period": 300,
        "stat": "Average",
        "region": "${REGION}",
        "title": "Lambda Metrics"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApiGateway", "Count", "ApiName", "${PROJECT_NAME}-api"],
          [".", "Latency", ".", "."],
          [".", "4XXError", ".", "."],
          [".", "5XXError", ".", "."]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "${REGION}",
        "title": "API Gateway Metrics"
      }
    }
  ]
}
EOF

aws cloudwatch put-dashboard \
  --dashboard-name ${PROJECT_NAME}-${ENVIRONMENT} \
  --dashboard-body file:///tmp/dashboard.json \
  --region ${REGION}

# Create CloudWatch Alarms
aws cloudwatch put-metric-alarm \
  --alarm-name "${PROJECT_NAME}-lambda-errors" \
  --alarm-description "Lambda function errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=${PROJECT_NAME}-backend \
  --evaluation-periods 2 \
  --region ${REGION}

aws cloudwatch put-metric-alarm \
  --alarm-name "${PROJECT_NAME}-lambda-duration" \
  --alarm-description "Lambda function duration" \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --threshold 30000 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=${PROJECT_NAME}-backend \
  --evaluation-periods 2 \
  --region ${REGION}

# Configure Lambda reserved concurrency
aws lambda put-reserved-concurrency-config \
  --function-name ${PROJECT_NAME}-backend \
  --reserved-concurrent-executions 100 \
  --region ${REGION}

# DynamoDB backup configuration
# Point-in-time recovery (PITR) is enabled below

# Enable point-in-time recovery for DynamoDB
aws dynamodb update-continuous-backups \
  --table-name ${PROJECT_NAME}_history \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region ${REGION} 2>/dev/null || true

# Create S3 lifecycle policy
cat > /tmp/lifecycle.json << EOF
{
  "Rules": [
    {
      "ID": "delete-old-uploads",
      "Status": "Enabled",
      "Filter": {"Prefix": "uploads/"},
      "Expiration": {"Days": 30}
    }
  ]
}
EOF

aws s3api put-bucket-lifecycle-configuration \
  --bucket ${PROJECT_NAME}-uploads-${ENVIRONMENT} \
  --lifecycle-configuration file:///tmp/lifecycle.json

# Create GitHub Actions workflow
mkdir -p .github/workflows
cat > .github/workflows/deploy.yml << 'EOF'
name: Deploy Narralytics
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - name: Deploy Infrastructure
        run: bash phase3-infrastructure.sh
      - name: Deploy Application
        run: bash phase4-application.sh
      - name: Configure Production
        run: bash phase5-production.sh
EOF

# Test deployment
API_URL=$(aws apigatewayv2 get-apis --query "Items[?Name=='${PROJECT_NAME}-api'].ApiEndpoint" --output text --region ${REGION})

echo "Testing deployment..."
curl -f "${API_URL}/health" || echo "Health check failed"

echo "Production readiness complete"
echo "Dashboard: https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=${PROJECT_NAME}-${ENVIRONMENT}"
echo "Logs: https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#logsV2:log-groups/log-group/%2Faws%2Flambda%2F${PROJECT_NAME}-backend"