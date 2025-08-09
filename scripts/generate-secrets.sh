#!/bin/bash

# Script to generate secure secrets for the application
# Usage: ./scripts/generate-secrets.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Function to generate secure secret
generate_secret() {
    local length=${1:-64}
    openssl rand -base64 "$length" | tr -d '\n='
}

# Function to generate hex secret
generate_hex_secret() {
    local length=${1:-32}
    openssl rand -hex "$length"
}

echo -e "${GREEN}🔐 AI Travel Agent - Secure Secrets Generator${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# Generate secrets
JWT_ACCESS_SECRET=$(generate_secret 64)
JWT_REFRESH_SECRET=$(generate_secret 64)
CSRF_SECRET=$(generate_secret 64)
COOKIE_SECRET=$(generate_secret 64)
SESSION_SECRET=$(generate_secret 64)
DB_PASSWORD=$(generate_secret 32)
REDIS_PASSWORD=$(generate_hex_secret 32)
API_KEY=$(generate_hex_secret 32)

# Display generated secrets
echo -e "${YELLOW}Generated Secrets (Copy these to your secret management system):${NC}"
echo ""
echo "# Security Tokens"
echo "JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo "CSRF_SECRET=$CSRF_SECRET"
echo "COOKIE_SECRET=$COOKIE_SECRET"
echo "SESSION_SECRET=$SESSION_SECRET"
echo ""
echo "# Database"
echo "DB_PASSWORD=$DB_PASSWORD"
echo ""
echo "# Redis"
echo "REDIS_PASSWORD=$REDIS_PASSWORD"
echo ""
echo "# API Keys (example)"
echo "INTERNAL_API_KEY=$API_KEY"
echo ""
echo -e "${RED}⚠️  IMPORTANT SECURITY NOTES:${NC}"
echo "1. Store these secrets in a secure secret management system (Vault, AWS Secrets Manager, etc.)"
echo "2. Never commit these values to Git"
echo "3. Use different secrets for each environment (dev, staging, production)"
echo "4. Rotate secrets regularly (at least every 90 days)"
echo "5. Keep a secure backup of production secrets"
echo ""

# Option to save to file (for initial setup only)
read -p "Save to .env.local file? (for development only) [y/N]: " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cat > .env.local <<EOF
# Generated on $(date)
# ⚠️  FOR DEVELOPMENT ONLY - DO NOT USE IN PRODUCTION

# Security
JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
JWT_ISSUER=ai-travel-agent
JWT_AUDIENCE=ai-travel-agent-api
CSRF_SECRET=$CSRF_SECRET
COOKIE_SECRET=$COOKIE_SECRET
SESSION_SECRET=$SESSION_SECRET

# Database
DATABASE_URL=postgresql://postgres:$DB_PASSWORD@localhost:5432/travel_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD

# Add your other secrets here
TELEGRAM_TOKEN=
OPENROUTER_API_KEY=
LEVELTRAVEL_API_KEY=
LEVEL_TRAVEL_PARTNER=
LEVEL_TRAVEL_MARKER=
LEVEL_TRAVEL_AFFILIATE_URL=

# App
APP_URL=http://localhost:5000
NODE_ENV=development
LOG_LEVEL=debug
EOF
    
    chmod 600 .env.local
    echo -e "${GREEN}✅ Saved to .env.local (with restricted permissions)${NC}"
    echo -e "${YELLOW}📝 Don't forget to fill in the remaining API keys!${NC}"
else
    echo -e "${YELLOW}Secrets not saved to file. Copy them manually.${NC}"
fi

echo ""
echo -e "${GREEN}✨ Done! Remember to keep your secrets safe!${NC}"