#!/bin/bash
set -euo pipefail

REGION=${AWS_REGION:-us-east-1}
PROJECT_NAME="narralytics"
ENVIRONMENT=${ENVIRONMENT:-prod}

echo "🔄 ROLLING BACK DEPLOYMENT"

# Delete Lambda function
aws lambda delete-function \
  --function-name ${PROJECT_NAME}-backend \
  --region ${REGION} 2>/dev/null || true

# Delete API Gateway
API_ID=$(aws apigatewayv2 get-apis --query "Items[?Name=='${PROJECT_NAME}-api'].ApiId" --output text --region ${REGION})
if [ -n "$API_ID" ] && [ "$API_ID" != "None" ]; then
    aws apigatewayv2 delete-api \
      --api-id ${API_ID} \
      --region ${REGION}
fi

# Delete IAM role and policies
aws iam detach-role-policy \
  --role-name ${PROJECT_NAME}-lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || true

aws iam delete-role-policy \
  --role-name ${PROJECT_NAME}-lambda-execution-role \
  --policy-name ${PROJECT_NAME}LambdaPermissions 2>/dev/null || true

aws iam delete-role \
  --role-name ${PROJECT_NAME}-lambda-execution-role 2>/dev/null || true

# Delete CloudWatch alarms
aws cloudwatch delete-alarms \
  --alarm-names "${PROJECT_NAME}-lambda-errors" "${PROJECT_NAME}-lambda-duration" \
  --region ${REGION} 2>/dev/null || true

# Delete CloudWatch dashboard
aws cloudwatch delete-dashboards \
  --dashboard-names ${PROJECT_NAME}-${ENVIRONMENT} \
  --region ${REGION} 2>/dev/null || true

# Delete log group
aws logs delete-log-group \
  --log-group-name /aws/lambda/${PROJECT_NAME}-backend \
  --region ${REGION} 2>/dev/null || true

echo "⚠️  WARNING: S3 buckets and DynamoDB table preserved to prevent data loss"
echo "To delete them manually:"
echo "aws s3 rb s3://${PROJECT_NAME}-uploads-${ENVIRONMENT} --force"
echo "aws s3 rb s3://${PROJECT_NAME}-deploy-artifacts --force"
echo "aws dynamodb delete-table --table-name ${PROJECT_NAME}_history --region ${REGION}"

echo "✅ ROLLBACK COMPLETE"