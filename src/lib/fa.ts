/**
 * Persian/RTL helpers and constants.
 */

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  person: "شخص",
  company: "شرکت",
  organization: "سازمان",
  product: "محصول",
  technology: "تکنولوژی",
  country: "کشور",
  city: "شهر",
  investment: "سرمایه‌گذاری",
  event: "رویداد",
  patent: "پتنت",
  research_paper: "مقاله پژوهشی",
  website: "وب‌سایت",
  brand: "برند",
  project: "پروژه",
  concept: "مفهوم",
  location: "موقعیت",
};

export const ENTITY_TYPE_COLORS: Record<string, string> = {
  person: "#d97706",
  company: "#0891b2",
  organization: "#7c3aed",
  product: "#059669",
  technology: "#dc2626",
  country: "#ca8a04",
  city: "#65a30d",
  investment: "#9333ea",
  event: "#e11d48",
  patent: "#0d9488",
  research_paper: "#92400e",
  website: "#2563eb",
  brand: "#db2777",
  project: "#16a34a",
  concept: "#475569",
  location: "#a16207",
};

export const RELATIONSHIP_LABELS: Record<string, string> = {
  founder_of: "بنیان‌گذارِ",
  ceo_of: "مدیرعاملِ",
  employee_of: "کارمندِ",
  investor_in: "سرمایه‌گذار در",
  subsidiary_of: "زیرمجموعه‌ی",
  parent_company: "شرکت مادرِ",
  competitor: "رقیبِ",
  partner: "شریکِ",
  customer: "مشتریِ",
  supplier: "تأمین‌کننده‌ی",
  acquired: "خریداری کرد",
  merged: "ادغام شد با",
  collaborated: "همکاری با",
  invested: "سرمایه‌گذاری کرد در",
  member_of: "عضوِ",
  located_in: "مستقر در",
  owns: "مالکِ",
  controls: "کنترل می‌کند",
  created: "خلق کرد",
  supports: "پشتیبانی می‌کند",
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  docx: "Word",
  txt: "متن",
  markdown: "Markdown",
  csv: "CSV",
  excel: "Excel",
  powerpoint: "PowerPoint",
  image: "تصویر",
  web_page: "صفحه وب",
  url: "URL",
  manual_note: "یادداشت دستی",
};

export const CLAIM_STATUS_LABELS: Record<string, string> = {
  pending: "در انتظار",
  verified: "تأیید شده",
  rejected: "رد شده",
  disputed: "مورد اختلاف",
  archived: "بایگانی شده",
  merged: "ادغام شده",
};

export const CLAIM_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  verified: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  disputed: "bg-orange-100 text-orange-800 border-orange-200",
  archived: "bg-gray-100 text-gray-800 border-gray-200",
  merged: "bg-purple-100 text-purple-800 border-purple-200",
};

export const SOURCE_STATUS_LABELS: Record<string, string> = {
  pending: "در انتظار",
  processing: "در حال پردازش",
  processed: "پردازش شده",
  failed: "ناموفق",
  reprocessing: "پردازش مجدد",
};

export const REPORT_TYPE_LABELS: Record<string, string> = {
  executive_summary: "خلاصه اجرایی",
  company_report: "گزارش شرکت",
  person_report: "گزارش شخص",
  organization_report: "گزارش سازمان",
  investment_report: "گزارش سرمایه‌گذاری",
  market_report: "گزارش بازار",
  research_summary: "خلاصه پژوهش",
  custom: "گزارش سفارشی",
};

export const TIMELINE_TYPE_LABELS: Record<string, string> = {
  founding: "تأسیس",
  funding: "تأمین مالی",
  acquisition: "اکتساب",
  partnership: "شراکت",
  product_launch: "عرضه محصول",
  leadership_change: "تغییر رهبری",
  milestone: "نقطه عطف",
  event: "رویداد",
};

export function formatFaDate(date: string | Date | null): string {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function formatFaDateTime(date: string | Date | null): string {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "همین حالا";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} روز پیش`;
  return formatFaDate(d);
}

export function formatNumber(n: number): string {
  try {
    return n.toLocaleString("fa-IR");
  } catch {
    return String(n);
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function confidenceLabel(c: number): string {
  if (c >= 0.85) return "بسیار بالا";
  if (c >= 0.7) return "بالا";
  if (c >= 0.5) return "متوسط";
  if (c >= 0.3) return "پایین";
  return "بسیار پایین";
}

export function confidenceColor(c: number): string {
  if (c >= 0.85) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (c >= 0.7) return "text-teal-600 bg-teal-50 border-teal-200";
  if (c >= 0.5) return "text-amber-600 bg-amber-50 border-amber-200";
  if (c >= 0.3) return "text-orange-600 bg-orange-50 border-orange-200";
  return "text-red-600 bg-red-50 border-red-200";
}
