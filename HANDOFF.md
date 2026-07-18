# مستند انتقال سیستم — Agentic Research Platform v2

**تاریخ:** ۲۴ تیر ۱۴۰۵  
**برنچ فعلی:** `main` (با feature branchهای `feature/opportunity-analysis` و `feature/research-automation` که به main merge شدهاند)  
**برنچ جاری:** `feature/claim-approval` (هنوز کار شروع نشده)

---

## ۱. وضعیت کلی

| بخش | وضعیت | توضیح |
|------|--------|-------|
| **ورود و احراز هویت** | ✅ کامل | ایمیل/رمز، دمو حساب |
| **Workspaceها** | ✅ کامل | ایجاد، مدیریت، organization |
| **آپلود و پردازش اسناد** | ✅ کامل | PDF, DOCX, TXT, Markdown و... |
| **استخراج دانش (Pipeline)** | ✅ کامل | Chunk → Embedding → Entity → Claim → Relationship → Timeline |
| **جستجوی معنایی (Semantic Search)** | ✅ کامل | Vector + Keyword با fallback |
| **چت هوشمند (RAG Chat)** | ✅ کامل | با chunk-level fallback و citation |
| **Report Generation** | ✅ کامل | ۶ نوع گزارش با chunk context |
| **تحلیل فرصت (Opportunity Analysis)** | ✅ کامل | Module 19 — ۸ نوع تحلیل |
| **تحقیق خودکار (Research Automation)** | ✅ کامل | Module 8 — web search + pipeline |
| **اعتبارسنجی ادعاها** | ❌ شروع نشده | نیاز به UI approve/reject |
| **یادداشتها (Notes)** | ❌ شروع نشده | Module 16 |
| **اعلانها (Notifications)** | ❌ شروع نشده | Module 20 |
| **PDF فارسی** | ❌ باگ دارد | فونت توی خروجی PDF خراب است |
| **OCR** | ❌ شروع نشده | |

## ۲. وضعیت دیتابیس (Workspace: مرکز صدور گواهی پارت)

| آیتم | تعداد |
|------|-------|
| **منابع (Sources)** | ۶ |
| **Chunkها** | ۲۱۹ |
| **موجودیتها (Entities)** | ۱۷۸ |
| **ادعاها (Claims)** | ۶۹ |
| **روابط (Relationships)** | ۶۲ |
| **رویدادهای زمانی** | ۳۲ |
| **تحقیقات خودکار** | ۱ |

## ۳. معماری سیستم

### مسیرهای اصلی API

```
GET/POST  /api/v1/auth
GET       /api/v1/workspaces
GET/POST  /api/v1/workspaces/[id]/...
  ├── sources
  ├── entities
  ├── claims
  ├── relationships
  ├── timeline
  ├── graph
  ├── reports
  ├── opportunity
  ├── auto-research
  ├── chat
  └── settings
```

### سرویسهای اصلی

| سرویس | مسیر | توضیح |
|-------|------|-------|
| **Pipeline** | `src/lib/services/pipeline.ts` | پردازش منبع → chunk → embedding → extraction |
| **Web Search** | `src/lib/services/web-search.ts` | Wikipedia → arXiv → DuckDuckGo → Tavily |
| **Auto Research** | `src/lib/services/auto-research.ts` | orchestrator web → read → source → pipeline |
| **Chat/RAG** | `src/lib/ai/agents.ts` | سوال → semantic search → context → LLM |
| **Report** | `src/lib/ai/agents.ts` | تولید ۶ نوع گزارش |
| **Opportunity** | `src/lib/ai/agents.ts` | تولید ۸ نوع تحلیل فرصت |
| **Export PDF** | `src/lib/export.ts` | Browser print-to-PDF (باگ فونت) |

### Agentها (LLM)

```
src/lib/ai/
├── client.ts              # ارتباط با proxy (localhost:20128)
├── agents.ts              # extraction, chat, report, opportunity
├── providers/
│   ├── types.ts
│   ├── types-local.ts
│   └── ...
└── prompts/
    └── templates.ts       # همه پرامپتها (extraction, chat, report, opportunity, research)
```

### Frontend

```
src/components/
├── auth/                  # صفحه ورود
├── layout/                # AppShell + navigation
├── dashboard/             # workspace overview, settings
├── documents/             # آپلود و مدیریت اسناد
├── knowledge/             # موجودیتها، ادعاها، شواهد
├── graph/                 # گراف دانش
├── timeline/              # خط زمانی
├── reports/               # گزارشها
├── opportunity/           # تحلیل فرصت
├── research/              # تحقیق خودکار
├── chat/                  # گفتگوی هوشمند
└── common/                # کامپوننتهای مشترک
```

## ۴. باگ‌های شناخته شده

### 🔴 P0 — PDF فارسی خراب
- **فایل:** `src/lib/export.ts`
- **توضیح:** هنگام دریافت PDF گزارش، حروف فارسی به هم ریخته نمایش داده میشوند
- **علت:** فونت Vazirmatn در پنجره پرینت مرورگر به درستی لود نمیشود (روش Browser Print-to-PDF)
- **راهکار پیشنهادی:** 
  1. استفاده از `window.print()` مستقیم در همان صفحه (بدون `window.open`) تا فونت از قبل لود شده باشد
  2. یا تولید PDF سمت سرور با `puppeteer`/`wkhtmltopdf`
  3. یا استفاده از `jspdf` + `html2canvas`

### 🟡 P1 — نمایش web_page sources
- **وضعیت:** رفع شده (علت: اشتباه type="web" بجای type="web_page")
- اما منابع قدیمی پاک شدند، منابع جدید با type درست کار میکنند

### 🟡 P1 — Unique constraint در pipeline
- **فایل:** `src/lib/services/pipeline.ts`
- **توضیح:** گاهی `claimId-entityId` تکراری باعث خطا میشود
- **تأثیر:** جزئی، pipeline ادامه میدهد
- **راهکار:** استفاده از `createMany` با `skipDuplicates: true`

### 🟢 P2 — Semantic search fallback
- وقتی embedding dimension mismatch باشد، به keyword search fallback میکند
- این intentional است، نه باگ

## ۵. کارهای باقی مانده (طبق اولویت)

### P1 — اعتبارسنجی ادعاها (Claim Approval Workflow)
- **برنچ پیشنهادی:** `feature/claim-approval`
- دکمه تأیید/رد برای ادعاها و موجودیتها
- فیلتر بر اساس وضعیت (confirmed/rejected/pending)
- نمایش تاریخچه تأیید/رد
- Bulk approve/reject
- جا: `src/components/knowledge/` + API route claims

### P1 — یادداشتها (Notes) — Module 16
- **برنچ پیشنهادی:** `feature/notes`
- مدل دیتابیس + API + UI
- پشتیبانی از Markdown
- تگگذاری و ارجاع به موجودیتها

### P0 — رفع PDF فارسی
- **برنچ پیشنهادی:** `feature/pdf-fix`
- روش `window.print()` یا server-side PDF

### P2 — اعلانها (Notifications)
- **برنچ پیشنهادی:** `feature/notifications`
- مدل Notification + API + UI

## ۶. کانفیگ محیطی

### `.env` (مهم)

```
# LLM Provider
LLM_PROVIDER=openai-compatible
OPENAI_BASE_URL=http://localhost:20128/v1
OPENAI_API_KEY=<token>

# Chat Model
OPENAI_CHAT_MODEL=auto/chat

# Embedding Model
OPENAI_EMBEDDING_MODEL=gemini/gemini-embedding-2
EMBEDDING_DIMENSIONS=3072

# Web Search
TAVILY_API_KEY=tvly-... (اختیاری — برای Tavily)

# Database
DATABASE_URL=postgresql://research_user:<pass>@localhost:54321/research_platform

# Next Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<secret>
```

### سرویسهای مورد نیاز

| سرویس | پورت | توضیح |
|-------|------|-------|
| **Next.js dev server** | ۳۰۰۰ | فرانتاند + بکند |
| **z.ai proxy** | ۲۰۱۲۸ | پروکسی LLM (Mistral, Gemini, ...) |
| **PostgreSQL** | ۵۴۳۲۱ | دیتابیس + pgvector |

### Proxy LLM (z.ai)

Endpoint: `http://localhost:20128/v1`
مدلهای در دسترس از طریق proxy:
- `auto/chat` (Mistral Large) — برای چت و extraction
- `gemini/gemini-embedding-2` — embedding 3072 بعدی
- `auto/best-fast` — برای کارهای سریع
- `gemini/gemini-2.5-flash` — برای کارهای بصری

## ۷. Git Structure

```
main ─── merge feature/opportunity-analysis ─── merge feature/research-automation ── [اینجا]
│
├── feature/opportunity-analysis (merge شده)
│   └── فرصت: Opportunity module + chunk-level context + PDF button
│
├── feature/research-automation (merge شده)
│   └── Web search + Auto Research Agent + history
│
├── feature/claim-approval (آماده شروع)
│   └── TODO: approve/reject claims workflow
│
├── feature/notes (آینده)
└── feature/pdf-fix (آینده)
```

## ۸. نحوه راه‌اندازی

```bash
# 1. نصب وابستگیها
cd ~/Desktop/research-v2
npm install

# 2. Prisma
npx prisma db push
npx prisma generate

# 3. شروع Proxy LLM (z.ai)
# (از قبل روی پورت ۲۰۱۲۸ در حال اجراست)

# 4. شروع سرویس
npx next dev -p 3000

# 5. باز کردن مرورگر
# http://localhost:3000
# حساب دمو: demo@research.ai / demo1234
```

---

**تاریخچه commits اخیر:**
```
0fd28ae fix: web source type, research history, and pipeline fixes
b7b7518 docs: mark Research Automation (Module 8) as completed in ROADMAP
64bad1c feat: complete Auto Research Agent (Module 8)
2a05a37 feat: add web search API and fix Tavily integration
f44a114 feat: add web search service with tiered approach
27cbc07 docs: mark Opportunity Analysis (Module 19) as completed in ROADMAP
3e9d375 feat: add PDF download button to opportunity analysis view
1126747 fix: remove duplicated 'تحلیل' in opportunity title
55c0622 feat: add chunk-level context to reports and opportunity analysis
d82ac18 feat: add Opportunity Analysis module (Module 19)
```
