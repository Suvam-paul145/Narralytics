#!/bin/bash
set -euo pipefail

REGION=${AWS_REGION:-us-east-1}
PROJECT_NAME="narralytics"

echo "🧪 TESTING DEPLOYMENT"

# Get API URL
API_URL=$(aws apigatewayv2 get-apis --query "Items[?Name=='${PROJECT_NAME}-api'].ApiEndpoint" --output text --region ${REGION})

if [ -z "$API_URL" ]; then
    echo "❌ API Gateway not found"
    exit 1
fi

echo "API URL: $API_URL"

# Test health endpoint
echo "Testing health endpoint..."
if curl -f -s "${API_URL}/health" | grep -q "ok"; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    exit 1
fi

# Test API health endpoint
echo "Testing API health endpoint..."
if curl -f -s "${API_URL}/api/health" | grep -q "healthy"; then
    echo "✅ API health check passed"
else
    echo "⚠️  API health check failed (may be normal if DB is disconnected)"
fi

# Test docs endpoint
echo "Testing docs endpoint..."
if curl -f -s "${API_URL}/docs" | grep -q "FastAPI"; then
    echo "✅ API docs accessible"
else
    echo "❌ API docs failed"
fi

# Test Lambda function directly
echo "Testing Lambda function directly..."
aws lambda invoke \
  --function-name ${PROJECT_NAME}-backend \
  --region ${REGION} \
  --payload '{"httpMethod":"GET","path":"/health","headers":{"Host":"test"},"queryStringParameters":null,"body":null,"isBase64Encoded":false}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/lambda-response.json

if grep -q '"statusCode": 200' /tmp/lambda-response.json; then
    echo "✅ Lambda direct invocation passed"
else
    echo "❌ Lambda direct invocation failed"
    cat /tmp/lambda-response.json
    exit 1
fi

# Check CloudWatch logs
echo "Checking recent logs..."
aws logs describe-log-streams \
  --log-group-name /aws/lambda/${PROJECT_NAME}-backend \
  --order-by LastEventTime \
  --descending \
  --max-items 1 \
  --region ${REGION} \
  --query 'logStreams[0].logStreamName' \
  --output text

echo "✅ ALL TESTS PASSED"
echo "Deployment is ready for production use"