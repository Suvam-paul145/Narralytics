#!/bin/bash
set -euo pipefail

# Narralytics Complete Deployment Script
# This script runs all deployment phases and configurations

export AWS_REGION=${AWS_REGION:-us-east-1}
export ENVIRONMENT=${ENVIRONMENT:-prod}
PROJECT_NAME="narralytics"

echo "🚀 NARRALYTICS COMPLETE DEPLOYMENT"
echo "=================================="
echo "Region: ${AWS_REGION}"
echo "Environment: ${ENVIRONMENT}"
echo "Account: $(aws sts get-caller-identity --query Account --output text)"
echo "Time: $(date)"
echo "=================================="

# Function to check if command succeeded
check_status() {
    if [ $? -eq 0 ]; then
        echo "✅ $1 completed successfully"
    else
        echo "❌ $1 failed"
        exit 1
    fi
}

# Make all scripts executable
echo "📋 Making scripts executable..."
chmod +x phase3-infrastructure.sh phase4-application.sh phase5-production.sh
chmod +x scripts/*.sh 2>/dev/null || true
check_status "Script permissions"

# Phase 1: Infrastructure Setup
echo ""
echo "🏗️  PHASE 1: Infrastructure Setup"
echo "================================"
./phase3-infrastructure.sh
check_status "Infrastructure setup"

# Wait for resources to stabilize
echo "⏳ Waiting for AWS resources to stabilize..."
sleep 30

# Phase 2: Application Deployment
echo ""
echo "🚀 PHASE 2: Application Deployment"
echo "=================================="
./phase4-application.sh
check_status "Application deployment"

# Wait for deployment to complete
echo "⏳ Waiting for deployment to complete..."
sleep 15

# Phase 3: Production Configuration
echo ""
echo "🔧 PHASE 3: Production Configuration"
echo "===================================="
./phase5-production.sh
check_status "Production configuration"
# Phase 4: Testing
echo ""
echo "🧪 PHASE 4: Testing Deployment"
echo "=============================="
./scripts/test-deployment.sh
check_status "Deployment testing"

# Phase 5: Monitoring Setup
echo ""
echo "📊 PHASE 5: Monitoring Setup"
echo "============================"
./scripts/setup-monitoring.sh
check_status "Monitoring setup"

# Phase 6: Security Configuration
echo ""
echo "🔐 PHASE 6: Security Configuration"
echo "=================================="
./scripts/update-secrets.sh
check_status "Security configuration"

# Get final deployment information
API_URL=$(aws apigatewayv2 get-apis --query "Items[?Name=='${PROJECT_NAME}-api'].ApiEndpoint" --output text --region ${AWS_REGION})
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "======================"
echo "✅ Infrastructure: S3, DynamoDB, IAM"
echo "✅ Application: Lambda, API Gateway"
echo "✅ Production: Monitoring, Logging, Alarms"
echo "✅ Testing: All endpoints validated"
echo "✅ Monitoring: CloudWatch dashboards and alerts"
echo "✅ Security: Secrets stored in AWS Secrets Manager"
echo ""
echo "📋 DEPLOYMENT SUMMARY"
echo "===================="
echo "API Gateway URL: ${API_URL}"
echo "Health Check: ${API_URL}/health"
echo "API Documentation: ${API_URL}/docs"
echo "OAuth Callback: ${API_URL}/auth/callback"
echo ""
echo "🔗 AWS Console Links:"
echo "Lambda: https://${AWS_REGION}.console.aws.amazon.com/lambda/home?region=${AWS_REGION}#/functions/${PROJECT_NAME}-backend"
echo "API Gateway: https://${AWS_REGION}.console.aws.amazon.com/apigateway/main/apis"
echo "CloudWatch: https://${AWS_REGION}.console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#dashboards:name=${PROJECT_NAME}-comprehensive"
echo "DynamoDB: https://${AWS_REGION}.console.aws.amazon.com/dynamodbv2/home?region=${AWS_REGION}#table?name=${PROJECT_NAME}_history"
echo "S3: https://s3.console.aws.amazon.com/s3/buckets/${PROJECT_NAME}-uploads-${ENVIRONMENT}"
echo ""
echo "⚠️  MANUAL STEPS REQUIRED:"
echo "========================="
echo "1. Update Google OAuth Console:"
echo "   - Go to: https://console.cloud.google.com/apis/credentials"
echo "   - Add redirect URI: ${API_URL}/auth/callback"
echo ""
echo "2. Update Frontend (Vercel):"
echo "   - Set VITE_API_URL=${API_URL}"
echo ""
echo "3. Configure Email Alerts (Optional):"
echo "   - Subscribe to SNS topic for monitoring alerts"
echo ""
echo "💰 Estimated Monthly Cost: $12-43"
echo "📊 Monitor usage in AWS Cost Explorer"
echo ""
echo "🆘 If issues occur, run: ./scripts/rollback.sh"
echo ""
echo "Deployment completed at: $(date)"