# ☁️ AWS Migration Guide

Complete guide to migrate your Narralytics backend from local FastAPI to AWS Lambda with zero code changes.

---

## 🎯 Migration Overview

Your backend is designed for seamless AWS migration:

- **FastAPI → AWS Lambda** (via Mangum adapter)
- **Local MongoDB → MongoDB Atlas** (already cloud-ready)
- **Local SQLite → Lambda /tmp** (same file paths work)
- **Local storage → S3** (simple module swap)
- **Environment variables → Lambda env vars** (copy-paste)

**Estimated Migration Time:** 4-6 hours

---

## 📋 Prerequisites

Before starting:
- [ ] AWS Account with billing enabled
- [ ] AWS CLI installed and configured
- [ ] Backend working locally (all tests pass)
- [ ] MongoDB Atlas cluster running
- [ ] Domain name (optional, for custom API endpoint)

---

## 🚀 Step 1: Prepare Lambda Package

### 1.1 Install Dependencies Locally
```bash
cd backend
pip install -r requirements.txt --target ./lambda_package --upgrade
```

### 1.2 Copy Application Code
```bash
# Copy all Python modules
cp -r auth database llm pdf routers sqlite storage models *.py ./lambda_package/

# Verify structure
ls lambda_package/
# Should show: auth/ database/ llm/ main.py config.py requirements.txt ...
```

### 1.3 Create Deployment Package
```bash
cd lambda_package
zip -r ../narralytics_lambda.zip . -x "*.pyc" "*__pycache__*"
cd ..

# Check package size (should be < 50MB)
ls -lh narralytics_lambda.zip
```

---

## 🔧 Step 2: Create AWS Resources

### 2.1 Create S3 Bucket for File Storage
```bash
# Replace 'your-unique-bucket-name' with actual name
aws s3 mb s3://narralytics-uploads-your-suffix
aws s3api put-bucket-versioning \
  --bucket narralytics-uploads-your-suffix \
  --versioning-configuration Status=Enabled
```

### 2.2 Create IAM Role for Lambda
Create `lambda-trust-policy.json`:
```json
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
```

Create `lambda-permissions.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::narralytics-uploads-your-suffix/*"
    }
  ]
}
```

Create IAM role:
```bash
aws iam create-role \
  --role-name narralytics-lambda-role \
  --assume-role-policy-document file://lambda-trust-policy.json

aws iam put-role-policy \
  --role-name narralytics-lambda-role \
  --policy-name narralytics-lambda-permissions \
  --policy-document file://lambda-permissions.json
```

---

## 🔄 Step 3: Update Code for AWS

### 3.1 Update Storage Module
Replace the import in `routers/datasets.py`:

```python
# Change this line:
# from storage.local import save_upload, get_file_path

# To this:
from storage.s3 import save_upload, get_file_path
```

### 3.2 Create S3 Storage Module
Create `storage/s3.py`:

```python
import boto3
import os
from config import settings

s3_client = boto3.client('s3', region_name=settings.AWS_REGION)

def save_upload(file_bytes: bytes, filename: str, upload_dir: str = None) -> str:
    """Upload file to S3, return S3 key."""
    key = f"uploads/{filename}"
    s3_client.put_object(
        Bucket=settings.AWS_BUCKET,
        Key=key,
        Body=file_bytes
    )
    return key

def get_file_path(filename: str, upload_dir: str = None) -> str:
    """Download from S3 to Lambda /tmp, return local path."""
    local_path = f"/tmp/{filename}"
    if not os.path.exists(local_path):
        s3_client.download_file(
            settings.AWS_BUCKET,
            f"uploads/{filename}",
            local_path
        )
    return local_path
```

### 3.3 Update Config for AWS
Add to `config.py`:

```python
class Settings(BaseSettings):
    # ... existing settings ...
    
    # AWS Settings
    AWS_REGION: str = "us-east-1"
    AWS_BUCKET: str = ""
    
    # Update paths for Lambda
    UPLOAD_DIR: str = "/tmp"  # Lambda ephemeral storage
```

### 3.4 Verify Mangum Handler
Ensure `main.py` has the handler:

```python
from mangum import Mangum

# ... your FastAPI app code ...

# This line enables Lambda compatibility
handler = Mangum(app)
```

---

## 🚀 Step 4: Deploy Lambda Function

### 4.1 Create Lambda Function
```bash
aws lambda create-function \
  --function-name narralytics-backend \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/narralytics-lambda-role \
  --handler main.handler \
  --zip-file fileb://narralytics_lambda.zip \
  --timeout 30 \
  --memory-size 512 \
  --environment Variables='{
    "GOOGLE_CLIENT_ID":"<YOUR_CLIENT_ID>",
    "GOOGLE_CLIENT_SECRET":"your-google-client-secret",
    "REDIRECT_URI":"https://your-api-gateway-url/auth/callback",
    "FRONTEND_URL":"https://your-frontend-url.vercel.app",
    "JWT_SECRET":"your-jwt-secret",
    "MONGODB_URI":"mongodb+srv://username:password@cluster.mongodb.net/",
    "MONGODB_DB":"narralytics",
    "GEMINI_API_KEY":"your-gemini-api-key",
    "AWS_REGION":"us-east-1",
    "AWS_BUCKET":"narralytics-uploads-your-suffix"
  }'
```

### 4.2 Test Lambda Function
```bash
aws lambda invoke \
  --function-name narralytics-backend \
  --payload '{"httpMethod":"GET","path":"/health","headers":{}}' \
  response.json

cat response.json
# Should show: {"statusCode": 200, "body": "{\"status\":\"ok\"}"}
```

---

## 🌐 Step 5: Set Up API Gateway

### 5.1 Create REST API
```bash
aws apigateway create-rest-api \
  --name narralytics-api \
  --description "Narralytics Backend API"

# Note the API ID from response
export API_ID=your-api-id
```

### 5.2 Create Proxy Resource
```bash
# Get root resource ID
aws apigateway get-resources --rest-api-id $API_ID

export ROOT_RESOURCE_ID=your-root-resource-id

# Create {proxy+} resource
aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_RESOURCE_ID \
  --path-part '{proxy+}'

export PROXY_RESOURCE_ID=your-proxy-resource-id
```

### 5.3 Create ANY Method
```bash
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $PROXY_RESOURCE_ID \
  --http-method ANY \
  --authorization-type NONE

# Set up Lambda integration
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $PROXY_RESOURCE_ID \
  --http-method ANY \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:narralytics-backend/invocations
```

### 5.4 Grant API Gateway Permission
```bash
aws lambda add-permission \
  --function-name narralytics-backend \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:YOUR_ACCOUNT_ID:$API_ID/*/*"
```

### 5.5 Deploy API
```bash
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod

# Your API URL will be:
echo "https://$API_ID.execute-api.us-east-1.amazonaws.com/prod"
```

---

## 🔧 Step 6: Update Environment Variables

### 6.1 Update Google OAuth Redirect URI
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" → "Credentials"
3. Edit your OAuth 2.0 Client ID
4. Update "Authorized redirect URIs":
   - Add: `https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/auth/callback`
   - Keep: `http://localhost:8000/auth/callback` (for local development)

### 6.2 Update Lambda Environment Variables
```bash
aws lambda update-function-configuration \
  --function-name narralytics-backend \
  --environment Variables='{
    "GOOGLE_CLIENT_ID":"<YOUR_CLIENT_ID>",
    "GOOGLE_CLIENT_SECRET":"your-google-client-secret",
    "REDIRECT_URI":"https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/auth/callback",
    "FRONTEND_URL":"https://your-frontend.vercel.app",
    "JWT_SECRET":"your-jwt-secret",
    "MONGODB_URI":"mongodb+srv://username:password@cluster.mongodb.net/",
    "MONGODB_DB":"narralytics",
    "GEMINI_API_KEY":"your-gemini-api-key",
    "AWS_REGION":"us-east-1",
    "AWS_BUCKET":"narralytics-uploads-your-suffix"
  }'
```

---

## ✅ Step 7: Test AWS Deployment

### 7.1 Health Check
```bash
curl https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/health
```
**Expected:** `{"status":"ok"}`

### 7.2 API Documentation
Open: `https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/docs`

### 7.3 OAuth Flow
1. Open: `https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/auth/google`
2. Complete Google sign-in
3. Should redirect to your frontend with JWT token

### 7.4 Upload Test
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@test_sales.csv" \
  https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/datasets/upload
```

---

## 🔄 Step 8: Update Frontend Configuration

Update your frontend's API base URL:

```javascript
// In frontend/.env.production
VITE_API_BASE_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod
```

---

## 📊 Step 9: Monitor and Optimize

### 9.1 CloudWatch Logs
```bash
# View Lambda logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/narralytics-backend

# Tail logs in real-time
aws logs tail /aws/lambda/narralytics-backend --follow
```

### 9.2 Performance Monitoring
- **Cold Start**: First request may take 3-5 seconds
- **Warm Requests**: Should be <1 second
- **Memory Usage**: Monitor in CloudWatch, adjust if needed
- **Timeout**: 30 seconds should handle PDF generation

### 9.3 Cost Optimization
- **Lambda**: Pay per request (very cost-effective)
- **API Gateway**: $3.50 per million requests
- **S3**: $0.023 per GB stored
- **MongoDB Atlas**: Free tier supports thousands of users

---

## 🚨 Troubleshooting

### Common Issues

**"Task timed out after 30.00 seconds"**
- Increase Lambda timeout: `aws lambda update-function-configuration --function-name narralytics-backend --timeout 60`

**"No module named 'pandas'"**
- Ensure dependencies installed in lambda_package: `pip install -r requirements.txt --target ./lambda_package`

**"Unable to import module 'main'"**
- Check handler is set to `main.handler`
- Verify main.py is in root of zip file

**"Access Denied" for S3**
- Check IAM role has S3 permissions
- Verify bucket name in environment variables

**MongoDB connection timeout**
- Ensure MongoDB Atlas allows connections from 0.0.0.0/0
- Check MONGODB_URI format

---

## 🔄 Deployment Updates

### Update Lambda Code
```bash
# After making changes
cd lambda_package
zip -r ../narralytics_lambda.zip . -x "*.pyc" "*__pycache__*"
cd ..

aws lambda update-function-code \
  --function-name narralytics-backend \
  --zip-file fileb://narralytics_lambda.zip
```

### Update Environment Variables
```bash
aws lambda update-function-configuration \
  --function-name narralytics-backend \
  --environment Variables='{"KEY":"value"}'
```

---

## 🎯 Production Checklist

### Security
- [ ] JWT secret is cryptographically secure
- [ ] MongoDB Atlas has IP whitelist configured
- [ ] S3 bucket has proper permissions
- [ ] API Gateway has rate limiting enabled
- [ ] CORS configured for production domain

### Performance
- [ ] Lambda memory optimized (512MB recommended)
- [ ] Lambda timeout set to 30+ seconds
- [ ] CloudWatch monitoring enabled
- [ ] Error alerting configured

### Reliability
- [ ] MongoDB Atlas has backups enabled
- [ ] S3 versioning enabled
- [ ] Lambda dead letter queue configured
- [ ] Health checks monitoring

### Cost Management
- [ ] Lambda provisioned concurrency not needed (pay-per-use)
- [ ] S3 lifecycle policies for old files
- [ ] CloudWatch log retention set (30 days)
- [ ] MongoDB Atlas on free/shared tier initially

---

## 📈 Scaling Considerations

### Traffic Growth
- **Lambda**: Auto-scales to 1000 concurrent executions
- **API Gateway**: Handles 10,000 requests/second
- **MongoDB Atlas**: Upgrade cluster as needed
- **S3**: Unlimited storage

### Geographic Distribution
- **CloudFront**: Add CDN for global performance
- **Multi-region**: Deploy Lambda in multiple regions
- **MongoDB**: Use Atlas global clusters

---

## 🎉 Success Metrics

Your AWS migration is successful when:
- ✅ All API endpoints respond correctly
- ✅ OAuth flow works with new redirect URI
- ✅ File uploads save to S3
- ✅ Database operations work with Atlas
- ✅ PDF generation completes within timeout
- ✅ Frontend connects to new API URL
- ✅ Costs are under $10/month for moderate usage

---

**🚀 Your Narralytics backend is now running on AWS Lambda!**

**API URL:** `https://your-api-id.execute-api.us-east-1.amazonaws.com/prod`
**Docs:** `https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/docs`