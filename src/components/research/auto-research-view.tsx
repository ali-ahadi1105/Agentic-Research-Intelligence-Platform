"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Sparkles, Globe, BookOpen, FileText, Clock, History, ExternalLink, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatFaDateTime } from "@/lib/fa";

interface ResearchRun {
  id: string;
  goal: string | null;
  queryCount: number;
  resultCount: number;
  pagesRead: number;
  sourcesCreated: number;
  sources: string;
  summary: string | null;
  status: string;
  startedAt: string;
  durationMs: number;
}

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
  const qc = useQueryClient();

  const { data: history } = useQuery({
    queryKey: ["auto-research-history", currentWorkspaceId],
    queryFn: () => api.autoResearch.list(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  });

  const runMutation = useMutation({
    mutationFn: () =>
      api.autoResearch.run(currentWorkspaceId!, goal || undefined, 3, 5),
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["auto-research-history", currentWorkspaceId] });
      toast.success("تحقیق خودکار با موفقیت انجام شد");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "خطا در اجرای تحقیق خودکار"),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">تحقیق خودکار</h1>
        <p className="text-muted-foreground mt-1">
          جستجوی هوشمند اینترنتی — صفحات مرتبط را پیدا کرده، متن آنها را استخراج و به دانشنامه اضافه میکند
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="size-5" />
            شروع تحقیق جدید
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal">هدف تحقیق (اختیاری)</Label>
            <Textarea
              id="goal"
              placeholder="مثال: آخرین وضعیت بازار گواهی دیجیتال در ایران..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 bg-muted/30 p-2 rounded">
              <Globe className="size-4" />
              <span>۳ جستجو</span>
            </div>
            <div className="flex items-center gap-2 bg-muted/30 p-2 rounded">
              <BookOpen className="size-4" />
              <span>۵ صفحه</span>
            </div>
            <div className="flex items-center gap-2 bg-muted/30 p-2 rounded">
              <FileText className="size-4" />
              <span>منبع جدید</span>
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
                در حال تحقیق...
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
            <p className="text-sm text-muted-foreground bg-muted/20 p-3 rounded-lg">{result.summary}</p>
            <Button variant="outline" size="sm" onClick={() => { setResult(null); setGoal(""); }}>
              شروع دوباره
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Research History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="size-5" />
            تاریخچه تحقیقات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">تاکنون تحقیقی انجام نشده است</p>
          ) : (
            history.map((run: ResearchRun) => {
              const sources = (() => {
                try { return JSON.parse(run.sources); } catch { return []; }
              })();
              return (
                <Card key={run.id} className="border border-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{run.goal || "تحقیق عمومی"}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatFaDateTime(run.startedAt)}</p>
                      </div>
                      <Badge variant={run.status === "completed" ? "default" : "outline"} className="shrink-0">
                        {run.status === "completed" ? "تکمیل" : run.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span>{run.queryCount} جستجو</span>
                      <span>{run.resultCount} نتیجه</span>
                      <span>{run.sourcesCreated} منبع</span>
                      <span>{(run.durationMs / 1000).toFixed(0)} ثانیه</span>
                    </div>

                    {sources.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">منابع ایجاد شده:</p>
                        {sources.map((s: { id: string; title: string; url: string }, i: number) => (
                          <div key={s.id} className="flex items-center gap-2 text-xs">
                            <FileText className="size-3 shrink-0 text-muted-foreground" />
                            <span className="truncate">{s.title}</span>
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-primary hover:underline"
                            >
                              <ExternalLink className="size-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
