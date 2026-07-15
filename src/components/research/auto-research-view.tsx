"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Sparkles, Globe, BookOpen, FileText } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function AutoResearchView() {
  const { currentWorkspaceId } = useAppStore();
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<{
    totalSearches: number;
    totalResults: number;
    pagesRead: number;
    sourcesCreated: number;
    summary: string;
  } | null>(null);

  const runMutation = useMutation({
    mutationFn: () =>
      api.autoResearch.run(currentWorkspaceId!, goal || undefined, 3, 5),
    onSuccess: (data) => {
      setResult(data);
      toast.success("تحقیق خودکار با موفقیت انجام شد");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "خطا در اجرای تحقیق خودکار"),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">تحقیق خودکار</h1>
          <p className="text-muted-foreground mt-1">
            جستجوی هوشمند اینترنتی بر اساس هدف تحقیقاتی workspace — صفحات مرتبط را پیدا کرده، متن آنها را استخراج و به دانشنامه اضافه میکند
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="size-5" />
            شروع تحقیق خودکار
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal">هدف تحقیق (اختیاری)</Label>
            <Textarea
              id="goal"
              placeholder="مثال: آخرین وضعیت بازار گواهی دیجیتال در ایران، تحلیل رقبا..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              اگر خالی بماند، از Research Goal تنظیم شده در workspace استفاده میشود
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 bg-muted/30 p-2 rounded">
              <Globe className="size-4" />
              <span>جستجو در ۳ منبع</span>
            </div>
            <div className="flex items-center gap-2 bg-muted/30 p-2 rounded">
              <BookOpen className="size-4" />
              <span>خواندن ۵ صفحه</span>
            </div>
            <div className="flex items-center gap-2 bg-muted/30 p-2 rounded">
              <FileText className="size-4" />
              <span>ایجاد منبع جدید</span>
            </div>
          </div>

          <Button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="w-full"
            size="lg"
          >
            {runMutation.isPending ? (
              <>
                <Loader2 className="size-5 animate-spin ml-2" />
                در حال تحقیق... این فرآیند چند دقیقه طول میکشد
              </>
            ) : (
              <>
                <Sparkles className="size-5 ml-2" />
                شروع تحقیق خودکار
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {runMutation.isPending && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <div>
                <p className="font-medium">در حال تحقیق...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  تولید query → جستجو → خواندن صفحات → ایجاد منبع
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              نتیجه تحقیق
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-primary/5 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary">{result.totalSearches}</div>
                <div className="text-xs text-muted-foreground">جستجو</div>
              </div>
              <div className="bg-primary/5 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary">{result.totalResults}</div>
                <div className="text-xs text-muted-foreground">نتیجه</div>
              </div>
              <div className="bg-primary/5 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary">{result.pagesRead}</div>
                <div className="text-xs text-muted-foreground">صفحه خوانده شده</div>
              </div>
              <div className="bg-primary/5 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary">{result.sourcesCreated}</div>
                <div className="text-xs text-muted-foreground">منبع جدید</div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-lg">
              {result.summary}
            </p>

            <p className="text-xs text-muted-foreground">
              منابع جدید در حال پردازش در پس‌زمینه هستند. پس از اتمام، موجودیت‌ها و ادعاهای جدید در بخش‌های مربوطه قابل مشاهده خواهند بود.
            </p>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setResult(null);
                setGoal("");
              }}
            >
              شروع دوباره
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
