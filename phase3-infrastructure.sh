#!/bin/bash
set -euo pipefail

REGION=${AWS_REGION:-us-east-1}
PROJECT_NAME="narralytics"
ENVIRONMENT=${ENVIRONMENT:-prod}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "=== PHASE 3: Infrastructure Provisioning ==="

# Create S3 buckets
aws s3 mb s3://${PROJECT_NAME}-uploads-${ENVIRONMENT} --region ${REGION} || true
aws s3 mb s3://${PROJECT_NAME}-deploy-artifacts --region ${REGION} || true

# Configure S3 bucket policies
aws s3api put-public-access-block \
  --bucket ${PROJECT_NAME}-uploads-${ENVIRONMENT} \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-versioning \
  --bucket ${PROJECT_NAME}-uploads-${ENVIRONMENT} \
  --versioning-configuration Status=Enabled

# Create DynamoDB table
aws dynamodb create-table \
  --table-name ${PROJECT_NAME}_history \
  --attribute-definitions AttributeName=user_id,AttributeType=S AttributeName=timestamp,AttributeType=S \
  --key-schema AttributeName=user_id,KeyType=HASH AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region ${REGION} \
  --tags Key=Project,Value=${PROJECT_NAME} Key=Environment,Value=${ENVIRONMENT} || true

# Create ECR repository
aws ecr create-repository \
  --repository-name ${PROJECT_NAME}-backend \
  --region ${REGION} || true

# Create IAM execution role
cat > /tmp/lambda-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
  --role-name ${PROJECT_NAME}-lambda-execution-role \
  --assume-role-policy-document file:///tmp/lambda-trust-policy.json \
  --description "Execution role for ${PROJECT_NAME} Lambda function" || true

# Attach managed policies
aws iam attach-role-policy \
  --role-name ${PROJECT_NAME}-lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole || true

# Create custom policy
cat > /tmp/lambda-permissions.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:PutItem","dynamodb:GetItem","dynamodb:Query","dynamodb:Scan","dynamodb:UpdateItem","dynamodb:DeleteItem"],
      "Resource": "arn:aws:dynamodb:${REGION}:*:table/${PROJECT_NAME}_history"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:HeadObject"],
      "Resource": "arn:aws:s3:::${PROJECT_NAME}-uploads-${ENVIRONMENT}/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::${PROJECT_NAME}-uploads-${ENVIRONMENT}"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name ${PROJECT_NAME}-lambda-execution-role \
  --policy-name ${PROJECT_NAME}LambdaPermissions \
  --policy-document file:///tmp/lambda-permissions.json || true

echo "Infrastructure provisioning complete"