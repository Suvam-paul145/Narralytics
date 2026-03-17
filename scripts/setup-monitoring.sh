#!/bin/bash
set -euo pipefail

REGION=${AWS_REGION:-us-east-1}
PROJECT_NAME="narralytics"
ENVIRONMENT=${ENVIRONMENT:-prod}

echo "📊 SETTING UP MONITORING"

# Create SNS topic for alerts
TOPIC_ARN=$(aws sns create-topic \
  --name ${PROJECT_NAME}-alerts \
  --region ${REGION} \
  --query 'TopicArn' \
  --output text)

# Create comprehensive CloudWatch dashboard
cat > /tmp/comprehensive-dashboard.json << EOF
{
  "widgets": [
    {
      "type": "metric",
      "x": 0,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Duration", "FunctionName", "${PROJECT_NAME}-backend"],
          [".", "Errors", ".", "."],
          [".", "Invocations", ".", "."],
          [".", "Throttles", ".", "."]
        ],
        "period": 300,
        "stat": "Average",
        "region": "${REGION}",
        "title": "Lambda Performance"
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 0,
      "width": 12,
      "height": 6,
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
    },
    {
      "type": "metric",
      "x": 0,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "${PROJECT_NAME}_history"],
          [".", "ConsumedWriteCapacityUnits", ".", "."],
          [".", "UserErrors", ".", "."],
          [".", "SystemErrors", ".", "."]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "${REGION}",
        "title": "DynamoDB Metrics"
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["AWS/S3", "BucketSizeBytes", "BucketName", "${PROJECT_NAME}-uploads-${ENVIRONMENT}", "StorageType", "StandardStorage"],
          [".", "NumberOfObjects", ".", ".", ".", "AllStorageTypes"]
        ],
        "period": 86400,
        "stat": "Average",
        "region": "${REGION}",
        "title": "S3 Storage Metrics"
      }
    }
  ]
}
EOF

aws cloudwatch put-dashboard \
  --dashboard-name ${PROJECT_NAME}-comprehensive \
  --dashboard-body file:///tmp/comprehensive-dashboard.json \
  --region ${REGION}

# Create detailed alarms
aws cloudwatch put-metric-alarm \
  --alarm-name "${PROJECT_NAME}-high-error-rate" \
  --alarm-description "High error rate detected" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=${PROJECT_NAME}-backend \
  --evaluation-periods 2 \
  --alarm-actions ${TOPIC_ARN} \
  --region ${REGION}

aws cloudwatch put-metric-alarm \
  --alarm-name "${PROJECT_NAME}-high-latency" \
  --alarm-description "High latency detected" \
  --metric-name Duration \
  --namespace AWS/Lambda \
  --statistic Average \
  --period 300 \
  --threshold 30000 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=${PROJECT_NAME}-backend \
  --evaluation-periods 3 \
  --alarm-actions ${TOPIC_ARN} \
  --region ${REGION}

aws cloudwatch put-metric-alarm \
  --alarm-name "${PROJECT_NAME}-api-5xx-errors" \
  --alarm-description "API Gateway 5XX errors" \
  --metric-name 5XXError \
  --namespace AWS/ApiGateway \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ApiName,Value=${PROJECT_NAME}-api \
  --evaluation-periods 2 \
  --alarm-actions ${TOPIC_ARN} \
  --region ${REGION}

# Create log insights queries
aws logs put-query-definition \
  --name "${PROJECT_NAME}-error-analysis" \
  --log-group-names "/aws/lambda/${PROJECT_NAME}-backend" \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 100' \
  --region ${REGION}

aws logs put-query-definition \
  --name "${PROJECT_NAME}-performance-analysis" \
  --log-group-names "/aws/lambda/${PROJECT_NAME}-backend" \
  --query-string 'fields @timestamp, @duration, @billedDuration, @memorySize, @maxMemoryUsed | filter @type = "REPORT" | sort @timestamp desc | limit 100' \
  --region ${REGION}

echo "✅ MONITORING SETUP COMPLETE"
echo "Dashboard: https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=${PROJECT_NAME}-comprehensive"
echo "SNS Topic: ${TOPIC_ARN}"
echo "Log Insights: https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#logsV2:logs-insights"