# نقشه راه تکامل سرویس — Agentic Research Platform

> **قانون:** هر آیتم فقط زمانی «تکمیل شده» محسوب میشود که:
> - پیاده‌سازی شده باشد
> - تست شده باشد (دستی + خودکار)
> - در UI به درستی کار کند
> - خطاهای شناخته‌شده نداشته باشد

---

## فاز ۰ — رفع مشکلات حیاتی (P0)

### ۱. خروجی PDF با فونت فارسی درست
- **وضعیت:** ❌
- **توضیح:** هنگام دریافت PDF گزارش، حروف فارسی به هم ریخته نمایش داده میشود
- **دلیل:** فونت Vazirmatn در پنجره پرینت به درستی لود نمیشود
- **راهکار:** استفاده از `print()` در همان صفحه (بدون `window.open`) یا تولید PDF سمت سرور با `puppeteer`/`wkhtmltopdf`
- **تست:** خروجی PDF گرفته شود و تمام کلمات فارسی به درستی نمایش داده شوند
- [ ] تکمیل شده

### ۲. یکسانسازی ابعاد Embedding
- **وضعیت:** 🟡
- **توضیح:** chunkها با `gemini/gemini-embedding-2` (۳۰۷۲ بعدی) embedding شدهاند ولی query embedding گاهی fallback به مدل محلی (۳۸۴ بعدی) میکند
- **راهکار:** تنظیم `EMBEDDING_BASE_URL` مجزا در `.env` برای ثبات یا رفع ۵۰۲ در سینگال embedding
- **تست:** `semanticSearch` بدون fallback به keyword کار کند و ابعاد یکسان باشد
- [ ] تکمیل شده

### ۳. استخراج Claims/Entities قابلاعتماد
- **وضعیت:** ✅
- **توضیح:** extraction با `auto/chat` + cleanup یونیکد + افزایش maxTokens کار میکند
- **تست:** ۴۶ موجودیت و ۳۳ ادعا از PDF استخراج شده است ✅

---

## فاز ۱ — قابلیتهای اصلی موجود در PROJECT.md (P1)

### ۴. تحلیل فرصت (Opportunity Analysis) — Module 19
- **وضعیت:** ✅
- **پیچیدگی:** بالا
- **Features پیاده‌سازی شده:**
  - [x] تحلیل تناسب سازمانی (Organization Fit)
  - [x] تحلیل سرمایه‌گذاری (Investment Fit)
  - [x] استراتژی همکاری (Collaboration Strategy)
  - [x] استراتژی ورود به بازار (Entry Strategy)
  - [x] تحلیل ریسک (Risk Analysis)
  - [x] تحلیل SWOT (Strength/Weakness/Opportunity/Threat)
  - [x] پیشنهاد پیچ (Pitch Suggestions)
  - [x] شناسایی تصمیمگیرندگان (Decision Maker Identification)
- **توضیح:** ماژول کامل با ۸ نوع تحلیل، API، UI، دکمه PDF و Markdown. تحلیلها بر اساس extracted data + chunk context تولید میشوند.

### ۵. پردازش خودکار (Research Automation) — Module 8
- **وضعیت:** ✅
- **پیچیدگی:** بالا
- **Features پیاده‌سازی شده:**
  - [x] سرویس web search سه‌لایه (Wikipedia, arXiv, Tavily)
  - [x] تولید خودکار query با LLM
  - [x] رتبه‌بندی نتایج بر اساس relevance
  - [x] خواندن صفحات و استخراج متن
  - [x] ایجاد منبع جدید در دیتابیس
  - [x] Pipeline پردازش خودکار (استخراج موجودیت/ادعا)
  - [x] API endpoint
  - [x] UI کامل با نمایش نتیجه
- **تست:** تحقیق خودکار با goal "PKI certificate authority market" → ۱۶ نتیجه، ۳ منبع ساخته شد ✅

### ۶. یادداشتها (Notes) — Module 16
- **وضعیت:** ❌
- **پیچیدگی:** متوسط
- **توضیح:** کاربران بتوانند یادداشتهای دستی به دانشنامه اضافه کنند
- **Features:**
  - [ ] پشتیبانی از Markdown / Rich Text
  - [ ] تگگذاری (Tags)
  - [ ] اشاره به موجودیتها و منابع (Mentions)
  - [ ] ارجاع (References)
  - [ ] تاریخچه نسخهها (Version History)
  - [ ] کامنتگذاری
- **تست:** یادداشت با متن فارسی و انگلیسی بنویس → تگ بزن → به موجودیت ارجاع بده → نمایش درست باشد
- [ ] تکمیل شده

### ۷. اعتبارسنجی ادعاها (Claim Approval Workflow)
- **وضعیت:** 🟡
- **پیچیدگی:** کم
- **توضیح:** کاربر باید بتواند ادعاها را تأیید، رد، یا ادغام کند
- **Features:**
  - [ ] دکمه تأیید/رد در UI موجودیتها و ادعاها
  - [ ] فیلتر بر اساس وضعیت (confirmed/rejected/pending)
  - [ ] نمایش history تأیید/رد
  - [ ] bulk approve/reject
- **تست:** ۵ ادعا را یکییکی و گروهی تأیید و رد کن → وضعیتها درست ذخیره و نمایش داده شود
- [ ] تکمیل شده

---

## فاز ۲ — بهبودهای نسخه ۱ (P2)

### ۸. اعلانها (Notifications) — Module 20
- **وضعیت:** ❌
- **پیچیدگی:** متوسط
- **Features:**
  - [ ] اعلان درونبرنامهای (In-App)
  - [ ] ایمیل
  - [ ] Webhook
  - [ ] اعلان اتمام پردازش اسناد
  - [ ] اعلان خطاها
  - [ ] تنظیمات اعلان
- [ ] تکمیل شده

### ۹. Import/Export کامل — Module 23
- **وضعیت:** 🟡
- **پیچیدگی:** متوسط
- **Features:**
  - [ ] خروجی کل workspace (JSON)
  - [ ] خروجی گراف دانش (GraphML/JSON)
  - [ ] خروجی موجودیتها + ادعاها
  - [ ] پشتیبانگیری (Backup)
  - [ ] بازیابی (Restore)
  - [ ] گزارش PDF با فونت درست (مرتبط با P0-1)
- [ ] تکمیل شده

### ۱۰. برنامه پژوهش (Research Planning Agent)
- **وضعیت:** 🟡
- **پیچیدگی:** متوسط
- **توضیح:** AI agent تولید برنامه تحقیق بر اساس goal workspace
- **Features:**
  - [ ] تولید step-by-step research plan
  - [ ] تعیین منابع پیشنهادی
  - [ ] تخمین زمان
  - [ ] اولویتبندی
  - [ ] نمایش progress
- [ ] تکمیل شده

### ۱۱. OCR برای اسناد تصویری
- **وضعیت:** ❌
- **پیچیدگی:** متوسط
- **توضیح:** استخراج متن از تصاویر و PDFهای اسکن شده با Tesseract یا OCR سرویس
- [ ] تکمیل شده

### ۱۲. بهبود استخراج موجودیتها
- **وضعیت:** 🟡
- **پیچیدگی:** کم
- **Features:**
  - [ ] پشتیبانی از نوعهای بیشتر (Person, Company, Product, Technology, Country, Event)
  - [ ] ادغام موجودیتهای تکراری (Merging)
  - [ ] تفکیک موجودیتها (Splitting)
  - [ ] ویرایش توضیحات و metadata
- [ ] تکمیل شده

---

## فاز ۳ — قابلیتهای پیشرفته (P3)

### ۱۳. جستجوی پیشرفته و Semantic Search بهبودیافته
- [ ] فیلتر بر اساس نوع منبع
- [ ] فیلتر بر اساس تاریخ
- [ ] فیلتر بر اساس موجودیت
- [ ] Boosting بر اساس relevance و freshness
- [ ] hybrid search (vector + keyword + graph)

### ۱۴. Multi-Agent Collaboration
- [ ] agentهای تخصصی برای هر مرحله
- [ ] هماهنگی بین agentها
- [ ] observability و debug

### ۱۵. Dashboard و Analytics
- [ ] آمار پیشرفت research
- [ ] coverage graph
- [ ] confidence metrics
- [ ] source quality scoring

### ۱۶. Workspace Collaboration
- [ ] دعوت کاربران
- [ ] نقشهای دسترسی
- [ ] real-time collaboration
- [ ] comments

### ۱۷. Plugin System
- [ ] API عمومی
- [ ] Webhookهای خروجی
- [ ] قابلیت扩展

---

## فاز ۴ — آینده دور (V3)

### ۱۸. Mobile App / PWA
### ۱۹. Marketplace قالب گزارش
### ۲۰. Third-party Integrations (Slack, Notion, etc.)
### ۲۱. Automated Report Scheduling

---

## خلاصه اولویتها

| اولویت | آیتمها | تعداد |
|--------|--------|-------|
| **P0 (باید فوری)** | PDF فارسی (باگ) | ۱ |
| **P1 (ویژگیهای اصلی)** | Claim Workflow, Notes | ۲ |
| **P2 (بهبودها)** | Notifications, Import/Export, Research Plan, OCR, Entities | ۵ |
| **P3 (پیشرفته)** | Search, Multi-Agent, Dashboard, Collaboration, Plugins | ۵ |
| **V3 (آینده)** | Mobile, Marketplace, Integrations | ۴ |

---

## وضعیت دیتابیس فعلی (Workspace نمونه)

| آیتم | مقدار |
|------|-------|
| **منابع** | ۶ |
| **Chunkها** | ۲۱۹ |
| **موجودیتها** | ۱۷۸ |
| **ادعاها** | ۶۹ |
| **روابط** | ۶۲ |
| **رویدادهای زمانی** | ۳۲ |
| **تحقیقات خودکار** | ۱ |

---

## باگ‌های شناخته شده

### PDF فارسی (P0)
- **فایل:** `src/lib/export.ts`
- **توضیح:** حروف فارسی در خروجی PDF به هم ریخته
- **علت:** فونت Vazirmatn در پنجره پرینت لود نمیشود
- **راهکار:** `window.print()` در همان صفحه یا تولید سرور با puppeteer

### Unique constraint در Pipeline (P1)
- **فایل:** `src/lib/services/pipeline.ts`
- گاهی claimId-entityId تکراری باعث خطا میشود (جزئی، pipeline ادامه میدهد)

---

> **نکته:** هر آیتم بعد از پیادهسازی باید **تست شود** و فقط در صورت کارکرد درست در UI تیک «تکمیل شده» دریافت کند.
> مستندات PROJECT.md در `download/PROJECT.md` منبع معتبر برای جزئیات هر ماژول است.
> فایل HANDOFF.md در مسیر root پروژه برای انتقال سیستم آماده است.
