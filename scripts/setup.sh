#!/bin/bash
# ============================================================
# Agentic Research Intelligence Platform - Setup Script
# این اسکریپت تمام پیش‌نیازها را نصب می‌کند
# ============================================================

set -e

echo "=========================================="
echo "🚀 Research Platform Setup"
echo "=========================================="
echo ""

# رنگ‌ها
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_step() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# بررسی root
if [ "$EUID" -eq 0 ]; then
    print_error "این اسکریپت را با sudo اجرا نکنید (اما کاربر باید sudo دسترسی داشته باشد)"
    exit 1
fi

# ============================================================
# Step 1: System update
# ============================================================
echo "📋 Step 1: Updating system..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential python3 software-properties-common
print_step "System updated"

# ============================================================
# Step 2: Node.js 20
# ============================================================
echo ""
echo "📋 Step 2: Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
print_step "Node.js $(node --version) installed"

# ============================================================
# Step 3: Bun
# ============================================================
echo ""
echo "📋 Step 3: Installing Bun..."
if ! command -v bun &> /dev/null; then
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    # Add to bashrc
    echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
    echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
fi
print_step "Bun $(bun --version) installed"

# ============================================================
# Step 4: PostgreSQL 15
# ============================================================
echo ""
echo "📋 Step 4: Installing PostgreSQL 15..."
if ! command -v psql &> /dev/null; then
    sudo sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
    sudo apt update
    sudo apt install -y postgresql-15 postgresql-contrib-15 postgresql-server-dev-15
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
fi
print_step "PostgreSQL installed"

# ============================================================
# Step 5: pgvector
# ============================================================
echo ""
echo "📋 Step 5: Installing pgvector..."
if [ ! -d /tmp/pgvector ]; then
    cd /tmp
    git clone --branch v0.7.4 https://github.com/pgvector/pgvector.git
    cd pgvector
    make
    sudo make install
fi
print_step "pgvector installed"

# ============================================================
# Step 6: Nginx
# ============================================================
echo ""
echo "📋 Step 6: Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
fi
print_step "Nginx installed"

# ============================================================
# Step 7: Create database
# ============================================================
echo ""
echo "📋 Step 7: Setting up database..."
read -p "Enter database password for 'research_user': " DB_PASSWORD
read -p "Enter database name (default: research_platform): " DB_NAME
DB_NAME=${DB_NAME:-research_platform}

sudo -u postgres psql << EOF
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'research_user') THEN
        CREATE USER research_user WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

SELECT 'CREATE DATABASE $DB_NAME OWNER research_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO research_user;
\c $DB_NAME
CREATE EXTENSION IF NOT EXISTS vector;
GRANT ALL ON SCHEMA public TO research_user;
EOF

print_step "Database '$DB_NAME' created with pgvector extension"

# ============================================================
# Step 8: Generate JWT secret
# ============================================================
echo ""
echo "📋 Step 8: Generating JWT secret..."
JWT_SECRET=$(openssl rand -base64 32)
print_step "JWT secret generated"

# ============================================================
# Step 9: Clone project (if not in project directory)
# ============================================================
PROJECT_DIR="/opt/research-platform"
echo ""
echo "📋 Step 9: Setting up project..."

if [ ! -f "package.json" ] && [ ! -d "$PROJECT_DIR" ]; then
    read -p "Enter your Git repository URL: " REPO_URL
    sudo mkdir -p $PROJECT_DIR
    sudo chown $USER:$USER $PROJECT_DIR
    cd $PROJECT_DIR
    git clone $REPO_URL .
fi

# If we're already in the project directory
if [ -f "package.json" ]; then
    PROJECT_DIR=$(pwd)
fi

cd $PROJECT_DIR

# Install dependencies
if [ -f "package.json" ]; then
    echo "Installing dependencies..."
    bun install
    print_step "Dependencies installed"
fi

# ============================================================
# Step 10: Create .env file
# ============================================================
echo ""
echo "📋 Step 10: Creating .env file..."

read -p "Enter your OpenAI API key (or press Enter to skip): " OPENAI_KEY
read -p "Enter OpenAI base URL (default: https://api.openai.com/v1): " OPENAI_BASE_URL
OPENAI_BASE_URL=${OPENAI_BASE_URL:-https://api.openai.com/v1}
read -p "Enter chat model (default: gpt-4o-mini): " CHAT_MODEL
CHAT_MODEL=${CHAT_MODEL:-gpt-4o-mini}
read -p "Enter embedding model (default: text-embedding-3-small): " EMBEDDING_MODEL
EMBEDDING_MODEL=${EMBEDDING_MODEL:-text-embedding-3-small}

# Get the local IP for DATABASE_URL
LOCAL_IP="localhost"

cat > $PROJECT_DIR/.env << EOF
# ============================================================
# DATABASE
# ============================================================
DATABASE_URL="postgresql://research_user:$DB_PASSWORD@$LOCAL_IP:5432/$DB_NAME?schema=public"

# ============================================================
# AUTHENTICATION
# ============================================================
JWT_SECRET="$JWT_SECRET"

# ============================================================
# LLM PROVIDER
# ============================================================
LLM_PROVIDER=openai-compatible

# OpenAI-Compatible
OPENAI_API_KEY=$OPENAI_KEY
OPENAI_BASE_URL=$OPENAI_BASE_URL
OPENAI_CHAT_MODEL=$CHAT_MODEL
OPENAI_EMBEDDING_MODEL=$EMBEDDING_MODEL

# (اختیاری) Anthropic
# ANTHROPIC_API_KEY=
# ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# (اختیاری) Gemini
# GEMINI_API_KEY=
# GEMINI_MODEL=gemini-1.5-pro
EOF

print_step ".env file created at $PROJECT_DIR/.env"

# ============================================================
# Step 11: Update Prisma schema for PostgreSQL
# ============================================================
echo ""
echo "📋 Step 11: Updating Prisma schema for PostgreSQL..."

SCHEMA_FILE="$PROJECT_DIR/prisma/schema.prisma"
if [ -f "$SCHEMA_FILE" ]; then
    # Change provider to postgresql
    sed -i 's/provider = "sqlite"/provider = "postgresql"/g' $SCHEMA_FILE

    # Note about pgvector - user needs to manually update the Chunk model
    print_warn "Update the Chunk model in prisma/schema.prisma:"
    echo "  Change:  embedding String?"
    echo "  To:      embedding Unsupported(\"vector(1536)\")"
    echo ""
    read -p "Press Enter after updating the schema..."
fi

# ============================================================
# Step 12: Database migration
# ============================================================
echo ""
echo "📋 Step 12: Running database migration..."
cd $PROJECT_DIR
bun run db:generate
bun run db:push
print_step "Database schema applied"

# ============================================================
# Step 13: Build
# ============================================================
echo ""
echo "📋 Step 13: Building application..."
bun run build
print_step "Application built"

# ============================================================
# Step 14: Create systemd service
# ============================================================
echo ""
echo "📋 Step 14: Creating systemd service..."

BUN_PATH=$(which bun)

cat > /tmp/research-platform.service << EOF
[Unit]
Description=Agentic Research Intelligence Platform
After=network.target postgresql.service

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$PROJECT_DIR
EnvironmentFile=$PROJECT_DIR/.env
ExecStart=$BUN_PATH run start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=research-platform

[Install]
WantedBy=multi-user.target
EOF

sudo mv /tmp/research-platform.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable research-platform
print_step "Systemd service created"

# ============================================================
# Step 15: Start service
# ============================================================
echo ""
echo "📋 Step 15: Starting service..."
sudo systemctl start research-platform
sleep 3

if sudo systemctl is-active --quiet research-platform; then
    print_step "Service is running!"
else
    print_error "Service failed to start. Check logs:"
    sudo journalctl -u research-platform -n 20
fi

# ============================================================
# Step 16: Nginx config
# ============================================================
echo ""
echo "📋 Step 16: Nginx configuration..."

read -p "Enter your domain name (or press Enter for localhost): " DOMAIN
DOMAIN=${DOMAIN:-localhost}

cat > /tmp/research-platform.nginx << EOF
server {
    listen 80;
    server_name $DOMAIN;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo mv /tmp/research-platform.nginx /etc/nginx/sites-available/research-platform
sudo ln -sf /etc/nginx/sites-available/research-platform /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
print_step "Nginx configured"

# ============================================================
# Step 17: Firewall
# ============================================================
echo ""
echo "📋 Step 17: Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
yes | sudo ufw enable 2>/dev/null || true
print_step "Firewall configured"

# ============================================================
# Step 18: SSL (if domain provided)
# ============================================================
if [ "$DOMAIN" != "localhost" ]; then
    echo ""
    echo "📋 Step 18: Setting up SSL..."
    sudo apt install -y certbot python3-certbot-nginx
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN || print_warn "SSL setup failed - run manually: sudo certbot --nginx -d $DOMAIN"
    print_step "SSL configured"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo "=========================================="
echo "🎉 Setup Complete!"
echo "=========================================="
echo ""
echo "📌 Your platform is running at: http://$DOMAIN"
echo ""
echo "📋 Quick commands:"
echo "   Start:    sudo systemctl start research-platform"
echo "   Stop:     sudo systemctl stop research-platform"
echo "   Restart:  sudo systemctl restart research-platform"
echo "   Status:   sudo systemctl status research-platform"
echo "   Logs:     sudo journalctl -u research-platform -f"
echo ""
echo "📋 Configuration files:"
echo "   .env:              $PROJECT_DIR/.env"
echo "   Nginx:             /etc/nginx/sites-available/research-platform"
echo "   Systemd:           /etc/systemd/system/research-platform.service"
echo ""
echo "📋 Database:"
echo "   Connect: psql -h localhost -U research_user -d $DB_NAME"
echo "   Password: $DB_PASSWORD"
echo ""
echo "⚠️  Important:"
echo "   1. Change the database password to something stronger"
echo "   2. Update JWT_SECRET in .env if needed"
echo "   3. Set up backup: see DEPLOYMENT-GUIDE.md"
echo ""
echo "📚 Full guide: $PROJECT_DIR/download/DEPLOYMENT-GUIDE.md"
echo ""
