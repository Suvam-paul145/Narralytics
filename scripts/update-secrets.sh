#!/bin/bash
set -euo pipefail

REGION=${AWS_REGION:-us-east-1}
PROJECT_NAME="narralytics"
ENV_FILE="lambda-env-vars.json"

echo "🔐 UPDATING SECRETS"

# Read secrets from the env vars JSON file (single source of truth)
if [ ! -f "${ENV_FILE}" ]; then
    echo "❌ ${ENV_FILE} not found. Please ensure it exists in the project root."
    exit 1
fi

GOOGLE_CLIENT_ID=$(python3 -c "import json; print(json.load(open('${ENV_FILE}'))['Variables']['GOOGLE_CLIENT_ID'])")
GOOGLE_CLIENT_SECRET=$(python3 -c "import json; print(json.load(open('${ENV_FILE}'))['Variables']['GOOGLE_CLIENT_SECRET'])")
JWT_SECRET_VAL=$(python3 -c "import json; print(json.load(open('${ENV_FILE}'))['Variables']['JWT_SECRET'])")
GEMINI_API_KEY_VAL=$(python3 -c "import json; print(json.load(open('${ENV_FILE}'))['Variables']['GEMINI_API_KEY'])")
MONGODB_URI_VAL=$(python3 -c "import json; print(json.load(open('${ENV_FILE}'))['Variables']['MONGODB_URI'])")

# Create secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name ${PROJECT_NAME}/google-oauth \
  --description "Google OAuth credentials for ${PROJECT_NAME}" \
  --secret-string "{\"client_id\": \"${GOOGLE_CLIENT_ID}\", \"client_secret\": \"${GOOGLE_CLIENT_SECRET}\"}" \
  --region ${REGION} 2>/dev/null || \
aws secretsmanager update-secret \
  --secret-id ${PROJECT_NAME}/google-oauth \
  --secret-string "{\"client_id\": \"${GOOGLE_CLIENT_ID}\", \"client_secret\": \"${GOOGLE_CLIENT_SECRET}\"}" \
  --region ${REGION}

aws secretsmanager create-secret \
  --name ${PROJECT_NAME}/jwt-secret \
  --description "JWT secret for ${PROJECT_NAME}" \
  --secret-string "${JWT_SECRET_VAL}" \
  --region ${REGION} 2>/dev/null || \
aws secretsmanager update-secret \
  --secret-id ${PROJECT_NAME}/jwt-secret \
  --secret-string "${JWT_SECRET_VAL}" \
  --region ${REGION}

aws secretsmanager create-secret \
  --name ${PROJECT_NAME}/gemini-api-key \
  --description "Gemini API key for ${PROJECT_NAME}" \
  --secret-string "${GEMINI_API_KEY_VAL}" \
  --region ${REGION} 2>/dev/null || \
aws secretsmanager update-secret \
  --secret-id ${PROJECT_NAME}/gemini-api-key \
  --secret-string "${GEMINI_API_KEY_VAL}" \
  --region ${REGION}

aws secretsmanager create-secret \
  --name ${PROJECT_NAME}/mongodb-uri \
  --description "MongoDB connection string for ${PROJECT_NAME}" \
  --secret-string "${MONGODB_URI_VAL}" \
  --region ${REGION} 2>/dev/null || \
aws secretsmanager update-secret \
  --secret-id ${PROJECT_NAME}/mongodb-uri \
  --secret-string "${MONGODB_URI_VAL}" \
  --region ${REGION}

# Update IAM role to access secrets
cat > /tmp/secrets-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:${REGION}:*:secret:${PROJECT_NAME}/*"
      ]
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name ${PROJECT_NAME}-lambda-execution-role \
  --policy-name ${PROJECT_NAME}SecretsAccess \
  --policy-document file:///tmp/secrets-policy.json

echo "✅ SECRETS UPDATED"
echo "Secrets stored in AWS Secrets Manager:"
echo "- ${PROJECT_NAME}/google-oauth"
echo "- ${PROJECT_NAME}/jwt-secret"
echo "- ${PROJECT_NAME}/gemini-api-key"
echo "- ${PROJECT_NAME}/mongodb-uri"