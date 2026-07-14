# 🚀 Agentic Research Intelligence Platform — Production Deployment Guide

راهنمای کامل راه‌اندازی سرویس در production با تمام پیش‌نیازها

---

## فهرست

1. [معماری سیستم](#۱-معماری-سیستم)
2. [پیش‌نیازها](#۲-پیش‌نیازها)
3. [راه‌اندازی دیتابیس PostgreSQL + pgvector](#۳-راه‌اندازی-دیتابیس)
4. [پیکربندی مدل AI](#۴-پیکربندی-مدل-ai)
5. [نصب و راه‌اندازی سرویس](#۵-نصب-و-راه‌اندازی)
6. [Docker Deployment](#۶-docker-deployment)
7. [پیکربندی Nginx Reverse Proxy](#۷-nginx-reverse-proxy)
8. [SSL/HTTPS](#۸-sslhttps)
9. [Systemd Service](#۹-systemd-service)
10. [پایش و مانیتورینگ](#۱۰-پایش-و-مانیتورینگ)
11. [Backup و Restore](#۱۱-backup-و-restore)
12. [عیب‌یابی](#۱۲-عیب‌یابی)

---

## ۱. معماری سیستم

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Nginx     │ ← SSL termination, rate limiting
                    │   (Port 80/443) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Next.js    │ ← Application server (Port 3000)
                    │  App        │
                    └──┬───┬───┬──┘
                       │   │   │
          ┌────────────┘   │   └────────────┐
          │                │                │
   ┌──────▼──────┐  ┌─────▼─────┐  ┌──────▼──────┐
   │ PostgreSQL  │  │ LLM API  │  │ File Storage│
   │ + pgvector  │  │ (OpenAI/ │  │ (Local/S3)  │
   │             │  │  Anthropic│  │             │
   └─────────────┘  │  /Gemini) │  └─────────────┘
                    └───────────┘
```

### اجزا

| جزء | نسخه پیشنهادی | منظور |
|------|---------------|-------|
| Node.js | 20+ | Runtime |
| PostgreSQL | 15+ | دیتابیس اصلی |
| pgvector | 0.5+ | Vector similarity search |
| Next.js | 16+ | Application framework |
| Nginx | 1.24+ | Reverse proxy |
| Redis (اختیاری) | 7+ | Cache (برای مقیاس زیاد) |

---

## ۲. پیش‌نیازها

### ۲.۱. سیستم‌عامل

این راهنما برای **Ubuntu 22.04/24.04 LTS** نوشته شده است. برای سایر سیستم‌عامل‌ها، دستورات مشابه هستند.

```bash
# بروزرسانی سیستم
sudo apt update && sudo apt upgrade -y

# نصب بسته‌های پایه
sudo apt install -y curl wget git build-essential python3

# نصب Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# نصب Bun (runtime سریع‌تر)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# نصب PM2 (مدیریت process)
sudo npm install -g pm2
```

### ۲.۲. سخت‌افزار پیشنهادی

| تعداد کاربر | RAM | CPU | Disk |
|-------------|-----|-----|------|
| ۱-۱۰ | 2GB | 1 core | 20GB |
| ۱۰-۱۰۰ | 4GB | 2 cores | 50GB |
| ۱۰۰-۱۰۰۰ | 8GB | 4 cores | 100GB+ |

---

## ۳. راه‌اندازی دیتابیس

### ۳.۱. نصب PostgreSQL 15

```bash
# اضافه‌کردن repository رسمی
sudo sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg

sudo apt update
sudo apt install -y postgresql-15 postgresql-contrib-15

# شروع سرویس
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### ۳.۲. نصب pgvector

```bash
# نصب پیش‌نیازها
sudo apt install -y postgresql-server-dev-15

# کامپایل و نصب pgvector
cd /tmp
git clone --branch v0.7.4 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# فعال‌سازی extension در دیتابیس
sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### ۳.۳. ایجاد دیتابیس و کاربر

```bash
sudo -u postgres psql << 'EOF'
-- ایجاد کاربر
CREATE USER research_user WITH PASSWORD 'YOUR_STRONG_PASSWORD_HERE';

-- ایجاد دیتابیس
CREATE DATABASE research_platform OWNER research_user;

-- اعطای دسترسی‌ها
GRANT ALL PRIVILEGES ON DATABASE research_platform TO research_user;

-- اتصال به دیتابیس و فعال‌سازی pgvector
\c research_platform
CREATE EXTENSION IF NOT EXISTS vector;
GRANT ALL ON SCHEMA public TO research_user;
EOF
```

### ۳.۴. تست اتصال

```bash
psql -h localhost -U research_user -d research_platform -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

خروجی باید نشان دهد که `vector` نصب است.

### ۳.۵. پیکربندی PostgreSQL

فایل `/etc/postgresql/15/main/postgresql.conf` را ویرایش کنید:

```conf
# تنظیمات حافظه (برای 4GB RAM)
shared_buffers = 1GB
effective_cache_size = 3GB
work_mem = 16MB
maintenance_work_mem = 256MB

# تنظیمات اتصال
max_connections = 100
listen_addresses = 'localhost'

# تنظیمات WAL
wal_buffers = 16MB
checkpoint_completion_target = 0.9
```

سپس restart:
```bash
sudo systemctl restart postgresql
```

---

## ۴. پیکربندی مدل AI

### ۴.۱. گزینه‌ها

شما ۴ گزینه دارید:

#### گزینه ۱: OpenAI (ساده‌ترین)

```env
LLM_PROVIDER=openai-compatible
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

#### گزینه ۲: سرور OpenAI-Compatible خودتان (vLLM، Ollama، LocalAI)

ابتدا سرور را راه‌اندازی کنید (مثال با vLLM):

```bash
# نصب vLLM
pip install vllm

# اجرای سرور با مدل دلخواه
vllm serve Qwen/Qwen2.5-7B-Instruct \
  --port 8000 \
  --host 0.0.0.0 \
  --api-key your-secret-key
```

سپس در `.env`:
```env
LLM_PROVIDER=openai-compatible
OPENAI_API_KEY=your-secret-key
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_CHAT_MODEL=Qwen/Qwen2.5-7B-Instruct
OPENAI_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
```

#### گزینه ۳: Anthropic Claude

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# برای embeddings (Claude embeddings ندارد)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

#### گزینه ۴: Google Gemini

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIzaXXXXXXXXXXXXX
GEMINI_MODEL=gemini-1.5-pro
GEMINI_EMBEDDING_MODEL=text-embedding-004
```

### ۴.۲. مقایسه هزینه‌ها (نکته: اعداد تقریبی هستند)

| Provider | Chat (per 1M tokens) | Embedding (per 1M tokens) |
|----------|---------------------|---------------------------|
| OpenAI gpt-4o-mini | $0.15 | $0.02 |
| OpenAI gpt-4o | $2.50 | $0.13 |
| Claude 3.5 Sonnet | $3.00 | N/A (use OpenAI) |
| Gemini 1.5 Pro | $1.25 | $0.00 (free tier) |
| vLLM (محلی) | $0 (سخت‌افزار) | $0 (سخت‌افزار) |

---

## ۵. نصب و راه‌اندازی

### ۵.۱. Clone پروژه

```bash
sudo mkdir -p /opt/research-platform
sudo chown $USER:$USER /opt/research-platform
cd /opt/research-platform

git clone <your-repo-url> .
```

### ۵.۲. نصب وابستگی‌ها

```bash
bun install
```

### ۵.۳. پیکربندی محیط

```bash
cp .env.example .env
nano .env
```

فایل `.env` را با مقادیر واقعی پر کنید:

```env
# ============================================================
# DATABASE
# ============================================================
DATABASE_URL="postgresql://research_user:YOUR_STRONG_PASSWORD@localhost:5432/research_platform?schema=public"

# ============================================================
# AUTHENTICATION
# ============================================================
JWT_SECRET="generate-a-random-32-char-string-here"

# ============================================================
# LLM PROVIDER
# ============================================================
LLM_PROVIDER=openai-compatible

# OpenAI-Compatible
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# (اختیاری) Anthropic
# ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
# ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# (اختیاری) Gemini
# GEMINI_API_KEY=AIzaXXXXXXXXXXXXX
# GEMINI_MODEL=gemini-1.5-pro
```

### ۵.۴. تولید JWT Secret

```bash
openssl rand -base64 32
```

خروجی را در `JWT_SECRET` قرار دهید.

### ۵.۵. Migration دیتابیس

ابتدا schema را برای PostgreSQL به‌روزرسانی کنید:

```bash
# در فایل prisma/schema.prisma:
# - provider را به postgresql تغییر دهید
# - فیلد embedding را به Unsupported("vector(1536)") تغییر دهید
```

سپس:

```bash
# تولید Prisma Client
bun run db:generate

# اعمال schema روی دیتابیس
bun run db:push

# (یا migration)
bun run db:migrate
```

### ۵.۶. Build اپلیکیشن

```bash
# Build برای production
bun run build
```

### ۵.۷. تست اجرا

```bash
# اجرا در حالت production
NODE_ENV=production bun run start
```

برای تست: `http://localhost:3000`

---

## ۶. Docker Deployment

### ۶.۱. Dockerfile

فایل `Dockerfile` در ریشه پروژه:

```dockerfile
FROM node:20-slim AS base

# نصب بسته‌های سیستم
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# نصب Bun
RUN npm install -g bun

# تنظیم دایرکتوری کاری
WORKDIR /app

# کپی فایل‌های وابستگی
COPY package.json bun.lockb ./

# نصب وابستگی‌ها
RUN bun install --frozen-lockfile

# کپی کد
COPY . .

# تولید Prisma Client
RUN bun run db:generate

# Build
RUN bun run build

# پورت
EXPOSE 3000

# اجرا
CMD ["bun", "run", "start"]
```

### ۶.۲. docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://research_user:password@db:5432/research_platform?schema=public
      - JWT_SECRET=${JWT_SECRET}
      - LLM_PROVIDER=${LLM_PROVIDER}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_BASE_URL=${OPENAI_BASE_URL}
      - OPENAI_CHAT_MODEL=${OPENAI_CHAT_MODEL}
      - OPENAI_EMBEDDING_MODEL=${OPENAI_EMBEDDING_MODEL}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: pgvector/pgvector:pg15
    environment:
      - POSTGRES_USER=research_user
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=research_platform
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U research_user -d research_platform"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
```

### ۶.۳. اجرا با Docker

```bash
# ایجاد فایل .env
cp .env.example .env
# مقادیر را پر کنید

# Build و اجرا
docker-compose up -d

# دیدن لاگ‌ها
docker-compose logs -f app

# توقف
docker-compose down
```

---

## ۷. Nginx Reverse Proxy

### ۷.۱. نصب Nginx

```bash
sudo apt install -y nginx
```

### ۷.۲. پیکربندی

فایل `/etc/nginx/sites-available/research-platform`:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Body size limit (برای آپلود فایل)
    client_max_body_size 50M;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    # Next.js app
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files caching
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

### ۷.۳. فعال‌سازی

```bash
sudo ln -s /etc/nginx/sites-available/research-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## ۸. SSL/HTTPS

### ۸.۱. نصب Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### ۸.۲. دریافت گواهی

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### ۸.۳. تمدید خودکار

```bash
# تست
sudo certbot renew --dry-run

# تمدید خودکار (اضافه می‌شود به cron)
sudo systemctl enable certbot.timer
```

---

## ۹. Systemd Service

### ۹.۱. ایجاد service

فایل `/etc/systemd/system/research-platform.service`:

```ini
[Unit]
Description=Agentic Research Intelligence Platform
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/research-platform
EnvironmentFile=/opt/research-platform/.env
ExecStart=/home/$USER/.bun/bin/bun run start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=research-platform

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

# Memory limit (adjust as needed)
MemoryLimit=2G

[Install]
WantedBy=multi-user.target
```

### ۹.۲. فعال‌سازی

```bash
# کپی فایل service
sudo cp /etc/systemd/system/research-platform.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# فعال‌سازی و شروع
sudo systemctl enable research-platform
sudo systemctl start research-platform

# وضعیت
sudo systemctl status research-platform

# دیدن لاگ‌ها
sudo journalctl -u research-platform -f
```

---

## ۱۰. پایش و مانیتورینگ

### ۱۰.۱. لاگ‌ها

```bash
# لاگ‌های اپلیکیشن
sudo journalctl -u research-platform -f

# لاگ‌های Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# لاگ‌های PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### ۱۰.۲. پایش منابع

```bash
# نصب htop
sudo apt install -y htop

# مشاهده مصرف
htop

# مصرف دیسک
df -h

# مصرف دیتابیس
sudo -u postgres psql -d research_platform -c "SELECT pg_size_pretty(pg_database_size('research_platform'));"
```

### ۱۰.۳. پایش خودکار (اختیاری)

```bash
# نصب Prometheus Node Exporter
sudo apt install -y prometheus-node-exporter
sudo systemctl enable prometheus-node-exporter
sudo systemctl start prometheus-node-exporter
```

### ۱۰.۴. Backup خودکار

اسکریپت `/opt/research-platform/scripts/backup.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/var/backups/research-platform"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$DATE.sql.gz"

mkdir -p $BACKUP_DIR

# Backup دیتابیس
PGPASSWORD="YOUR_PASSWORD" pg_dump \
  -h localhost \
  -U research_user \
  -d research_platform \
  | gzip > $BACKUP_FILE

# نگه‌داشتن فقط ۷ روز backup
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "Backup created: $BACKUP_FILE"
```

```bash
# قابل اجرا کردن
chmod +x /opt/research-platform/scripts/backup.sh

# Cron job (هر روز ساعت ۳ صبح)
sudo crontab -e
# اضافه کنید:
0 3 * * * /opt/research-platform/scripts/backup.sh
```

---

## ۱۱. Backup و Restore

### ۱۱.۱. Backup دستی

```bash
# Backup کامل دیتابیس
PGPASSWORD="YOUR_PASSWORD" pg_dump \
  -h localhost \
  -U research_user \
  -d research_platform \
  -F c \
  -f /tmp/research_platform_backup.dump

# Backup فایل‌های آپلود شده (اگر محلی هستند)
tar -czf /tmp/uploads_backup.tar.gz /opt/research-platform/uploads/
```

### ۱۱.۲. Restore

```bash
# Restore دیتابیس
PGPASSWORD="YOUR_PASSWORD" pg_restore \
  -h localhost \
  -U research_user \
  -d research_platform \
  -c \
  /tmp/research_platform_backup.dump

# Restore فایل‌ها
tar -xzf /tmp/uploads_backup.tar.gz -C /
```

---

## ۱۲. عیب‌یابی

### ۱۲.۱. اپلیکیشن اجرا نمی‌شود

```bash
# بررسی لاگ‌ها
sudo journalctl -u research-platform -n 50

# بررسی وضعیت
sudo systemctl status research-platform

# بررسی پورت
sudo lsof -i :3000

# تست دستی
cd /opt/research-platform
NODE_ENV=production bun run start
```

### ۱۲.۲. خطای اتصال دیتابیس

```bash
# تست اتصال
psql -h localhost -U research_user -d research_platform -c "SELECT 1;"

# بررسی سرویس PostgreSQL
sudo systemctl status postgresql

# بررسی pgvector
psql -h localhost -U research_user -d research_platform -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

### ۱۲.۳. خطای LLM API

```bash
# تست API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# بررسی لاگ‌های اپلیکیشن
sudo journalctl -u research-platform | grep -i "error"
```

### ۱۲.۴. مشکلات حافظه

```bash
# بررسی مصرف حافظه
free -h

# بررسی process
ps aux --sort=-%mem | head -10

# اگر Node.js حافظه زیادی مصرف می‌کند:
# در فایل systemd service:
# Environment=NODE_OPTIONS=--max-old-space-size=1536
```

### ۱۲.۵. مشکلات آپلود فایل

```bash
# بررسی دسترسی‌های دایرکتوری
ls -la /opt/research-platform/uploads/

# بررسی Nginx body size
sudo nginx -T | grep client_max_body_size
```

---

## ✅ Checklist نهایی

پیش از launch، مطمئن شوید:

- [ ] PostgreSQL 15+ نصب و pgvector فعال است
- [ ] دیتابیس و کاربر ایجاد شده
- [ ] `.env` با مقادیر واقعی پر شده (DATABASE_URL, JWT_SECRET, OPENAI_API_KEY)
- [ ] JWT_SECRET یک رشته تصادفی ۳۲ کاراکتری است
- [ ] `bun run db:push` با موفقیت اجرا شده
- [ ] `bun run build` با موفقیت اجرا شده
- [ ] اپلیکیشن روی پورت 3000 اجرا می‌شود
- [ ] Nginx reverse proxy پیکربندی شده
- [ ] SSL/HTTPS با Certbot فعال است
- [ ] Systemd service ایجاد و فعال شده
- [ ] Backup خودکار تنظیم شده
- [ ] لاگ‌ها بررسی شده‌اند
- [ ] تست کامل: ثبت‌نام → ساخت workspace → آپلود سند → چت → گزارش

---

## 📞 پشتیبانی

اگر مشکلی پیش آمد:

1. لاگ‌ها را بررسی کنید: `sudo journalctl -u research-platform -f`
2. وضعیت سرویس‌ها: `sudo systemctl status research-platform postgresql nginx`
3. اتصال دیتابیس: `psql -h localhost -U research_user -d research_platform -c "SELECT 1;"`
4. اتصال LLM API: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`

---

## 🔒 نکات امنیتی

1. **هرگز** فایل `.env` را در Git commit نکنید
2. **همیشه** از HTTPS استفاده کنید
3. **هرگز** JWT_SECRET را با کسی به اشتراک نگذارید
4. API key ها را به‌صورت دوره‌ای rotate کنید
5. firewall را فعال کنید: `sudo ufw enable && sudo ufw allow 22,80,443/tcp`
6. PostgreSQL را فقط روی localhost قابل دسترس کنید
7. backup ها را encrypted نگه دارید

موفق باشید! 🚀
