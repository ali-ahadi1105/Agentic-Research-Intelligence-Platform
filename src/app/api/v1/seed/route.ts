import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  ok,
  unauthorizedResponse,
  internalError,
  notFound,
  authorizeWorkspace,
} from "@/lib/services/api-helpers";
import { processSourceKnowledge } from "@/lib/services/pipeline";

/**
 * POST /seed
 * Body: { workspaceId }
 * Seeds the workspace with demo research content about a startup ecosystem.
 * This is useful for demoing the platform without having to upload documents.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    const body = await request.json();
    const { workspaceId } = body;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    // Sample documents about a fictional startup ecosystem
    const samples = [
      {
        title: "TechStart — پروفایل شرکت",
        type: "manual_note",
        content: `TechStart یک استارتاپ فعال در حوزه هوش مصنوعی است که در سال ۲۰۲۱ توسط علی رضایی و مریم حسینی در تهران تأسیس شد.

شرکت TechStart در سال ۲۰۲۳ موفق به جذب سرمایه Series A به مبلغ ۵ میلیون دلار از صندوق سرمایه‌گذاری ParsVenture شد.

محصول اصلی TechStart یک پلتفرم هوش مصنوعی برای تحلیل اسناد حقوقی است که از تکنولوژی NLP و مدل‌های زبانی بزرگ (LLM) استفاده می‌کند.

TechStart در حال حاضر ۴۵ کارمند دارد و دفتر مرکزی آن در تهران، خیابان ولیعصر قرار دارد. علی رضایی به عنوان مدیرعامل (CEO) و مریم حسینی به عنوان مدیر فنی (CTO) فعالیت می‌کنند.

در سال ۲۰۲۴، TechStart با شرکت LegalNet وارد مشارکت استراتژیک شد تا خدمات خود را به بازار کشورهای حوزه خلیج فارس گسترش دهد.

TechStart با شرکت‌های AIAnalyzer و DocuMind در رقابت مستقیم است، اما مزیت رقابتی آن در تخصص حقوقی و پشتیبانی از زبان فارسی است.

صندوق ParsVenture به مدیریت دکتر رضا کریمی، پیش‌تر نیز در شرکت‌های CloudPay و DataMiner سرمایه‌گذاری کرده است.

TechStart در حال حاضر در حال توسعه محصول جدیدی به نام LegalMind است که قابلیت تحلیل قراردادهای بین‌المللی را خواهد داشت. این محصول در Q3 2025 به بازار عرضه خواهد شد.`,
      },
      {
        title: "ParsVenture — پروفایل صندوق سرمایه‌گذاری",
        type: "manual_note",
        content: `ParsVenture یک صندوق سرمایه‌گذاری جسورانه (Venture Capital) است که در سال ۲۰۱۸ توسط دکتر رضا کریمی تأسیس شد. این صندوق با سرمایه ۱۰۰ میلیون دلاری، روی استارتاپ‌های مرحله اولیه (Seed) و Series A در حوزه تکنولوژی تمرکز دارد.

دفتر مرکزی ParsVenture در تهران قرار دارد و دفتر دوم آن در دبی فعال است. دکتر رضا کریمی که قبلاً استاد دانشگاه شریف بود، به عنوان managing partner فعالیت می‌کند.

ParsVenture تاکنون در بیش از ۲۰ استارتاپ سرمایه‌گذاری کرده است که از جمله می‌توان به TechStart، CloudPay، DataMiner، EduFlow و MedTrack اشاره کرد.

در سال ۲۰۲۲، ParsVenture در CloudPay ۳ میلیون دلار سرمایه‌گذاری کرد. این شرکت در سال ۲۰۲۴ توسط支付Portal ا acquisition شد.

ParsVenture در DataMiner در سال ۲۰۲۱ سرمایه‌گذاری کرد، اما این شرکت در سال ۲۰۲۴ به دلیل مشکلات مالی تعطیل شد.

صندوق ParsVenture در EduFlow در سال ۲۰۲۳ با مبلغ ۲ میلیون دلار سرمایه‌گذاری کرد. EduFlow پلتفرم آموزش آنلاین است که توسط سارا احمدی تأسیس شد.

ParsVenture در حال حاضر در حال筹集 صندوق دوم خود با هدف ۲۰۰ میلیون دلار است که در Q1 2026 نهایی خواهد شد.`,
      },
      {
        title: "آکادمیک - مقاله پژوهشی",
        type: "manual_note",
        content: `مقاله پژوهشی: "بررسی کاربرد مدل‌های زبانی بزرگ در تحلیل اسناد حقوقی فارسی"

این مقاله توسط تیم پژوهشی دانشگاه تهران به سرپرستی دکتر محمدرضا فرهادی در سال ۲۰۲۴ منتشر شده است.

محققان این مقاله شامل علی رضایی (مدیرعامل TechStart)، فاطمه نوری و حسین موسوی هستند.

نتایج این پژوهش نشان می‌دهد که مدل‌های زبانی بزرگ می‌توانند با دقت ۹۲٪ اسناد حقوقی فارسی را تحلیل کنند.

این پژوهش با همکاری شرکت TechStart انجام شده و داده‌های آن از پروژه LegalMind استخراج شده است.

دکتر فرهادی که قبلاً در دانشگاه استنفورد تحصیل کرده بود، در سال ۲۰۲۰ به ایران بازگشت و آزمایشگاه NLP دانشگاه تهران را تأسیس کرد.

این مقاله در کنفرانس ACL 2024 پذیرفته شده و در دیتابیس IEEE indexed است.

پروژه LegalMind قرار است در Q3 2025 به عنوان محصول تجاری توسط TechStart عرضه شود.`,
      },
    ];

    const createdSources = [];

    for (const sample of samples) {
      const source = await db.source.create({
        data: {
          workspaceId,
          title: sample.title,
          type: sample.type,
          status: "processing",
          processingProgress: 5,
          language: "fa",
          metadata: JSON.stringify({ format: "manual_note", seeded: true }),
        },
      });

      await db.document.create({
        data: {
          sourceId: source.id,
          content: sample.content,
          contentCleaned: sample.content,
          language: "fa",
          wordCount: sample.content.split(/\s+/).length,
          metadata: JSON.stringify({ format: "manual_note" }),
        },
      });

      // Trigger processing
      processSourceKnowledge(source.id).catch((err) => {
        console.error(`[Seed] Background processing failed for ${source.id}:`, err);
      });

      createdSources.push({ id: source.id, title: source.title });
    }

    return ok({
      seeded: true,
      sources: createdSources,
      message: `${samples.length} سند نمونه اضافه شد. پردازش پس‌زمینه آغاز شده است.`,
    });
  } catch (err) {
    console.error("[Seed API] POST error:", err);
    return internalError();
  }
}
