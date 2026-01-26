#!/bin/bash
set -e

# Load Rust/Cargo environment
source "$HOME/.cargo/env" 2>/dev/null || true

# Disable AWS CLI pager
export AWS_PAGER=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration - set these environment variables or create scripts/.env
AWS_PROFILE="${AWS_PROFILE:-people-scheduler}"
LAMBDA_FUNCTION="${LAMBDA_FUNCTION:-people-scheduler-api}"
S3_BUCKET="${S3_BUCKET:-}"
CLOUDFRONT_DISTRIBUTION="${CLOUDFRONT_DISTRIBUTION:-}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Load local config if exists (git-ignored)
if [ -f "$PROJECT_ROOT/scripts/.env" ]; then
    source "$PROJECT_ROOT/scripts/.env"
fi

# Validate required variables
if [ -z "$S3_BUCKET" ] || [ -z "$CLOUDFRONT_DISTRIBUTION" ]; then
    echo -e "${RED}Error: Missing required environment variables${NC}"
    echo "Set S3_BUCKET and CLOUDFRONT_DISTRIBUTION, or create scripts/.env with:"
    echo "  S3_BUCKET=your-bucket-name"
    echo "  CLOUDFRONT_DISTRIBUTION=your-distribution-id"
    exit 1
fi

echo -e "${YELLOW}=== People Scheduler Deploy ===${NC}"
echo "Project root: $PROJECT_ROOT"
echo "S3 Bucket: $S3_BUCKET"
echo "CloudFront: $CLOUDFRONT_DISTRIBUTION"

# Step 1: Build Lambda
echo -e "\n${YELLOW}[1/4] Building Lambda (ARM64)...${NC}"
cd "$PROJECT_ROOT/api"
cargo zigbuild --release --target aarch64-unknown-linux-gnu --bin lambda
echo -e "${GREEN}✓ Lambda built${NC}"

# Step 2: Package and deploy Lambda
echo -e "\n${YELLOW}[2/4] Deploying Lambda...${NC}"
cp target/aarch64-unknown-linux-gnu/release/lambda bootstrap
zip -j lambda.zip bootstrap
aws --profile "$AWS_PROFILE" lambda update-function-code \
    --function-name "$LAMBDA_FUNCTION" \
    --zip-file fileb://lambda.zip \
    --output text --query 'LastModified'
rm bootstrap lambda.zip
echo -e "${GREEN}✓ Lambda deployed${NC}"

# Step 3: Build and deploy frontend
echo -e "\n${YELLOW}[3/4] Building and deploying frontend...${NC}"
cd "$PROJECT_ROOT"
npm run build
aws --profile "$AWS_PROFILE" s3 sync dist/ "s3://$S3_BUCKET" --delete
echo -e "${GREEN}✓ Frontend deployed to S3${NC}"

# Step 4: Invalidate CloudFront cache
echo -e "\n${YELLOW}[4/4] Invalidating CloudFront cache...${NC}"
INVALIDATION_ID=$(aws --profile "$AWS_PROFILE" cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION" \
    --paths "/*" \
    --query 'Invalidation.Id' --output text)
echo -e "${GREEN}✓ CloudFront invalidation created: $INVALIDATION_ID${NC}"

echo -e "\n${GREEN}=== Deploy complete! ===${NC}"
