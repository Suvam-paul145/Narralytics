#!/bin/bash
set -euo pipefail

REGION=${AWS_REGION:-us-east-1}
PROJECT_NAME="narralytics"
ENVIRONMENT=${ENVIRONMENT:-prod}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "=== PHASE 4: Application Deployment ==="

# Build and package Lambda
cd backend
rm -rf lambda_package narralytics_lambda_minimal.zip
mkdir lambda_package

pip install -r requirements_minimal.txt \
  --target ./lambda_package \
  --upgrade \
  --platform manylinux2014_x86_64 \
  --implementation cp \
  --python-version 3.11 \
  --only-binary=:all: || pip install -r requirements_minimal.txt --target ./lambda_package --upgrade

cp main.py config.py ./lambda_package/
cp -r auth database llm models pdf routers sqlite storage ./lambda_package/

find ./lambda_package -name "*.pyc" -delete
find ./lambda_package -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

cd lambda_package
zip -r ../narralytics_lambda_minimal.zip . -x "*.pyc" -x "*/__pycache__/*"
cd ..

# Upload to S3
aws s3 cp narralytics_lambda_minimal.zip s3://${PROJECT_NAME}-deploy-artifacts/narralytics_lambda_minimal.zip

# Create or update Lambda function
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${PROJECT_NAME}-lambda-execution-role"

if aws lambda get-function --function-name ${PROJECT_NAME}-backend --region ${REGION} >/dev/null 2>&1; then
  aws lambda update-function-code \
    --function-name ${PROJECT_NAME}-backend \
    --s3-bucket ${PROJECT_NAME}-deploy-artifacts \
    --s3-key narralytics_lambda_minimal.zip \
    --region ${REGION}
else
  aws lambda create-function \
    --function-name ${PROJECT_NAME}-backend \
    --runtime python3.11 \
    --role ${ROLE_ARN} \
    --handler main.handler \
    --code S3Bucket=${PROJECT_NAME}-deploy-artifacts,S3Key=narralytics_lambda_minimal.zip \
    --timeout 60 \
    --memory-size 512 \
    --region ${REGION} \
    --description "${PROJECT_NAME} FastAPI backend via Mangum"
fi

# Wait for function update to complete before configuring
echo "Waiting for Lambda function to become active..."
aws lambda wait function-updated --function-name ${PROJECT_NAME}-backend --region ${REGION} 2>/dev/null || sleep 10

# Set environment variables from JSON file
aws lambda update-function-configuration \
  --function-name ${PROJECT_NAME}-backend \
  --region ${REGION} \
  --environment file://../lambda-env-vars.json

# Create API Gateway
API_ID=$(aws apigatewayv2 create-api \
  --name ${PROJECT_NAME}-api \
  --protocol-type HTTP \
  --region ${REGION} \
  --cors-configuration "AllowOrigins=*,AllowMethods=*,AllowHeaders=*,MaxAge=300" \
  --query 'ApiId' \
  --output text 2>/dev/null || aws apigatewayv2 get-apis --query "Items[?Name=='${PROJECT_NAME}-api'].ApiId" --output text)

LAMBDA_ARN=$(aws lambda get-function --function-name ${PROJECT_NAME}-backend --region ${REGION} --query 'Configuration.FunctionArn' --output text)

INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id ${API_ID} \
  --integration-type AWS_PROXY \
  --integration-uri ${LAMBDA_ARN} \
  --payload-format-version 2.0 \
  --region ${REGION} \
  --query 'IntegrationId' \
  --output text 2>/dev/null || aws apigatewayv2 get-integrations --api-id ${API_ID} --query 'Items[0].IntegrationId' --output text)

aws apigatewayv2 create-route \
  --api-id ${API_ID} \
  --route-key '$default' \
  --target "integrations/${INTEGRATION_ID}" \
  --region ${REGION} 2>/dev/null || true

aws apigatewayv2 create-stage \
  --api-id ${API_ID} \
  --stage-name '$default' \
  --auto-deploy \
  --region ${REGION} 2>/dev/null || true

aws lambda add-permission \
  --function-name ${PROJECT_NAME}-backend \
  --statement-id apigateway-invoke-permission \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" \
  --region ${REGION} 2>/dev/null || true

API_URL=$(aws apigatewayv2 get-api --api-id ${API_ID} --region ${REGION} --query 'ApiEndpoint' --output text)

# Update Lambda REDIRECT_URI with actual API Gateway URL
# Read existing env vars from JSON, override REDIRECT_URI with the real API Gateway URL
aws lambda wait function-updated --function-name ${PROJECT_NAME}-backend --region ${REGION} 2>/dev/null || sleep 10

# Build updated env vars JSON with real API Gateway URL
python3 -c "
import json, sys
with open('../lambda-env-vars.json') as f:
    env = json.load(f)
env['Variables']['REDIRECT_URI'] = '${API_URL}/auth/callback'
with open('/tmp/lambda-env-vars-updated.json', 'w') as f:
    json.dump(env, f, indent=2)
"

aws lambda update-function-configuration \
  --function-name ${PROJECT_NAME}-backend \
  --region ${REGION} \
  --environment file:///tmp/lambda-env-vars-updated.json

echo "Application deployment complete"
echo "API Gateway URL: ${API_URL}"
echo "Health Check: ${API_URL}/health"
echo "API Docs: ${API_URL}/docs"
echo "OAuth Callback: ${API_URL}/auth/callback"

cd ..