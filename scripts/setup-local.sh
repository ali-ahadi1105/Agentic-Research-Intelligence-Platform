#!/bin/bash
# ============================================================
# Agentic Research Intelligence Platform - Local Setup Script
# برای اجرای پروژه بدون Docker
# ============================================================
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_step() { echo -e "${GREEN}✅ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

echo "=========================================="
echo "🚀 Research Platform - Local Setup"
echo "=========================================="
echo ""

# ============================================================
# 1. Install pgvector
# ============================================================
echo "📋 Step 1: Installing pgvector..."

# Install build dependencies
sudo apt-get update
sudo apt-get install -y postgresql-server-dev-16 build-essential git

# Clone, build, install pgvector
cd /tmp
if [ ! -d "pgvector" ]; then
    git clone --branch v0.7.4 https://github.com/pgvector/pgvector.git
fi
cd pgvector
make
sudo make install
print_step "pgvector installed"
cd ~

# ============================================================
# 2. Create database and user
# ============================================================
echo ""
echo "📋 Step 2: Setting up database..."

# Generate a random password
DB_PASSWORD=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 16)
DB_NAME="research_platform"
DB_USER="research_user"

# Create user and database
sudo -u postgres psql << EOF
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    ELSE
        ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
\c $DB_NAME
CREATE EXTENSION IF NOT EXISTS vector;
GRANT ALL ON SCHEMA public TO $DB_USER;
EOF
print_step "Database '$DB_NAME' created with pgvector extension"

# ============================================================
# 3. Generate JWT secret
# ============================================================
JWT_SECRET=$(openssl rand -base64 32)
echo ""
echo "📋 Step 3: JWT secret generated"

# ============================================================
# 4. Install dependencies
# ============================================================
echo ""
echo "📋 Step 4: Installing project dependencies..."
bun install
print_step "Dependencies installed"

# ============================================================
# 5. Create .env file
# ============================================================
echo ""
echo "📋 Step 5: Creating .env file..."

cat > .env << ENVEOF
# ============================================================
# DATABASE
# ============================================================
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public"

# ============================================================
# AUTHENTICATION
# ============================================================
JWT_SECRET="$JWT_SECRET"

# ============================================================
# LLM PROVIDER (OpenAI-Compatible - default)
# ============================================================
LLM_PROVIDER=openai-compatible
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# (اختیاری) Anthropic
# ANTHROPIC_API_KEY=
# ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# (اختیاری) Gemini
# GEMINI_API_KEY=
# GEMINI_MODEL=gemini-1.5-pro
ENVEOF
print_step ".env file created"

echo ""
print_warn "⚠️  IMPORTANT: Edit .env and set your OPENAI_API_KEY before running!"
echo "   nano .env"
echo ""

# ============================================================
# 6. Update Prisma schema for pgvector
# ============================================================
echo ""
echo "📋 Step 6: Updating Prisma schema for pgvector..."

# The schema already uses postgresql provider, just need to update vector dimension
sed -i 's/Unsupported("vector")/Unsupported("vector(1536)")/' prisma/schema.prisma
print_step "Prisma schema updated for pgvector"

# ============================================================
# 7. Generate Prisma client and push schema
# ============================================================
echo ""
echo "📋 Step 7: Running database migration..."
bun run db:generate
bun run db:push
print_step "Database schema applied"

# ============================================================
# 8. Seed database (optional)
# ============================================================
echo ""
echo "📋 Step 8: Seeding database with demo data..."
curl -s -X POST http://localhost:3000/api/v1/seed 2>/dev/null || print_warn "Seed skipped (app not running yet)"

# ============================================================
# Summary
# ============================================================
echo ""
echo "=========================================="
echo "🎉 Setup Complete!"
echo "=========================================="
echo ""
echo "📌 To run the application:"
echo "   bun run dev"
echo ""
echo "📌 Then open: http://localhost:3000"
echo ""
echo "📌 Login with demo account:"
echo "   Email:    demo@research.ai"
echo "   Password: demo1234"
echo ""
echo "📌 Database credentials (save this):"
echo "   User:     $DB_USER"
echo "   Password: $DB_PASSWORD"
echo "   Database: $DB_NAME"
echo "   URL:      postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public"
echo ""
echo "⚠️  Don't forget to:"
echo "   1. Edit .env and set your OPENAI_API_KEY"
echo "   2. Run: bun run dev"
echo ""
