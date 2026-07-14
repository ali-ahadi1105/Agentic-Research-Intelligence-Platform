"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  FileText, Boxes, Quote, Network, Calendar, FileBarChart,
  MessageSquare, Loader2, Sparkles, FlaskConical, AlertCircle, CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { ENTITY_TYPE_LABELS, SOURCE_STATUS_LABELS, timeAgo, formatNumber } from "@/lib/fa";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ResearchPlan } from "@/types";

export function WorkspaceOverview() {
  const { currentWorkspaceId, setView } = useAppStore();
  const [seedOpen, setSeedOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planGoal, setPlanGoal] = useState("");
  const qc = useQueryClient();

  const { data: workspace } = useQuery({
    queryKey: ["workspace", currentWorkspaceId],
    queryFn: () => api.workspaces.get(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats", currentWorkspaceId],
    queryFn: () => api.workspaces.stats(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
    refetchInterval: 5000,
  });

  const seedMutation = useMutation({
    mutationFn: () => api.seed.workspace(currentWorkspaceId!),
    onSuccess: (data) => {
      toast.success(data.message);
      setSeedOpen(false);
      qc.invalidateQueries({ queryKey: ["stats", currentWorkspaceId] });
      qc.invalidateQueries({ queryKey: ["documents", currentWorkspaceId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "خطا"),
  });

  const continuousUpdateMutation = useMutation({
    mutationFn: () => api.continuousUpdate.trigger(currentWorkspaceId!),
    onSuccess: (data) => {
      toast.success(data.message || "به‌روزرسانی تدریجی کامل شد");
      qc.invalidateQueries({ queryKey: ["stats", currentWorkspaceId] });
      qc.invalidateQueries({ queryKey: ["entities", currentWorkspaceId] });
      qc.invalidateQueries({ queryKey: ["graph", currentWorkspaceId] });
      qc.invalidateQueries({ queryKey: ["claims", currentWorkspaceId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "خطا"),
  });

  const planMutation = useMutation({
    mutationFn: () => api.plan.generate(currentWorkspaceId!, planGoal || workspace?.researchGoal || ""),
    onSuccess: (plan: ResearchPlan) => {
      toast.success("برنامه پژوهش ساخته شد");
      // Store plan in state for display
      setPlanResult(plan);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "خطا"),
  });

  const [planResult, setPlanResult] = useState<ResearchPlan | null>(null);

  if (!currentWorkspaceId) return null;

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-6 animate-spin ml-2" />
        در حال بارگذاری...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{workspace?.name}</h1>
          {workspace?.researchGoal && (
            <p className="text-muted-foreground mt-1">{workspace.researchGoal}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setPlanOpen(true)}>
            <FlaskConical className="size-4 ml-2" />
            برنامه پژوهش
          </Button>
          <Button
            variant="outline"
            onClick={() => continuousUpdateMutation.mutate()}
            disabled={continuousUpdateMutation.isPending}
            title="ادغام موجودیت‌های تکراری، محاسبه مجدد اطمینان، بازسازی ایندکس جستجو"
          >
            {continuousUpdateMutation.isPending ? (
              <Loader2 className="size-4 ml-2 animate-spin" />
            ) : (
              <RefreshCw className="size-4 ml-2" />
            )}
            به‌روزرسانی تدریجی
          </Button>
          <Button
            variant="outline"
            onClick={() => setSeedOpen(true)}
            disabled={seedMutation.isPending}
          >
            <Sparkles className="size-4 ml-2" />
            افزودن داده نمونه
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard icon={FileText} label="منابع" value={stats.counts.sources}
          onClick={() => setView("documents")} />
        <StatCard icon={Boxes} label="موجودیت‌ها" value={stats.counts.entities}
          onClick={() => setView("entities")} />
        <StatCard icon={Network} label="روابط" value={stats.counts.relationships}
          onClick={() => setView("graph")} />
        <StatCard icon={Quote} label="ادعاها" value={stats.counts.claims}
          onClick={() => setView("claims")} />
        <StatCard icon={CheckCircle2} label="شواهد" value={stats.counts.evidence} />
        <StatCard icon={Calendar} label="رویدادها" value={stats.counts.timeline}
          onClick={() => setView("timeline")} />
        <StatCard icon={FileBarChart} label="گزارش‌ها" value={stats.counts.reports}
          onClick={() => setView("reports")} />
        <StatCard icon={MessageSquare} label="گفتگوها" value={stats.counts.conversations}
          onClick={() => setView("chat")} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Claims status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">وضعیت ادعاها</CardTitle>
            <CardDescription>توزیع وضعیت تأیید ادعاها</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ClaimStatusRow label="در انتظار" count={stats.claims.pending} total={stats.counts.claims} color="bg-yellow-500" />
            <ClaimStatusRow label="تأیید شده" count={stats.claims.verified} total={stats.counts.claims} color="bg-emerald-500" />
            <ClaimStatusRow label="رد شده" count={stats.claims.rejected} total={stats.counts.claims} color="bg-red-500" />
          </CardContent>
        </Card>

        {/* Entity types breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">انواع موجودیت‌ها</CardTitle>
            <CardDescription>توزیع موجودیت‌ها بر اساس نوع</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.entityByType.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                هنوز موجودیتی استخراج نشده است
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {stats.entityByType
                  .sort((a, b) => b._count - a._count)
                  .map((item) => (
                    <div key={item.type} className="flex items-center justify-between text-sm">
                      <span>{ENTITY_TYPE_LABELS[item.type] || item.type}</span>
                      <Badge variant="secondary">{formatNumber(item._count)}</Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source processing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">پردازش منابع</CardTitle>
            <CardDescription>وضعیت pipeline پردازش اسناد</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.sourceStats.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                منبعی آپلود نشده است
              </div>
            ) : (
              <div className="space-y-3">
                {stats.sourceStats.map((s) => (
                  <div key={s.status} className="flex items-center justify-between text-sm">
                    <span>{SOURCE_STATUS_LABELS[s.status] || s.status}</span>
                    <Badge variant="secondary">{formatNumber(s._count)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">فعالیت اخیر</CardTitle>
          <CardDescription>آخرین منابع پردازش‌شده</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="size-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">
                هنوز سندی آپلود نشده است
              </p>
              <Button size="sm" onClick={() => setView("documents")}>
                <FileText className="size-4 ml-2" />
                آپلود سند
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentActivity.map((src) => (
                <div key={src.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <FileText className="size-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{src.title}</div>
                    <div className="text-xs text-muted-foreground">{timeAgo(src.createdAt)}</div>
                  </div>
                  {src.status === "processing" ? (
                    <div className="flex items-center gap-2 text-xs">
                      <Progress value={src.processingProgress} className="w-20 h-1.5" />
                      <span className="text-muted-foreground w-8">{src.processingProgress}%</span>
                    </div>
                  ) : (
                    <Badge
                      variant={src.status === "processed" ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {SOURCE_STATUS_LABELS[src.status] || src.status}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seed dialog */}
      <AlertDialog open={seedOpen} onOpenChange={setSeedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>افزودن داده نمونه</AlertDialogTitle>
            <AlertDialogDescription>
              این اقدام ۳ سند نمونه درباره اکوسیستم یک استارتاپ فرضی به Workspace اضافه می‌کند
              و پردازش پس‌زمینه آغاز می‌شود. این عمل برای آشنایی با قابلیت‌های سیستم مفید است.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? "در حال افزودن..." : "افزودن داده نمونه"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Plan dialog */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تولید برنامه پژوهش</DialogTitle>
            <DialogDescription>
              هوش مصنوعی یک برنامه پژوهش ساختاریافته بر اساس هدف شما تولید می‌کند
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan-goal">هدف پژوهش</Label>
              <Textarea
                id="plan-goal"
                value={planGoal || workspace?.researchGoal || ""}
                onChange={(e) => setPlanGoal(e.target.value)}
                placeholder="مثلاً: شناخت موقعیت رقابتی شرکت X در بازار هوش مصنوعی"
                rows={3}
              />
            </div>
            <Button
              onClick={() => planMutation.mutate()}
              disabled={planMutation.isPending || !planGoal.trim()}
              className="w-full"
            >
              {planMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin ml-2" />
                  در حال تولید برنامه...
                </>
              ) : (
                <>
                  <FlaskConical className="size-4 ml-2" />
                  تولید برنامه
                </>
              )}
            </Button>

            {planResult && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold">برنامه پژوهش پیشنهادی</h3>

                {planResult.researchQuestions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">سؤالات پژوهش</h4>
                    <ul className="list-disc pr-5 space-y-1 text-sm">
                      {planResult.researchQuestions.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  </div>
                )}

                {planResult.priorityTopics.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">موضوعات اولویت‌دار</h4>
                    <ul className="list-decimal pr-5 space-y-1 text-sm">
                      {planResult.priorityTopics.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  </div>
                )}

                {planResult.keywords.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">کلمات کلیدی</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {planResult.keywords.map((k, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{k}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {planResult.hypotheses.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">فرضیه‌ها</h4>
                    <ul className="list-disc pr-5 space-y-1 text-sm">
                      {planResult.hypotheses.map((h, i) => <li key={i}>{h}</li>)}
                    </ul>
                  </div>
                )}

                <div className="flex gap-4 text-sm pt-2 border-t">
                  <div>
                    <span className="text-muted-foreground">مدت زمان:</span>{" "}
                    <span className="font-medium">{planResult.estimatedDuration} ساعت</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">هزینه:</span>{" "}
                    <span className="font-medium">${planResult.estimatedCost}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, onClick,
}: { icon: React.ElementType; label: string; value: number; onClick?: () => void }) {
  return (
    <Card
      className={onClick ? "cursor-pointer hover:shadow-md hover:border-primary transition-all" : ""}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Icon className="size-3.5" />
          <span className="text-xs">{label}</span>
        </div>
        <div className="text-2xl font-bold">{formatNumber(value)}</div>
      </CardContent>
    </Card>
  );
}

function ClaimStatusRow({ label, count, total, color }: {
  label: string; count: number; total: number; color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-medium">{formatNumber(count)}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
