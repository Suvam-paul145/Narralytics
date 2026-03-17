#!/bin/bash

# Deployment script for durable functions
# This script helps deploy the durable function using AWS SAM

set -e

ENVIRONMENT=${1:-dev}
STACK_NAME="narralytics-durable-functions-${ENVIRONMENT}"

echo "🚀 Deploying durable functions to environment: ${ENVIRONMENT}"

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo "❌ AWS SAM CLI is not installed"
    echo "Install it from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured"
    echo "Run: aws configure"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Build the application
echo "📦 Building SAM application..."
sam build

# Deploy the application
echo "🚀 Deploying to AWS..."
sam deploy \
    --stack-name "${STACK_NAME}" \
    --parameter-overrides Environment="${ENVIRONMENT}" \
    --capabilities CAPABILITY_IAM \
    --resolve-s3 \
    --confirm-changeset

echo "✅ Deployment completed!"

# Get the outputs
echo "📋 Stack outputs:"
aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table

echo ""
echo "🎉 Durable function deployed successfully!"
echo ""
echo "To invoke the function:"
echo "aws lambda invoke --function-name narralytics-data-processing-${ENVIRONMENT}:1 --payload '{\"dataset_id\":\"test\"}' output.json"
echo ""
echo "Note: Durable functions require qualified ARNs (with version or alias)"