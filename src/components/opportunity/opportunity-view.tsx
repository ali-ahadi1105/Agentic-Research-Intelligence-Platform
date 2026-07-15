"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Sparkles,
  Trash2,
  ArrowLeft,
  FileBarChart,
  FileType,
  Lightbulb,
  Building2,
  TrendingUp,
  Handshake,
  Map,
  AlertTriangle,
  Target,
  Megaphone,
  Users,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { formatFaDateTime } from "@/lib/fa";
import { exportReportToPDF } from "@/lib/export";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const OPPORTUNITY_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; description: string }
> = {
  organization_fit: {
    label: "تناسب سازمانی",
    icon: <Building2 className="size-4" />,
    description: "بررسی تناسب یک سازمان با نیازهای استراتژیک",
  },
  investment_fit: {
    label: "تناسب سرمایه‌گذاری",
    icon: <TrendingUp className="size-4" />,
    description: "تحلیل فرصت سرمایه‌گذاری، بازار، ریسک و بازده",
  },
  collaboration: {
    label: "فرصت همکاری",
    icon: <Handshake className="size-4" />,
    description: "شناسایی فرصت‌های مشارکت و همکاری",
  },
  entry_strategy: {
    label: "استراتژی ورود",
    icon: <Map className="size-4" />,
    description: "بهترین استراتژی ورود به بازار یا تعامل",
  },
  risk_analysis: {
    label: "تحلیل ریسک",
    icon: <AlertTriangle className="size-4" />,
    description: "شناسایی و ارزیابی ریسک‌های عملیاتی، مالی و بازار",
  },
  swot: {
    label: "تحلیل SWOT",
    icon: <Target className="size-4" />,
    description: "نقاط قوت، ضعف، فرصت‌ها و تهدیدها",
  },
  pitch: {
    label: "پیشنهاد پیچ",
    icon: <Megaphone className="size-4" />,
    description: "تولید متن پیشنهاد جذاب برای تعامل",
  },
  decision_makers: {
    label: "تصمیم‌گیرندگان",
    icon: <Users className="size-4" />,
    description: "شناسایی افراد کلیدی و نقش‌های تأثیرگذار",
  },
  general: {
    label: "تحلیل عمومی",
    icon: <Lightbulb className="size-4" />,
    description: "تحلیل جامع فرصت بر اساس دانش موجود",
  },
};

export function OpportunityView() {
  const {
    currentWorkspaceId,
    selectedOpportunityId,
    setSelectedOpportunity,
  } = useAppStore();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [analysisType, setAnalysisType] = useState("general");
  const qc = useQueryClient();

  const { data: analyses, isLoading } = useQuery({
    queryKey: ["opportunity", currentWorkspaceId],
    queryFn: () => api.opportunity.list(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  });

  const { data: selectedAnalysis } = useQuery({
    queryKey: ["opportunity", currentWorkspaceId, selectedOpportunityId],
    queryFn: () => api.opportunity.get(currentWorkspaceId!, selectedOpportunityId!),
    enabled: !!currentWorkspaceId && !!selectedOpportunityId,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.opportunity.generate(currentWorkspaceId!, analysisType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity", currentWorkspaceId] });
      toast.success("تحلیل فرصت ساخته شد");
      setGenerateOpen(false);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "خطا در تولید تحلیل"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.opportunity.delete(currentWorkspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity", currentWorkspaceId] });
      if (selectedOpportunityId) setSelectedOpportunity(null);
      toast.success("تحلیل حذف شد");
    },
  });

  // Detail view
  if (selectedOpportunityId && selectedAnalysis) {
    const config = OPPORTUNITY_TYPE_CONFIG[selectedAnalysis.type] || OPPORTUNITY_TYPE_CONFIG.general;
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedOpportunity(null)}
          >
            <ArrowLeft className="size-4 ml-2" />
            بازگشت
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const blob = new Blob([selectedAnalysis.contentMarkdown], {
                type: "text/markdown;charset=utf-8",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${selectedAnalysis.title}.md`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <FileBarChart className="size-4 ml-2" />
            Markdown
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const toastId = toast.loading("در حال آماده‌سازی PDF...");
              try {
                await exportReportToPDF(
                  selectedAnalysis.title,
                  selectedAnalysis.contentMarkdown,
                  selectedAnalysis.title
                );
                toast.success("فایل PDF دانلود شد", { id: toastId });
              } catch (err) {
                console.error("PDF Export Error:", err);
                toast.error("خطا در تولید PDF", { id: toastId });
              }
            }}
          >
            <FileType className="size-4 ml-2" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => deleteMutation.mutate(selectedAnalysis.id)}
          >
            <Trash2 className="size-4 text-red-500" />
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1">
                {config.icon}
                {config.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatFaDateTime(selectedAnalysis.createdAt)}
              </span>
            </div>
            <CardTitle className="text-xl mt-2">
              {selectedAnalysis.title}
            </CardTitle>
            {selectedAnalysis.summary && (
              <p className="text-muted-foreground text-sm mt-1">
                {selectedAnalysis.summary}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="prose-fa max-w-none">
              <ReactMarkdown>
                {selectedAnalysis.contentMarkdown}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">تحلیل فرصت</h1>
          <p className="text-muted-foreground mt-1">
            تحلیل‌های فرصت بر اساس دانش‌نامه — کشف فرصت‌های تجاری، سرمایه‌گذاری و
            همکاری
          </p>
        </div>
        <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Sparkles className="size-4 ml-2" />
              تحلیل جدید
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تحلیل فرصت جدید</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>نوع تحلیل</Label>
                <Select
                  value={analysisType}
                  onValueChange={setAnalysisType}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OPPORTUNITY_TYPE_CONFIG).map(
                      ([k, v]) => (
                        <SelectItem key={k} value={k}>
                          <span className="flex items-center gap-2">
                            {v.icon}
                            {v.label}
                          </span>
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {OPPORTUNITY_TYPE_CONFIG[analysisType]?.description}
                </p>
              </div>
              <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                تحلیل با استفاده از دانش فعلی workspace (موجودیت‌ها، ادعاها،
                شواهد، روابط) تولید می‌شود. برای کیفیت بهتر، ابتدا اسناد مرتبط را
                پردازش کنید.
              </div>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="w-full"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin ml-2" />
                    در حال تحلیل... این چند ثانیه طول می‌کشد
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 ml-2" />
                    شروع تحلیل
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-6 animate-spin ml-2" />
          در حال بارگذاری...
        </div>
      ) : analyses && analyses.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {analyses.map((analysis) => {
            const config =
              OPPORTUNITY_TYPE_CONFIG[analysis.type] ||
              OPPORTUNITY_TYPE_CONFIG.general;
            return (
              <Card
                key={analysis.id}
                className="cursor-pointer hover:shadow-md hover:border-primary transition-all group"
                onClick={() => setSelectedOpportunity(analysis.id)}
              >
                <CardHeader>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    {config.icon}
                    <span>{config.label}</span>
                  </div>
                  <CardTitle className="text-base group-hover:text-primary transition-colors line-clamp-2">
                    {analysis.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {analysis.summary || "بدون خلاصه"}
                  </p>
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <span>{formatFaDateTime(analysis.createdAt)}</span>
                    {analysis.confidence && (
                      <>
                        <span>·</span>
                        <span>اطمینان: {Math.round(analysis.confidence * 100)}%</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <Lightbulb className="size-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">هیچ تحلیلی وجود ندارد</h3>
          <p className="text-muted-foreground mb-6">
            برای شروع، یک نوع تحلیل را انتخاب کنید
          </p>
          <Button onClick={() => setGenerateOpen(true)}>
            <Sparkles className="size-4 ml-2" />
            اولین تحلیل
          </Button>
        </div>
      )}
    </div>
  );
}
