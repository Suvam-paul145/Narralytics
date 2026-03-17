# ☁️ NARRALYTICS — AWS Deployment Roadmap
> **Current State → Production on AWS Lambda + API Gateway**
> Based on actual repo state at `github.com/Suvam-paul145/Narralytics` · March 2026

---

## 📋 Table of Contents

1. [Current State Audit](#1-current-state-audit)
2. [What Changes vs What Stays](#2-what-changes-vs-what-stays)
3. [Pre-Flight Checklist](#3-pre-flight-checklist)
4. [Phase 1 — Fix the google-genai SDK Issue](#4-phase-1--fix-the-google-genai-sdk-issue)
5. [Phase 2 — Prepare the Lambda Package](#5-phase-2--prepare-the-lambda-package)
6. [Phase 3 — IAM Role Setup](#6-phase-3--iam-role-setup)
7. [Phase 4 — Create the Lambda Function](#7-phase-4--create-the-lambda-function)
8. [Phase 5 — API Gateway Setup](#8-phase-5--api-gateway-setup)
9. [Phase 6 — Update Google OAuth](#9-phase-6--update-google-oauth)
10. [Phase 7 — S3 for File Uploads](#10-phase-7--s3-for-file-uploads)
11. [Phase 8 — DynamoDB for History (Optional Swap)](#11-phase-8--dynamodb-for-history-optional-swap)
12. [Phase 9 — Frontend → Vercel Update](#12-phase-9--frontend--vercel-update)
13. [Phase 10 — CORS + Environment Variables Final Pass](#13-phase-10--cors--environment-variables-final-pass)
14. [Phase 11 — Deploy and Smoke Test](#14-phase-11--deploy-and-smoke-test)
15. [Troubleshooting Reference](#15-troubleshooting-reference)
16. [Full Environment Variable Reference](#16-full-environment-variable-reference)
17. [Post-Deploy Demo Checklist](#17-post-deploy-demo-checklist)

---

## 1. Current State Audit

This is a precise inventory of what your repo has right now and what it means for AWS.

### ✅ Already Done — Zero Work Needed

| Item | Status | Why It Matters |
|---|---|---|
| `Mangum` in `requirements.txt` | ✅ | Lambda ASGI bridge is installed |
| `handler = Mangum(app)` in `main.py` | ✅ | Lambda entry point is wired |
| MongoDB Atlas | ✅ | Cloud DB — works identically on Lambda |
| `google-genai` SDK (migrated from old) | ✅ | New SDK works on Lambda |
| `boto3` in `requirements.txt` | ✅ | DynamoDB client is already a dependency |
| `storage/local.py` + `storage/s3.py` | ✅ | S3 abstraction layer already written |
| Pydantic models in `models/schemas.py` | ✅ | No changes needed |
| All 6 routers complete | ✅ | No code changes required |
| CI/CD GitHub Actions workflow | ✅ | Tests will keep passing |
| Vercel frontend deployment config | ✅ | Just needs `VITE_API_URL` update |
| DynamoDB table `narralytics_history` | ✅ | Already created from reference setup |

### ⚠️ Needs Work

| Item | Issue | Fix Section |
|---|---|---|
| `google-genai` cold start size | Library is large (~80MB) | Phase 2 — packaging strategy |
| `storage/local.py` still imported in `routers/datasets.py` | Needs S3 swap for production | Phase 7 |
| `UPLOAD_DIR = ./uploads` | Relative path breaks on Lambda | Phase 4 — env vars |
| MongoDB URI has no timeout | Lambda cold start can hang | Phase 4 — env var fix |
| CORS `allow_origins` only has `FRONTEND_URL` | Needs Vercel + localhost both | Phase 10 |
| `FRONTEND_ORIGINS` env var used in `main.py` | Must be set in Lambda | Phase 10 |
| GitHub Actions `CI_JWT_SECRET` / `CI_GEMINI_API_KEY` secrets | Should be set in GitHub | Not blocking deploy |

### ❌ Not Yet Done

| Item | Required? | Section |
|---|---|---|
| Lambda function created in AWS Console | Required | Phase 4 |
| API Gateway HTTP API created | Required | Phase 5 |
| S3 bucket for uploads | Required for persistent uploads | Phase 7 |
| IAM execution role for Lambda | Required | Phase 3 |
| Google OAuth redirect URI updated | Required | Phase 6 |
| Lambda zip package built | Required | Phase 2 |

---

## 2. What Changes vs What Stays

```
┌─────────────────────────────────────────────────────────────────┐
│                    NARRALYTICS ARCHITECTURE                      │
├──────────────────┬──────────────────────────────────────────────┤
│   COMPONENT      │  LOCAL → AWS CHANGE                          │
├──────────────────┼──────────────────────────────────────────────┤
│ FastAPI App      │ ZERO changes — same Python code              │
│ Mangum           │ Add handler = Mangum(app) ← ALREADY DONE     │
│ MongoDB Atlas    │ ZERO changes — same connection string         │
│ Gemini API       │ ZERO changes — external HTTP call             │
│ JWT Auth         │ ZERO changes — stateless, no storage          │
│ Google OAuth     │ UPDATE redirect URI in Google Console         │
│ SQLite           │ /tmp/uuid.db ← MUST use /tmp/ path on Lambda  │
│ File Storage     │ ./uploads/ → S3 bucket                        │
│ History (DB)     │ MongoDB OR DynamoDB — both work               │
│ Frontend         │ Update VITE_API_URL to API Gateway URL        │
│ CORS             │ Update allow_origins to include Vercel URL    │
└──────────────────┴──────────────────────────────────────────────┘
```

**One-line summary:** Your Python code is 99% unchanged. You're just changing where it runs (Lambda instead of uvicorn) and where files go (S3 instead of local disk).

---

## 3. Pre-Flight Checklist

Run through this before starting. Every item must be ✅ before continuing.

```bash
# 1. Check AWS CLI is installed and configured
aws --version
aws sts get-caller-identity
# Expected: JSON with your Account ID, UserId, Arn

# 2. Check Python version
python3 --version
# Expected: Python 3.11.x

# 3. Check you are in the repo root
ls
# Expected: backend/ frontend/ reference/ README.md

# 4. Check backend local tests pass
cd backend
pip install -r requirements.txt
pytest tests/test_config.py tests/test_health_endpoint.py -q
cd ..
# Expected: All tests pass

# 5. Confirm AWS account has Lambda + API Gateway + S3 + DynamoDB access
aws lambda list-functions --region us-east-1 --max-items 1
aws apigatewayv2 get-apis --region us-east-1
aws s3 ls
aws dynamodb list-tables --region us-east-1
```

---

## 4. Phase 1 — Fix the google-genai SDK Issue

The `google-genai` library has a **known Lambda cold start problem**: it ships with gRPC binaries that bloat the package. You need to verify the correct import style is used in all LLM files. Your repo already migrated to the new SDK but let's confirm.

### 1.1 Verify all LLM files use the correct pattern

All four files in `backend/llm/` must use this exact pattern:

```python
# CORRECT — already in your repo
from google import genai

@lru_cache(maxsize=1)
def _get_client():
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=settings.GEMINI_API_KEY)
```

**Do NOT use:**
```python
# WRONG — old SDK, will fail
import google.generativeai as genai
genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")
```

### 1.2 Verify requirements.txt

```txt
# backend/requirements.txt — confirmed correct entries:
google-genai          ← NEW SDK ✅
# google-generativeai  ← OLD SDK — must NOT be present ✅
```

Run this check:
```bash
cd backend
grep "generativeai" requirements.txt
# Should return NOTHING. If it returns a line, delete that line.
```

### 1.3 Pin the model name

Your LLM files use `gemini-2.5-flash`. This is correct for the new SDK. Confirm:

```bash
grep -r "gemini-" backend/llm/
# Expected output (all four files):
# backend/llm/auto_dashboard.py:        model='gemini-2.5-flash',
# backend/llm/chart_engine.py:          model='gemini-2.5-flash',
# backend/llm/chat_engine.py:           model='gemini-2.5-flash',
# backend/llm/report_engine.py:         model='gemini-2.5-flash',
```

---

## 5. Phase 2 — Prepare the Lambda Package

Lambda requires all dependencies bundled into a single ZIP file. This is the most critical step.

### 2.1 Create a clean build directory

```bash
cd backend

# Remove any previous build
rm -rf lambda_package narralytics_lambda.zip

# Create fresh package directory
mkdir lambda_package
```

### 2.2 Install dependencies into the package directory

```bash
# Install all production dependencies into lambda_package/
pip install -r requirements.txt \
  --target ./lambda_package \
  --upgrade \
  --platform manylinux2014_x86_64 \
  --implementation cp \
  --python-version 3.11 \
  --only-binary=:all: \
  --no-deps

# If the above fails (some packages don't have binary wheels), fall back to:
pip install -r requirements.txt \
  --target ./lambda_package \
  --upgrade
```

> **Why `--platform manylinux2014_x86_64`?** Your dev machine might be Mac (ARM) or Windows.
> Lambda runs on Linux x86_64. This flag forces the correct binary wheels to be downloaded.
> If this flag causes errors for a specific package, remove it and install that package normally.

### 2.3 Copy all application code

```bash
# Copy ALL Python application modules into the package root
cp main.py config.py ./lambda_package/

# Copy all module directories
cp -r auth/       ./lambda_package/auth/
cp -r database/   ./lambda_package/database/
cp -r llm/        ./lambda_package/llm/
cp -r models/     ./lambda_package/models/
cp -r pdf/        ./lambda_package/pdf/
cp -r routers/    ./lambda_package/routers/
cp -r sqlite/     ./lambda_package/sqlite/
cp -r storage/    ./lambda_package/storage/

# Verify structure
ls lambda_package/
# Expected: auth/ config.py database/ llm/ main.py models/ 
#           pdf/ routers/ sqlite/ storage/ [dependency folders...]
```

### 2.4 Remove unnecessary files to reduce package size

```bash
# Remove test files, cache, and docs
find ./lambda_package -name "*.pyc" -delete
find ./lambda_package -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find ./lambda_package -name "*.dist-info" -type d -exec rm -rf {} + 2>/dev/null || true
find ./lambda_package -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true

# Remove large unused binaries from packages that ship extras
# (These are safe to delete for Narralytics)
rm -rf ./lambda_package/pandas/tests 2>/dev/null || true
rm -rf ./lambda_package/numpy/tests 2>/dev/null || true
```

### 2.5 Create the ZIP file

```bash
cd lambda_package
zip -r ../narralytics_lambda.zip . -x "*.pyc" -x "*/__pycache__/*"
cd ..

# Check the size
ls -lh narralytics_lambda.zip
```

**Size expectations:**
- Under 50 MB → Can upload directly in AWS Console
- 50–250 MB → Must upload via S3 first (see note below)
- Over 250 MB → You need Lambda layers (see Phase 2.6)

### 2.6 If package is over 50MB — Upload to S3 First

```bash
# Create a deployment bucket (one-time, if you don't have one)
aws s3 mb s3://narralytics-deploy-artifacts --region us-east-1

# Upload the zip
aws s3 cp narralytics_lambda.zip s3://narralytics-deploy-artifacts/narralytics_lambda.zip

echo "S3 upload complete. Use this URI when creating Lambda:"
echo "s3://narralytics-deploy-artifacts/narralytics_lambda.zip"
```

### 2.7 Verify the package is correct

Before uploading to Lambda, do a quick sanity check:

```bash
# Test that the package can be imported
cd lambda_package
python3 -c "
import sys
sys.path.insert(0, '.')
from main import app, handler
from config import settings
print('✅ main.py imports successfully')
print(f'✅ handler type: {type(handler)}')
print(f'✅ app routes: {len(app.routes)}')
"
cd ..
```

---

## 6. Phase 3 — IAM Role Setup

Lambda needs an execution role that grants it permission to call DynamoDB, write CloudWatch logs, and (optionally) access S3.

### 3.1 Create the trust policy document

```bash
# Create the trust policy (tells AWS Lambda can assume this role)
cat > /tmp/lambda-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
```

### 3.2 Create the permissions policy document

```bash
cat > /tmp/narralytics-lambda-permissions.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Sid": "DynamoDBAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/narralytics_history"
    },
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::narralytics-uploads-*/*"
    },
    {
      "Sid": "S3ListBucket",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::narralytics-uploads-*"
    }
  ]
}
EOF
```

### 3.3 Create the IAM role

```bash
# Create the role
aws iam create-role \
  --role-name narralytics-lambda-execution-role \
  --assume-role-policy-document file:///tmp/lambda-trust-policy.json \
  --description "Execution role for Narralytics Lambda function"

# Attach AWS managed policy for basic Lambda execution
aws iam attach-role-policy \
  --role-name narralytics-lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Attach our custom inline policy
aws iam put-role-policy \
  --role-name narralytics-lambda-execution-role \
  --policy-name NarralyticsLambdaPermissions \
  --policy-document file:///tmp/narralytics-lambda-permissions.json

# Get the Role ARN — save this, you need it in Phase 4
aws iam get-role \
  --role-name narralytics-lambda-execution-role \
  --query 'Role.Arn' \
  --output text
```

**Save the ARN output.** It looks like:
`arn:aws:iam::123456789012:role/narralytics-lambda-execution-role`

> **Wait 10 seconds after creating the role before creating the Lambda.** IAM changes
> propagate asynchronously and the Lambda creation will fail if the role isn't ready yet.

---

## 7. Phase 4 — Create the Lambda Function

### 4.1 Set variables

```bash
# Set these once — used in all commands below
ROLE_ARN="arn:aws:iam::YOUR_ACCOUNT_ID:role/narralytics-lambda-execution-role"
REGION="us-east-1"
FUNCTION_NAME="narralytics-backend"

# Your actual values — fill these in
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
JWT_SECRET="your-64-char-hex-string"   # python -c "import secrets; print(secrets.token_hex(32))"
MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/"
GEMINI_API_KEY="AIza..."
FRONTEND_URL="https://your-narralytics.vercel.app"  # Update after Vercel deploy
```

### 4.2 Create the Lambda function

If your ZIP is **under 50 MB** (upload directly):

```bash
cd backend
aws lambda create-function \
  --function-name "$FUNCTION_NAME" \
  --runtime python3.11 \
  --role "$ROLE_ARN" \
  --handler main.handler \
  --zip-file fileb://narralytics_lambda.zip \
  --timeout 60 \
  --memory-size 512 \
  --region "$REGION" \
  --description "Narralytics FastAPI backend via Mangum" \
  --environment "Variables={
    GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET,
    REDIRECT_URI=https://PLACEHOLDER.execute-api.us-east-1.amazonaws.com/auth/callback,
    FRONTEND_URL=$FRONTEND_URL,
    JWT_SECRET=$JWT_SECRET,
    JWT_ALGORITHM=HS256,
    JWT_EXPIRE_HOURS=24,
    MONGODB_URI=$MONGODB_URI,
    MONGODB_DB=narralytics,
    GEMINI_API_KEY=$GEMINI_API_KEY,
    UPLOAD_DIR=/tmp/uploads,
    AWS_DEFAULT_REGION=us-east-1,
    AWS_BUCKET=narralytics-uploads-prod,
    DYNAMODB_TABLE=narralytics_history
  }"
```

If your ZIP is **over 50 MB** (use S3):

```bash
aws lambda create-function \
  --function-name "$FUNCTION_NAME" \
  --runtime python3.11 \
  --role "$ROLE_ARN" \
  --handler main.handler \
  --code "S3Bucket=narralytics-deploy-artifacts,S3Key=narralytics_lambda.zip" \
  --timeout 60 \
  --memory-size 512 \
  --region "$REGION" \
  --description "Narralytics FastAPI backend via Mangum" \
  --environment "Variables={...same as above...}"
```

> **Why timeout 60?** Gemini API calls take 3–8 seconds. PDF generation with ReportLab adds
> another 5–10s. MongoDB cold connection adds ~2s. 30s is too tight; 60s gives you room.

### 4.3 Verify the Lambda was created

```bash
aws lambda get-function \
  --function-name narralytics-backend \
  --region us-east-1 \
  --query 'Configuration.[FunctionName,Runtime,Handler,Timeout,MemorySize,State]'
```

Expected output:
```json
[
  "narralytics-backend",
  "python3.11",
  "main.handler",
  60,
  512,
  "Active"
]
```

### 4.4 Test the Lambda directly (before API Gateway)

```bash
# Invoke with a synthetic health check event
aws lambda invoke \
  --function-name narralytics-backend \
  --region us-east-1 \
  --payload '{"httpMethod":"GET","path":"/health","headers":{"Host":"test"},"queryStringParameters":null,"body":null,"isBase64Encoded":false}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/lambda-response.json

cat /tmp/lambda-response.json
```

**Expected response (inside the JSON):**
```json
{
  "statusCode": 200,
  "body": "{\"status\": \"ok\"}"
}
```

> **If you see a cold start error** about MongoDB timing out: this is normal on first invoke.
> The second invoke will be warm. Add a `serverSelectionTimeoutMS` param to your MongoDB URI:
> `mongodb+srv://...?serverSelectionTimeoutMS=5000`

---

## 8. Phase 5 — API Gateway Setup

Use **HTTP API** (v2), not REST API (v1). HTTP API is faster, cheaper, and simpler for Lambda proxy integration.

### 5.1 Create the HTTP API

```bash
# Create the API
API_ID=$(aws apigatewayv2 create-api \
  --name "narralytics-api" \
  --protocol-type HTTP \
  --region us-east-1 \
  --cors-configuration "AllowOrigins=*,AllowMethods=*,AllowHeaders=*,MaxAge=300" \
  --query 'ApiId' \
  --output text)

echo "API_ID: $API_ID"
# Save this — looks like: abc1def2gh
```

### 5.2 Create the Lambda integration

```bash
# Get Lambda ARN
LAMBDA_ARN=$(aws lambda get-function \
  --function-name narralytics-backend \
  --region us-east-1 \
  --query 'Configuration.FunctionArn' \
  --output text)

echo "Lambda ARN: $LAMBDA_ARN"

# Create integration
INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id "$API_ID" \
  --integration-type AWS_PROXY \
  --integration-uri "$LAMBDA_ARN" \
  --payload-format-version 2.0 \
  --region us-east-1 \
  --query 'IntegrationId' \
  --output text)

echo "Integration ID: $INTEGRATION_ID"
```

### 5.3 Create the catch-all route

```bash
# Route ALL requests to Lambda (FastAPI handles all internal routing)
aws apigatewayv2 create-route \
  --api-id "$API_ID" \
  --route-key '$default' \
  --target "integrations/$INTEGRATION_ID" \
  --region us-east-1
```

### 5.4 Create the default stage with auto-deploy

```bash
aws apigatewayv2 create-stage \
  --api-id "$API_ID" \
  --stage-name '$default' \
  --auto-deploy \
  --region us-east-1
```

### 5.5 Grant API Gateway permission to invoke Lambda

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws lambda add-permission \
  --function-name narralytics-backend \
  --statement-id apigateway-invoke-permission \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*" \
  --region us-east-1
```

### 5.6 Get your API Gateway URL

```bash
API_URL=$(aws apigatewayv2 get-api \
  --api-id "$API_ID" \
  --region us-east-1 \
  --query 'ApiEndpoint' \
  --output text)

echo "=============================="
echo "YOUR API GATEWAY URL:"
echo "$API_URL"
echo "=============================="
echo ""
echo "Health check:"
echo "${API_URL}/health"
echo ""
echo "API Docs:"
echo "${API_URL}/docs"
echo ""
echo "OAuth callback URI to add to Google Console:"
echo "${API_URL}/auth/callback"
```

**Save this URL.** You will use it in the next four phases.

### 5.7 Test the live endpoint

```bash
curl "$API_URL/health"
# Expected: {"status":"ok"}

curl "$API_URL/api/health"
# Expected: {"status":"healthy","services":{"api":"healthy","database":"healthy or disconnected"}}
```

---

## 9. Phase 6 — Update Google OAuth

This is the step everyone forgets, causing OAuth redirect errors.

### 6.1 Update Lambda REDIRECT_URI

```bash
API_URL="https://YOUR_API_GW_ID.execute-api.us-east-1.amazonaws.com"

aws lambda update-function-configuration \
  --function-name narralytics-backend \
  --region us-east-1 \
  --environment "Variables={
    GOOGLE_CLIENT_ID=your-client-id,
    GOOGLE_CLIENT_SECRET=your-client-secret,
    REDIRECT_URI=${API_URL}/auth/callback,
    FRONTEND_URL=https://your-narralytics.vercel.app,
    JWT_SECRET=your-jwt-secret,
    JWT_ALGORITHM=HS256,
    JWT_EXPIRE_HOURS=24,
    MONGODB_URI=your-mongodb-uri,
    MONGODB_DB=narralytics,
    GEMINI_API_KEY=your-gemini-key,
    UPLOAD_DIR=/tmp/uploads,
    AWS_DEFAULT_REGION=us-east-1,
    AWS_BUCKET=narralytics-uploads-prod,
    DYNAMODB_TABLE=narralytics_history
  }"
```

### 6.2 Update Google Cloud Console

1. Go to [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your **OAuth 2.0 Client ID** (the one used for Narralytics)
3. Under **Authorized redirect URIs**, click **+ ADD URI**
4. Add: `https://YOUR_API_GW_ID.execute-api.us-east-1.amazonaws.com/auth/callback`
5. **Keep** `http://localhost:8000/auth/callback` for local development
6. Click **Save**

> ⚠️ **The URI must match EXACTLY.** No trailing slash, correct protocol (https), exact path.
> Google's OAuth will reject any mismatch with a `redirect_uri_mismatch` error.

### 6.3 Test OAuth flow

```bash
# Open this URL in a browser:
echo "${API_URL}/auth/google"
# Should redirect to Google sign-in page
```

---

## 10. Phase 7 — S3 for File Uploads

Your `backend/storage/s3.py` already exists and is complete. You just need to create the bucket and swap the import in `routers/datasets.py`.

### 7.1 Create the S3 bucket

```bash
BUCKET_NAME="narralytics-uploads-prod"

# Create bucket
aws s3 mb "s3://${BUCKET_NAME}" --region us-east-1

# Block all public access (datasets are private per user)
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enable versioning (good practice for production)
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled

# Set lifecycle rule to auto-delete files after 30 days (cost management)
cat > /tmp/lifecycle-policy.json << 'EOF'
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
  --bucket "$BUCKET_NAME" \
  --lifecycle-configuration file:///tmp/lifecycle-policy.json

echo "✅ S3 bucket created: $BUCKET_NAME"
```

### 7.2 Swap the import in routers/datasets.py

Open `backend/routers/datasets.py` and find this line near the top:

```python
# CURRENT (line ~10 in your file):
from storage.local import save_upload, get_file_path
```

Change it to:

```python
# UPDATED for AWS:
from storage.s3 import save_upload, get_file_path
```

> **Do NOT delete `storage/local.py`.** Keep it for local development. You'll swap back
> when running locally. A cleaner approach is an environment variable check:

### 7.3 (Recommended) Environment-aware storage switcher

Replace the direct import in `routers/datasets.py` with a dynamic import:

```python
# backend/routers/datasets.py — replace the storage import with:
import os
if os.environ.get("AWS_BUCKET"):
    from storage.s3 import save_upload, get_file_path
else:
    from storage.local import save_upload, get_file_path
```

This way:
- **Locally** (no `AWS_BUCKET` set): uses local filesystem
- **On Lambda** (`AWS_BUCKET=narralytics-uploads-prod` set): uses S3

No more manual swapping.

### 7.4 Verify storage/s3.py is correct

Your existing `backend/storage/s3.py` should look like this. Confirm it matches:

```python
# backend/storage/s3.py — verify this matches your file
import os
import boto3
from config import settings

s3 = boto3.client("s3", region_name=settings.AWS_REGION)


def save_upload(file_bytes: bytes, filename: str, upload_dir: str | None = None) -> str:
    """Upload file to S3, return S3 key."""
    key = f"uploads/{filename}"
    if not settings.AWS_BUCKET:
        raise ValueError("AWS_BUCKET is not configured")
    s3.put_object(Bucket=settings.AWS_BUCKET, Key=key, Body=file_bytes)
    return key


def get_file_path(filename: str, upload_dir: str | None = None) -> str:
    """Download from S3 to Lambda /tmp, return local path."""
    if not settings.AWS_BUCKET:
        raise ValueError("AWS_BUCKET is not configured")
    local_path = os.path.join("/tmp", filename)
    if not os.path.exists(local_path):
        s3.download_file(settings.AWS_BUCKET, f"uploads/{filename}", local_path)
    return local_path
```

### 7.5 Critical: SQLite db_path must use /tmp/

In `routers/datasets.py`, find where `db_path` is set:

```python
# CURRENT — will fail on Lambda (no write access to relative paths)
db_path = os.path.join(settings.UPLOAD_DIR, f"{dataset_id}.db")
```

Change to:

```python
# FIXED — Lambda has write access to /tmp/
import tempfile
db_path = os.path.join("/tmp", f"{dataset_id}.db")
```

> Lambda containers have ~10 GB of space in `/tmp`. SQLite files for a single 50K row
> dataset are typically 3–8 MB. This is completely fine for hackathon scale.

---

## 11. Phase 8 — DynamoDB for History (Optional Swap)

Your current `backend/database/history.py` uses MongoDB. This works perfectly on Lambda.
Only switch to DynamoDB if you want the AWS-native approach or if MongoDB Atlas latency is an issue.

### Option A: Keep MongoDB (Recommended for hackathon — zero work)

Your current `history.py` already has non-fatal error handling:

```python
# In history.py — already handles failures gracefully
async def save_interaction(...) -> None:
    try:
        db = get_db()
        await db.conversation_history.insert_one({...})
    except Exception as exc:
        print(f"History save failed (non-fatal): {exc}")
```

This means if MongoDB is slow or unavailable, the API keeps working. Keep this as-is.

### Option B: Switch to DynamoDB (Optional — for the AWS architecture bonus)

If you want to use DynamoDB (which your IAM role already has permissions for), replace `backend/database/history.py` entirely:

```python
# backend/database/history.py — DynamoDB version
"""
DynamoDB-backed conversation history.
Drop-in replacement for MongoDB version.
Same function signatures — rest of codebase doesn't change.
"""
import os
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

_dynamodb = None
_table = None


def _get_table():
    global _dynamodb, _table
    if _table is not None:
        return _table
    _dynamodb = boto3.resource(
        "dynamodb",
        region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
    )
    _table = _dynamodb.Table(
        os.environ.get("DYNAMODB_TABLE", "narralytics_history")
    )
    return _table


async def save_interaction(
    user_id: str,
    interaction_type: str,
    payload: dict,
    dataset_id: str | None = None,
    session_id: str | None = None,
) -> None:
    try:
        table = _get_table()
        item = {
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": interaction_type,
            "dataset_id": dataset_id or payload.get("dataset_id", ""),
            "session_id": session_id or "",
            "payload": payload,
        }
        # DynamoDB doesn't support None values — remove empty fields
        item = {k: v for k, v in item.items() if v is not None and v != ""}
        table.put_item(Item=item)
    except ClientError as exc:
        print(f"DynamoDB write failed (non-fatal): {exc.response['Error']['Message']}")
    except Exception as exc:
        print(f"History save failed (non-fatal): {exc}")


async def get_history(
    user_id: str,
    dataset_id: str | None = None,
    limit: int = 50,
) -> list[dict]:
    try:
        from boto3.dynamodb.conditions import Key, Attr
        table = _get_table()
        kwargs = {
            "KeyConditionExpression": Key("user_id").eq(user_id),
            "ScanIndexForward": False,  # Most recent first
            "Limit": limit,
        }
        if dataset_id:
            kwargs["FilterExpression"] = Attr("dataset_id").eq(dataset_id)
        response = table.query(**kwargs)
        return response.get("Items", [])
    except Exception as exc:
        print(f"DynamoDB read failed (non-fatal): {exc}")
        return []
```

**If you switch to DynamoDB**, also update `backend/routers/chat.py` and `backend/routers/query.py` — they import from `database.history`. Since the function signatures are identical, only the import style might need updating (it shouldn't — Python resolves the module by path, not content).

### DynamoDB Table Schema (already created per your reference setup)

```
Table name:        narralytics_history
Partition key:     user_id  (String)
Sort key:          timestamp (String)
Billing mode:      PAY_PER_REQUEST  (free at hackathon scale)
```

If the table doesn't exist yet:

```bash
aws dynamodb create-table \
  --table-name narralytics_history \
  --attribute-definitions \
    AttributeName=user_id,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --key-schema \
    AttributeName=user_id,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

echo "✅ DynamoDB table created"
```

---

## 12. Phase 9 — Frontend → Vercel Update

### 9.1 Create production environment file

```bash
# In your repo root:
cat > frontend/.env.production << EOF
VITE_API_URL=https://YOUR_API_GW_ID.execute-api.us-east-1.amazonaws.com
EOF

# Make sure .gitignore does NOT ignore this file
# (it's safe — it contains no secrets, just the API URL)
grep ".env.production" frontend/.gitignore
# If it appears, remove that line from .gitignore
```

### 9.2 Update src/config/api.js if needed

Your `frontend/src/config/api.js` should already handle this correctly:

```javascript
// frontend/src/config/api.js — already correct in your repo
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  HEALTH: `${API_BASE_URL}/api/health`,
  AUTH:   `${API_BASE_URL}/auth`,
  // ...
};
```

No changes needed here.

### 9.3 Deploy to Vercel

**Option A — Via Vercel CLI:**

```bash
cd frontend
npm run build

# First time setup:
npx vercel --prod

# Set environment variable in Vercel:
npx vercel env add VITE_API_URL production
# Enter: https://YOUR_API_GW_ID.execute-api.us-east-1.amazonaws.com
```

**Option B — Via Vercel Dashboard (easier):**

1. Push your latest changes to GitHub
2. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
3. Select your Narralytics project → **Settings** → **Environment Variables**
4. Add: `VITE_API_URL` = `https://YOUR_API_GW_ID.execute-api.us-east-1.amazonaws.com`
5. Redeploy from the **Deployments** tab

### 9.4 Get your Vercel URL

After deployment, your Vercel URL will be something like:
`https://narralytics-suvam-paul145.vercel.app`

Save this — you'll use it in the next phase.

---

## 13. Phase 10 — CORS + Environment Variables Final Pass

### 10.1 Update Lambda FRONTEND_URL and CORS

Now that you have your actual Vercel URL:

```bash
VERCEL_URL="https://narralytics-YOUR-HASH.vercel.app"
API_GW_URL="https://YOUR_API_GW_ID.execute-api.us-east-1.amazonaws.com"

aws lambda update-function-configuration \
  --function-name narralytics-backend \
  --region us-east-1 \
  --environment "Variables={
    GOOGLE_CLIENT_ID=your-client-id,
    GOOGLE_CLIENT_SECRET=your-client-secret,
    REDIRECT_URI=${API_GW_URL}/auth/callback,
    FRONTEND_URL=${VERCEL_URL},
    FRONTEND_ORIGINS=${VERCEL_URL},
    JWT_SECRET=your-jwt-secret,
    JWT_ALGORITHM=HS256,
    JWT_EXPIRE_HOURS=24,
    MONGODB_URI=your-mongodb-atlas-uri,
    MONGODB_DB=narralytics,
    GEMINI_API_KEY=your-gemini-api-key,
    UPLOAD_DIR=/tmp/uploads,
    AWS_DEFAULT_REGION=us-east-1,
    AWS_BUCKET=narralytics-uploads-prod,
    DYNAMODB_TABLE=narralytics_history
  }"
```

### 10.2 Verify CORS configuration in main.py

Your `backend/main.py` already has this logic:

```python
# backend/main.py — already handles FRONTEND_ORIGINS
import os

_origins = [settings.FRONTEND_URL]
_extra = os.getenv("FRONTEND_ORIGINS", "")
if _extra:
    _origins.extend([o.strip() for o in _extra.split(",") if o.strip()])
_origins = list(set(_origins))  # deduplicate

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Since you're using API Gateway's built-in CORS configuration (`--cors-configuration "AllowOrigins=*"`), this is double-covered. No changes needed.

### 10.3 Final Lambda environment variable verification

```bash
# Print all current Lambda env vars (redacted output)
aws lambda get-function-configuration \
  --function-name narralytics-backend \
  --region us-east-1 \
  --query 'Environment.Variables' \
  --output table
```

Verify every key in this list is present:

```
✅ GOOGLE_CLIENT_ID
✅ GOOGLE_CLIENT_SECRET
✅ REDIRECT_URI               → Must be: https://API_GW_URL/auth/callback
✅ FRONTEND_URL               → Must be: https://your-vercel-app.vercel.app
✅ FRONTEND_ORIGINS           → Same as FRONTEND_URL
✅ JWT_SECRET                 → 32-byte hex string
✅ JWT_ALGORITHM              → HS256
✅ JWT_EXPIRE_HOURS           → 24
✅ MONGODB_URI                → mongodb+srv://...
✅ MONGODB_DB                 → narralytics
✅ GEMINI_API_KEY             → AIza...
✅ UPLOAD_DIR                 → /tmp/uploads
✅ AWS_DEFAULT_REGION         → us-east-1
✅ AWS_BUCKET                 → narralytics-uploads-prod
✅ DYNAMODB_TABLE             → narralytics_history
```

---

## 14. Phase 11 — Deploy and Smoke Test

### 11.1 Rebuild and update Lambda code after code changes

After making the `routers/datasets.py` changes (S3 swap + db_path fix):

```bash
cd backend

# Rebuild the package
rm -rf lambda_package narralytics_lambda.zip
mkdir lambda_package

pip install -r requirements.txt \
  --target ./lambda_package \
  --upgrade \
  --platform manylinux2014_x86_64 \
  --implementation cp \
  --python-version 3.11 \
  --only-binary=:all: \
  --no-deps 2>/dev/null || \
pip install -r requirements.txt --target ./lambda_package --upgrade

cp main.py config.py ./lambda_package/
cp -r auth database llm models pdf routers sqlite storage ./lambda_package/

find ./lambda_package -name "*.pyc" -delete
find ./lambda_package -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

cd lambda_package
zip -r ../narralytics_lambda.zip . -x "*.pyc"
cd ..

# Upload to S3 and update Lambda
aws s3 cp narralytics_lambda.zip s3://narralytics-deploy-artifacts/
aws lambda update-function-code \
  --function-name narralytics-backend \
  --s3-bucket narralytics-deploy-artifacts \
  --s3-key narralytics_lambda.zip \
  --region us-east-1

echo "✅ Lambda updated"
```

### 11.2 Warm up the Lambda

```bash
API_GW_URL="https://YOUR_API_GW_ID.execute-api.us-east-1.amazonaws.com"

# Hit health check 3 times to warm up the container
for i in 1 2 3; do
  echo "Warmup $i:"
  curl -s "$API_GW_URL/health"
  echo ""
  sleep 2
done
```

### 11.3 Full smoke test sequence

Run all of these. Every one must return the expected response.

```bash
# Test 1: Basic health
echo "=== TEST 1: Basic Health ==="
curl -s "$API_GW_URL/health"
# Expected: {"status":"ok"}

# Test 2: API health with MongoDB check
echo ""
echo "=== TEST 2: API Health ==="
curl -s "$API_GW_URL/api/health" | python3 -m json.tool
# Expected: status "healthy" or "degraded" (not "unhealthy")

# Test 3: OpenAPI docs are accessible
echo ""
echo "=== TEST 3: API Docs ==="
curl -s -o /dev/null -w "HTTP Status: %{http_code}" "$API_GW_URL/docs"
# Expected: HTTP Status: 200

# Test 4: OAuth redirect
echo ""
echo "=== TEST 4: OAuth Redirect ==="
curl -s -o /dev/null -w "HTTP Status: %{http_code}\nRedirect: %{redirect_url}" \
  "$API_GW_URL/auth/google"
# Expected: HTTP Status: 307, Redirect: https://accounts.google.com/...

# Test 5: Protected route without token returns 401
echo ""
echo "=== TEST 5: Auth Required ==="
curl -s -o /dev/null -w "HTTP Status: %{http_code}" \
  "$API_GW_URL/datasets/"
# Expected: HTTP Status: 401 or 403

echo ""
echo "=== All smoke tests complete ==="
```

### 11.4 Monitor CloudWatch logs

```bash
# Tail Lambda logs in real time during testing
aws logs tail /aws/lambda/narralytics-backend \
  --follow \
  --region us-east-1 \
  --format short
```

---

## 15. Troubleshooting Reference

| Error | Cause | Fix |
|---|---|---|
| `Task timed out after 30.00 seconds` | Default timeout too low | Set Lambda timeout to 60s |
| `No module named 'main'` | Handler path wrong | Ensure handler is `main.handler`, not `backend.main.handler` |
| `No module named 'google'` | google-genai not in package | Re-run pip install into lambda_package |
| `Unable to import module 'mangum'` | Mangum not in package | Add `mangum` to requirements.txt, rebuild zip |
| `redirect_uri_mismatch` (OAuth) | URI mismatch | Add exact URI to Google Console, update Lambda env var |
| `CORS error` in browser | CORS not allowing Vercel origin | Set `FRONTEND_URL` to exact Vercel URL |
| MongoDB `ServerSelectionTimeoutError` | 30s default too long for Lambda cold start | Add `?serverSelectionTimeoutMS=5000` to MONGODB_URI |
| `Access Denied` for S3 | IAM role missing S3 permission | Verify IAM policy includes S3 actions for your bucket |
| `Access Denied` for DynamoDB | IAM role missing DynamoDB permission | Verify IAM policy includes DynamoDB actions |
| `413 Request Entity Too Large` | File upload too large for API GW | API GW has 10 MB request limit — warn users |
| `502 Bad Gateway` | Lambda crashed (unhandled exception) | Check CloudWatch logs for Python traceback |
| `Cold start: 8-12s` | Pandas + google-genai slow to import | Hit `/health` 2x before demo to warm up |
| `[Errno 30] Read-only file system` | Trying to write outside `/tmp/` | Ensure `UPLOAD_DIR=/tmp/uploads` in Lambda env vars |

---

## 16. Full Environment Variable Reference

### Lambda (Production)

```bash
# Copy-paste template for aws lambda update-function-configuration
# Replace every value in <angle brackets>

GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
REDIRECT_URI=https://<API_GW_ID>.execute-api.us-east-1.amazonaws.com/auth/callback
FRONTEND_URL=https://<your-app>.vercel.app
FRONTEND_ORIGINS=https://<your-app>.vercel.app
JWT_SECRET=<run: python -c "import secrets; print(secrets.token_hex(32))">
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=24
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/?serverSelectionTimeoutMS=5000
MONGODB_DB=narralytics
GEMINI_API_KEY=<from aistudio.google.com>
UPLOAD_DIR=/tmp/uploads
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=narralytics-uploads-prod
DYNAMODB_TABLE=narralytics_history
```

### Frontend .env.production (Vercel)

```bash
VITE_API_URL=https://<API_GW_ID>.execute-api.us-east-1.amazonaws.com
```

### Local Development .env

```bash
GOOGLE_CLIENT_ID=<same credentials>
GOOGLE_CLIENT_SECRET=<same credentials>
REDIRECT_URI=http://localhost:8000/auth/callback
FRONTEND_URL=http://localhost:5173
JWT_SECRET=<same secret>
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=24
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/
MONGODB_DB=narralytics
GEMINI_API_KEY=<same key>
UPLOAD_DIR=./uploads
# AWS_BUCKET is intentionally NOT set locally → uses local storage
# DYNAMODB_TABLE is intentionally NOT set locally → uses MongoDB
```

---

## 17. Post-Deploy Demo Checklist

Run through this in order before any demo or submission.

```
INFRASTRUCTURE
□ curl $API_GW_URL/health returns {"status":"ok"}
□ curl $API_GW_URL/api/health shows database: "healthy"
□ $API_GW_URL/docs loads the Swagger UI
□ Lambda timeout is 60s (not default 30s)
□ Lambda memory is 512 MB

AUTHENTICATION  
□ $API_GW_URL/auth/google redirects to Google sign-in
□ Google OAuth completes and redirects to frontend with #token=
□ /auth/me returns user profile with valid JWT

FRONTEND
□ Vercel app loads at your .vercel.app URL
□ Login page shows and Google OAuth button works
□ Dashboard loads after login
□ HealthStatus indicator shows green in top-right corner

DATASET UPLOAD
□ CSV upload via drag-drop succeeds
□ Dataset appears in sidebar after upload
□ Schema detection returns correct column types

AUTO DASHBOARD
□ Auto-generate endpoint creates 6-10 charts
□ Charts render in the dashboard grid
□ "View Query" toggle shows SQL

CHAT + NLP
□ Text query returns a chart response
□ Cannot-answer query returns graceful error (not 500)
□ Chat history persists across page refresh (MongoDB or DynamoDB)

PERFORMANCE (before demo)
□ Hit /health twice to warm the Lambda container
□ First real query takes < 8s (cold start expected)
□ Subsequent queries take < 4s (warm container)
□ PDF export generates and downloads

HACKATHON SCORING EXTRAS
□ Architecture diagram matches actual deployed stack
□ Can demonstrate DynamoDB table has history items
□ Can show CloudWatch logs with successful invocations
□ Can show S3 bucket with uploaded CSV files
```

---

## Architecture Diagram — Final Deployed State

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│           Narralytics (https://your-app.vercel.app)              │
│   React 19 + Vite · Recharts · Lucide · React Router DOM         │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTPS + Bearer JWT
                           │ POST /query, /chat, /datasets/upload
                           │ GET /auth/google, /history
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│           AWS API Gateway (HTTP API)                             │
│   https://abc123.execute-api.us-east-1.amazonaws.com            │
│   Route: $default → Lambda (catch-all proxy)                     │
│   CORS: allow_origins=*, auto-deploy ON                          │
└──────────────────────────┬───────────────────────────────────────┘
                           │ Lambda Proxy Integration
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│           AWS Lambda — narralytics-backend                       │
│   Python 3.11 · 512 MB · 60s timeout · us-east-1                │
│   ┌────────────────────────────────────────────────────────┐     │
│   │  FastAPI + Mangum (ASGI bridge)                        │     │
│   │  /auth/*    → Google OAuth 2.0 + JWT issuance         │     │
│   │  /datasets/* → CSV upload → SQLite in /tmp/           │     │
│   │  /dashboard/auto → LLM → 6-10 chart specs + SQL exec  │     │
│   │  /query      → NL → chart spec(s) + SQL execution     │     │
│   │  /chat       → NL → analyst narrative + forecast       │     │
│   │  /report     → Chart selection → PDF via ReportLab     │     │
│   │  /history    → Read conversation history               │     │
│   └────────────────────────────────────────────────────────┘     │
└────────┬──────────────────┬────────────────┬─────────────────────┘
         │                  │                │
         ▼                  ▼                ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────────────────┐
│ Google Gemini   │ │ MongoDB Atlas│ │ AWS S3                   │
│ 2.5 Flash       │ │ (Cloud DB)   │ │ narralytics-uploads-prod │
│ LLM for:        │ │ Collections: │ │ Uploaded CSVs + Excel    │
│ - Chart specs   │ │ - users      │ │ files from users         │
│ - Chat answers  │ │ - datasets   │ │                          │
│ - Report summary│ │ - history    │ │ Lifecycle: 30-day delete │
└─────────────────┘ └──────────────┘ └──────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ AWS DynamoDB (Optional) │
│ narralytics_history     │
│ PK: user_id             │
│ SK: timestamp (ISO)     │
│ Replaces MongoDB history│
│ Cost: $0 at hackathon   │
└─────────────────────────┘
```

---

*Narralytics · github.com/Suvam-paul145/Narralytics*  
*AWS Lambda + API Gateway + S3 + DynamoDB · Google Gemini 2.5 Flash · MongoDB Atlas*  
*Deployment Roadmap v3.0 · March 2026*
