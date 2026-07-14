# Agentic Research Intelligence Platform
## خلاصه پیاده‌سازی — نسخه ۲.۰ (با قابلیت‌های توسعه‌یافته)

### معماری
- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui + RTL Persian (Vazirmatn)
- **Backend**: Next.js API Routes با لایه‌بندی modular (Repository/Service/API)
- **Database**: SQLite + Prisma (schema-compatible با PostgreSQL + pgvector)
- **AI**: z-ai-web-dev-sdk (LLM + Web Search + Page Reader)

---

## ✅ قابلیت‌های新发展 یافته (نسخه ۲.۰)

### 1. Semantic Search (جایگزین pgvector)
- پیاده‌سازی TF-IDF (Term Frequency-Inverse Document Frequency) در JavaScript
- محاسبه cosine similarity بین query و chunks
- ذخیره embedding vectors در فیلد `chunk.embedding`
- بازسازی خودکار index در Continuous Updates
- نمایش نتایج با امتیاز شباهت (درصد)

**فایل‌ها:**
- `src/lib/services/semantic-search.ts` — TF-IDF engine
- `src/app/api/v1/workspaces/[workspaceId]/search/route.ts` — hybrid search API

### 2. Graph Analytics پیشرفته (جایگزین Neo4j)
- **Shortest Path**: BFS برای یافتن کوتاه‌ترین مسیر بین دو موجودیت
- **Degree Centrality**: in-degree, out-degree, total degree
- **Betweenness Centrality**: sampling-based برای کارایی
- **Community Detection**: Union-Find برای یافتن اجزای همبند
- **Graph Density & Average Degree**
- **Isolated Entities Detection**
- **Top Influential Entities** (by degree and betweenness)

**فایل‌ها:**
- `src/lib/services/graph-analytics.ts` — الگوریتم‌های گراف
- `src/app/api/v1/workspaces/[workspaceId]/graph/analytics/route.ts`
- `src/app/api/v1/workspaces/[workspaceId]/graph/path/route.ts`
- `src/components/graph/knowledge-graph-view.tsx` — UI با analytics panel + path finder

### 3. Continuous Updates (به‌روزرسانی تدریجی دانش)
- **Entity Merging**: ادغام موجودیت‌های تکراری با fuzzy matching
- **Confidence Recalculation**: محاسبه مجدد امتیاز اطمینان بر اساس source count, claims, relationships
- **Duplicate Relationship Removal**: حذف روابط تکراری
- **Index Rebuild**: بازسازی TF-IDF index
- **Automatic Trigger**: بعد از پردازش هر source جدید
- **Manual Trigger**: دکمه "به‌روزرسانی تدریجی" در dashboard

**فایل‌ها:**
- `src/lib/services/continuous-updates.ts`
- `src/app/api/v1/workspaces/[workspaceId]/continuous-update/route.ts`

### 4. RBAC کامل (۵ نقش)
- **super_admin**: دسترسی کامل سیستم
- **admin**: دسترسی کامل سازمان
- **research_manager**: مدیریت workspaces، sources، تأیید claims
- **analyst**: افزودن/ویرایش entities، claims، evidence (بدون حذف)
- **viewer**: فقط مشاهده + chat

**Permission Matrix** شامل ۲۳ permission برای ۵ نقش.

**فایل‌ها:**
- `src/lib/services/permissions.ts` — server-side permission matrix
- `src/lib/permissions-client.ts` — client-side permission helper
- UI: فیلتر کردن nav items بر اساس role، نمایش role badge در user menu

### 5. Admin Panel (پنل مدیریت)
۵ تب با کنترل دسترسی مبتنی بر نقش:

#### الف) Audit Logs Viewer
- نمایش تمام عملیات‌های مهم سیستم
- فیلتر بر اساس نوع عملیات (create, update, delete, login, ...)
- نمایش جزئیات هر لاگ (expandable)
- نمایش کاربر و timestamp

#### ب) API Keys Management
- تولید کلید API با نام و scopes
- نمایش فقط یک‌بار کلید (با هشدار امنیتی)
- کپی کلید به clipboard
- غیرفعال‌سازی کلیدها
- نمایش key prefix، آخرین استفاده، تاریخ ایجاد

#### ج) Prompt Management
- نمایش تمام prompt templates (۷ prompt)
- ویرایش system prompt با ذخیره نسخه جدید (versioning)
- تنظیم temperature و max tokens
- مشاهده تاریخچه نسخه‌ها
- Rollback به نسخه قبلی
- نمایش متغیرهای هر prompt

**مدل داده:** `PromptTemplate` با فیلدهای key, version, systemPrompt, variables, temperature, maxTokens

#### د) Notifications
- نمایش اعلان‌های کاربر
- شمارش اعلان‌های خوانده‌نشده
- علامت‌گذاری همه به‌عنوان خوانده‌شده
- حذف اعلان‌ها
- Badge در header و nav

#### هـ) Users Management (فقط super_admin)
- نمایش تمام اعضای سازمان
- تغییر نقش کاربران
- نمایش آخرین ورود و وضعیت حساب

---

## ✅ قابلیت‌های نسخه ۱.۰ (موجود)

### ماژول‌های اصلی
- Module 1: Authentication (JWT + Cookie + Session)
- Module 2: Organizations (Multi-tenant)
- Module 4: Workspaces (CRUD + ایزولاسیون)
- Module 6: Source Management (Upload/URL/Web Search/Manual Note)
- Module 7: Document Processing (Text Extraction, Chunking)
- Module 9: Entity Extraction (۱۵ نوع با LLM)
- Module 10: Relationship Extraction (۱۹ نوع)
- Module 11: Claims (۵ وضعیت + workflow)
- Module 12: Evidence (excerpt مستقیم)
- Module 14: Knowledge Graph (ReactFlow)
- Module 15: Timeline
- Module 17: AI Chat (با citations)
- Module 18: Reports (Markdown rendering)
- Module 21: Search (Hybrid)
- Module 24: Audit Logging
- Module 26: Settings

### AI Agents
1. Research Planning Agent
2. Source Processing Agent
3. Entity Extraction Agent
4. Relationship Extraction Agent
5. Claim Extraction Agent
6. Timeline Agent
7. Report Generation Agent
8. Chat Agent

---

## 🧪 نتایج تست کامل (Agent Browser)

### ۱. ورود و Workspace
- ✅ ورود با حساب دمو (demo@research.ai / demo1234)
- ✅ انتخاب Workspace موجود

### ۲. Dashboard
- ✅ نمایش آمار: ۳ منبع، ۲۹ موجودیت، ۳۵ رابطه، ۲۹ ادعا، ۱۲ رویداد
- ✅ دکمه "به‌روزرسانی تدریجی" — موفق (0 duplicate، rebuild index)
- ✅ دکمه "برنامه پژوهش" — موجود
- ✅ دکمه "افزودن داده نمونه" — موجود

### ۳. Documents
- ✅ نمایش ۳ سند (TechStart, ParsVenture, آکادمیک)
- ✅ نمایش word count، language، timestamp
- ✅ Reprocess موفق یک سند ناموفق (rate limit)
- ✅ موجودیت‌ها از ۲۱ به ۲۹ افزایش یافت

### ۴. Knowledge Base (Entities/Claims/Evidence)
- ✅ نمایش موجودیت‌ها با type، description، confidence، claim/relation counts
- ✅ نمایش ادعاها با status، confidence، evidence expandable
- ✅ نمایش شواهد با excerpt و source

### ۵. Knowledge Graph + Analytics
- ✅ گراف تعاملی با ۲۱ گره و ۲۵ یال
- ✅ آمار گراف: چگاری، میانگین درجه، اجزای همبند، موجودیت‌های ایزوله
- ✅ Top Entities by Degree
- ✅ Communities (اجزای همبند)
- ✅ Shortest Path Finder: TechStart → ParsVenture → دکتر رضا کریمی (۲ گام)
- ✅ Type breakdown sidebar

### ۶. Timeline
- ✅ نمایش ۱۲ رویداد با تاریخ، نوع، توضیحات

### ۷. Reports
- ✅ گزارش اجرایی موجود (Markdown rendering)
- ✅ شامل: خلاصه اجرایی، موجودیت‌های کلیدی، روابط، ادعاها، شواهد
- ✅ Citation با [E:n] format

### ۸. Chat با Citations
- ✅ پاسخ مبتنی بر دانش‌نامه (نه حافظه LLM)
- ✅ ۴ شرکت سرمایه‌گذاری‌شده توسط ParsVenture (TechStart, CloudPay, DataMiner, EduFlow)
- ✅ ۵ شواهد مستند با [E:n] citations
- ✅ موجودیت‌های مرتبط
- ✅ سطح اطمینان

### ۹. Semantic Search (TF-IDF)
- ✅ جستجوی "سرمایه‌گذاری ParsVenture در استارتاپ"
- ✅ ۳ نتایج معنایی (chunks) با امتیاز شباهت
- ✅ نمایش محتوا و source title

### ۱۰. Admin Panel
- ✅ Audit Logs: ۹ رویداد ثبت شده (ورود، به‌روزرسانی، ...)
- ✅ API Keys: کلید "کلید تست پنل" ساخته شد و نمایش داده می‌شود
- ✅ Prompt Management: ۷ prompt نمایش داده می‌شوند
- ✅ Notifications: نمایش اعلان‌ها (۰ خوانده‌نشده)
- ✅ Users: (فقط super_admin — نقش demo admin است)

### ۱۱. RBAC
- ✅ نقش admin: همه تب‌های admin قابل مشاهده به جز Users
- ✅ Role badge در user menu
- ✅ Nav filtering بر اساس permission

---

## 📁 ساختار فایل‌های جدید

### Backend Services
```
src/lib/services/
├── permissions.ts          # RBAC permission matrix (5 roles, 23 permissions)
├── semantic-search.ts      # TF-IDF + cosine similarity
├── graph-analytics.ts      # Shortest path, centrality, communities
└── continuous-updates.ts   # Entity merge, confidence recalc, index rebuild
```

### Admin APIs
```
src/app/api/v1/admin/
├── audit-logs/route.ts     # GET audit logs with filtering
├── api-keys/route.ts       # GET, POST, DELETE API keys
├── prompts/route.ts        # GET, PATCH prompts (versioning, rollback)
├── notifications/route.ts  # GET, PATCH notifications
└── users/route.ts          # GET, PATCH org members
```

### Graph APIs
```
src/app/api/v1/workspaces/[workspaceId]/graph/
├── analytics/route.ts      # Graph analytics (centrality, communities)
└── path/route.ts           # Shortest path finder
```

### Admin UI
```
src/components/admin/
├── admin-panel.tsx           # Main panel with 5 tabs
├── audit-logs-view.tsx       # Audit log viewer
├── api-keys-view.tsx         # API key management
├── prompt-management-view.tsx # Prompt editor with versioning
├── notifications-view.tsx    # Notifications
└── users-view.tsx            # User management
```

### Prompt System
```
src/lib/prompts/
├── templates.ts              # Default prompt templates
└── store.ts                  # DB-backed prompt store with versioning
```

---

## 🚀 شروع به کار

1. روی لینک Preview کلیک کنید
2. «ورود با حساب دمو» را بزنید (demo@research.ai / demo1234)
3. Workspace موجود را انتخاب کنید
4. ویژگی‌های جدید را تست کنید:
   - **گراف دانش**: analytics panel + shortest path finder
   - **جستجو (Cmd+K)**: نتایج معنایی با TF-IDF
   - **پنل مدیریت**: audit logs, API keys, prompts, notifications
   - **به‌روزرسانی تدریجی**: دکمه در dashboard
