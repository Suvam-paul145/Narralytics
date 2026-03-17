#!/bin/bash
set -euo pipefail

export AWS_REGION=${AWS_REGION:-us-east-1}
export ENVIRONMENT=${ENVIRONMENT:-prod}

echo "🚀 NARRALYTICS AUTOMATED DEPLOYMENT"
echo "Region: ${AWS_REGION}"
echo "Environment: ${ENVIRONMENT}"
echo "Account: $(aws sts get-caller-identity --query Account --output text)"
echo "=========================================="

chmod +x phase3-infrastructure.sh phase4-application.sh phase5-production.sh

echo "Phase 3: Infrastructure Provisioning..."
./phase3-infrastructure.sh

echo "Waiting for resources to stabilize..."
sleep 30

echo "Phase 4: Application Deployment..."
./phase4-application.sh

echo "Waiting for deployment to complete..."
sleep 15

echo "Phase 5: Production Readiness..."
./phase5-production.sh

echo "=========================================="
echo "✅ DEPLOYMENT COMPLETE"
echo "API URL: $(aws apigatewayv2 get-apis --query "Items[?Name=='narralytics-api'].ApiEndpoint" --output text --region ${AWS_REGION})"
echo "Next steps:"
echo "1. Update Google OAuth redirect URI"
echo "2. Deploy frontend to Vercel with new API URL"
echo "3. Configure domain and SSL certificate"