import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "پلتفرم هوشمند تحقیق | Agentic Research Intelligence",
  description:
    "پلتفرم تحقیقات هوشمند — تبدیل اطلاعات پراکنده به دانش ساختاریافته و قابل اعتماد برای تصمیم‌گیری استراتژیک",
  keywords: [
    "research",
    "knowledge base",
    "AI",
    "intelligence",
    "تحقیق",
    "دانش",
    "هوش مصنوعی",
  ],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        className={`${vazirmatn.variable} font-sans antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <Toaster />
        <SonnerToaster position="top-left" richColors />
      </body>
    </html>
  );
}
