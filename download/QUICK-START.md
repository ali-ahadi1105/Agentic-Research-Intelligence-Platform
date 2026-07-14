# ⚡ Quick Start Guide — Agentic Research Intelligence Platform

راهنمای سریع برای اجرای پروژه در ۵ دقیقه

---

## گزینه ۱: Docker (سریع‌ترین — ۵ دقیقه)

```bash
# 1. Clone
git clone <repo-url> research-platform
cd research-platform

# 2. کپی تنظیمات
cp .env.example .env

# 3. مقادیر را در .env پر کنید (حداقل OPENAI_API_KEY)
nano .env

# 4. اجرا
docker-compose up -d

# 5. باز کنید: http://localhost:3000
```

---

## گزینه ۲: نصب محلی (۱۵ دقیقه)

### پیش‌نیازها

| نرم‌افزار | نسخه | دستور نصب |
|----------|------|-----------|
| Node.js | 20+ | `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash - && sudo apt install -y nodejs` |
| Bun | latest | `curl -fsSL https://bun.sh/install \| bash` |
| PostgreSQL | 15+ | `sudo apt install -y postgresql-15 postgresql-contrib-15` |
| pgvector | 0.7+ | [راهنما](#نصب-pgvector) |

### مراحل

```bash
# 1. Clone
git clone <repo-url> research-platform
cd research-platform

# 2. نصب وابستگی‌ها
bun install

# 3. دیتابیس ایجاد کنید
sudo -u postgres psql -c "CREATE USER research_user WITH PASSWORD 'password123';"
sudo -u postgres psql -c "CREATE DATABASE research_platform OWNER research_user;"
sudo -u postgres psql -d research_platform -c "CREATE EXTENSION vector;"

# 4. فایل .env بسازید
cp .env.example .env
```

فایل `.env` را ویرایش کنید:

```env
DATABASE_URL="postgresql://research_user:password123@localhost:5432/research_platform?schema=public"
JWT_SECRET="run: openssl rand -base64 32"

LLM_PROVIDER=openai-compatible
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

```bash
# 5. Schema را برای PostgreSQL به‌روزرسانی کنید
# در فایل prisma/schema.prisma:
#   datasource db { provider = "postgresql" }
#   model Chunk { embedding Unsupported("vector(1536)") }

# 6. اعمال schema
bun run db:generate
bun run db:push

# 7. اجرا
bun run dev

# 8. باز کنید: http://localhost:3000
```

---

## نصب pgvector

```bash
# پیش‌نیاز
sudo apt install -y postgresql-server-dev-15

# نصب
cd /tmp
git clone --branch v0.7.4 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# فعال‌سازی
sudo -u postgres psql -d research_platform -c "CREATE EXTENSION vector;"
```

---

## تنظیم مدل AI

شما ۴ گزینه دارید:

### ۱. OpenAI (ساده‌ترین)
```env
OPENAI_API_KEY=sk-proj-xxx
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### ۲. سرور محلی (vLLM)
```bash
# نصب
pip install vllm

# اجرا
vllm serve Qwen/Qwen2.5-7B-Instruct --port 8000 --api-key secret
```
```env
OPENAI_API_KEY=secret
OPENAI_BASE_URL=http://localhost:8000/v1
OPENAI_CHAT_MODEL=Qwen/Qwen2.5-7B-Instruct
OPENAI_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
```

### ۳. Anthropic Claude
```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
# برای embeddings:
OPENAI_API_KEY=sk-proj-xxx
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### ۴. Google Gemini
```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIzaXXX
GEMINI_MODEL=gemini-1.5-pro
```

---

## تست

پس از اجرا:

1. به `http://localhost:3000` بروید
2. روی **«ورود با حساب دمو»** کلیک کنید (یا ثبت‌نام کنید)
3. یک Workspace بسازید
4. روی **«افزودن داده نمونه»** کلیک کنید
5. ۲-۳ دقیقه صبر کنید (پردازش اسناد)
6. تب‌های مختلف را کاوش کنید:
   - **گراف دانش** — نمایش تعاملی موجودیت‌ها
   - **گفتگوی هوشمند** — سؤال بپرسید با citations
   - **گزارش‌ها** — تولید گزارش خودکار
   - **جستجو (⌘K)** — جستجوی معنایی

---

## مشکلات رایج

### خطای اتصال دیتابیس
```bash
# تست اتصال
psql -h localhost -U research_user -d research_platform

# اگر خطا داد، پسورد را چک کنید
```

### خطای pgvector
```bash
# بررسی نصب
psql -h localhost -U research_user -d research_platform -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# اگر خالی بود:
sudo -u postgres psql -d research_platform -c "CREATE EXTENSION vector;"
```

### خطای OpenAI API
```bash
# تست کلید
curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"
```

### اپلیکیشن اجرا نمی‌شود
```bash
# لاگ‌ها
bun run dev 2>&1 | head -50

# بررسی پورت
lsof -i :3000
```

---

## Production Deployment

برای راه‌اندازی کامل production با SSL، Nginx، systemd، backup خودکار و ...

**راه سریع:**
```bash
bash scripts/setup.sh
```

**راه کامل:** [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md) را بخوانید.
