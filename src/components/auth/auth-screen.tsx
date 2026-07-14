"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Loader2, AlertCircle, Sparkles, ShieldCheck, Network } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AuthScreen() {
  const { login, register, isLoading, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const switchMode = (newMode: "login" | "register") => {
    clearError();
    setLocalError(null);
    setMode(newMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError("ایمیل و رمز عبور را وارد کنید");
      return;
    }
    if (mode === "register" && !name) {
      setLocalError("نام را وارد کنید");
      return;
    }

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "خطا");
    }
  };

  const handleDemo = async () => {
    setMode("login");
    setEmail("demo@research.ai");
    setPassword("demo1234");
    setLocalError(null);
    // Try login first; if it fails, register
    try {
      await login("demo@research.ai", "demo1234");
    } catch {
      try {
        await register("demo@research.ai", "demo1234", "کاربر نمونه");
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "خطا در ساخت حساب دمو");
      }
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left side - hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 text-primary-foreground flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="200" height="200" fill="url(#grid)" />
          </svg>
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="size-10 rounded-xl bg-accent flex items-center justify-center">
              <Brain className="size-6 text-accent-foreground" />
            </div>
            <span className="text-xl font-bold">پلتفرم هوشمند تحقیق</span>
          </div>

          <h1 className="text-4xl font-bold leading-tight mb-4">
            تبدیل اطلاعات پراکنده
            <br />
            به دانش قابل اعتماد
          </h1>
          <p className="text-primary-foreground/80 text-lg leading-relaxed mb-8">
            پلتفرم تحقیقات هوشمند با معماری چند-عاملی هوش مصنوعی برای کشف، اعتبارسنجی
            و سازماندهی دانش.
          </p>

          <div className="space-y-4">
            <Feature icon={<Sparkles className="size-5" />} title="استخراج خودمند دانش">
              موجودیت‌ها، روابط و ادعاها با شواهد مستند از اسناد شما
            </Feature>
            <Feature icon={<Network className="size-5" />} title="گراف دانش تعاملی">
              کاوش روابط پیچیده بین اشخاص، شرکت‌ها و سازمان‌ها
            </Feature>
            <Feature icon={<ShieldCheck className="size-5" />} title="اصل شواهد‌محوری">
              هر ادعا با منبع و شاهد قابل追溯، شفافیت کامل در پاسخ‌ها
            </Feature>
          </div>
        </div>

        <div className="relative z-10 text-sm text-primary-foreground/60">
          نسخه ۱.۰ — مطابق سند مشخصات پروژه
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="lg:hidden size-14 rounded-2xl bg-primary mx-auto mb-3 flex items-center justify-center">
              <Brain className="size-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">خوش آمدید</CardTitle>
            <CardDescription>
              برای ادامه وارد حساب خود شوید یا حساب جدید بسازید
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => switchMode(v as "login" | "register")}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">ورود</TabsTrigger>
                <TabsTrigger value="register">ثبت‌نام</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">ایمیل</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      dir="ltr"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">رمز عبور</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                      disabled={isLoading}
                    />
                  </div>
                  {displayError && (
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertDescription>{displayError}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> در حال ورود...
                      </>
                    ) : (
                      "ورود به سیستم"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">نام و نام خانوادگی</Label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="مثلاً: علی رضایی"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email2">ایمیل</Label>
                    <Input
                      id="email2"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      dir="ltr"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password2">رمز عبور</Label>
                    <Input
                      id="password2"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="حداقل ۸ کاراکتر"
                      dir="ltr"
                      disabled={isLoading}
                    />
                  </div>
                  {displayError && (
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertDescription>{displayError}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> در حال ساخت حساب...
                      </>
                    ) : (
                      "ایجاد حساب کاربری"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 pt-6 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleDemo}
                disabled={isLoading}
              >
                <Sparkles className="size-4 ml-2" />
                ورود با حساب دمو
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                برای تجربه سریع سیستم، از حساب دمو استفاده کنید
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="size-10 rounded-lg bg-primary-foreground/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="font-semibold mb-1">{title}</div>
        <div className="text-sm text-primary-foreground/70">{children}</div>
      </div>
    </div>
  );
}
