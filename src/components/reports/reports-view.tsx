"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileBarChart, Sparkles, Trash2, ArrowLeft, FileDown, FileType, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { REPORT_TYPE_LABELS, formatFaDateTime } from "@/lib/fa";
import { exportReportToPDF } from "@/lib/export";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function ReportsView() {
  const { currentWorkspaceId, selectedReportId, setSelectedReport } = useAppStore();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [reportType, setReportType] = useState("executive_summary");
  const qc = useQueryClient();

  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports", currentWorkspaceId],
    queryFn: () => api.reports.list(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  });

  const { data: selectedReport } = useQuery({
    queryKey: ["report", currentWorkspaceId, selectedReportId],
    queryFn: () => api.reports.get(currentWorkspaceId!, selectedReportId!),
    enabled: !!currentWorkspaceId && !!selectedReportId,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.reports.generate(currentWorkspaceId!, reportType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", currentWorkspaceId] });
      toast.success("گزارش ساخته شد");
      setGenerateOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "خطا"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.reports.delete(currentWorkspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", currentWorkspaceId] });
      if (selectedReportId) setSelectedReport(null);
      toast.success("گزارش حذف شد");
    },
  });

  if (selectedReportId && selectedReport) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedReport(null)}>
            <ArrowLeft className="size-4 ml-2" />
            بازگشت
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const blob = new Blob([selectedReport.contentMarkdown], { type: "text/markdown" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${selectedReport.title}.md`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <FileDown className="size-4 ml-2" />
            Markdown
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const toastId = toast.loading("در حال آماده‌سازی PDF...");
              try {
                await exportReportToPDF(
                  selectedReport.title,
                  selectedReport.contentMarkdown,
                  selectedReport.title
                );
                toast.success("فایل PDF دانلود شد", { id: toastId });
              } catch (err) {
                console.error("PDF Export Error:", err);
                toast.error("خطا در بارگذاری فونت یا تولید PDF", { id: toastId });
              }
            }}
          >
            <FileType className="size-4 ml-2" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => deleteMutation.mutate(selectedReport.id)}
          >
            <Trash2 className="size-4 text-red-500" />
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">
                {REPORT_TYPE_LABELS[selectedReport.type] || selectedReport.type}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatFaDateTime(selectedReport.createdAt)}
              </span>
            </div>
            <CardTitle className="text-xl mt-2">{selectedReport.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose-fa max-w-none">
              <ReactMarkdown>{selectedReport.contentMarkdown}</ReactMarkdown>
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
          <h1 className="text-2xl font-bold">گزارش‌ها</h1>
          <p className="text-muted-foreground mt-1">
            گزارش‌های تحلیلی مبتنی بر دانش‌نامه — با استناد به شواهد
          </p>
        </div>
        <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Sparkles className="size-4 ml-2" />
              تولید گزارش
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تولید گزارش جدید</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>نوع گزارش</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REPORT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                گزارش با استفاده از دانش فعلی workspace (موجودیت‌ها، ادعاها، شواهد، رویدادها) تولید می‌شود.
                برای کیفیت بهتر، ابتدا اسناد را پردازش کنید.
              </div>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="w-full"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="size-4 animate-spin ml-2" /> در حال تولید... این چند ثانیه طول می‌کشد</>
                ) : (
                  <><Sparkles className="size-4 ml-2" /> تولید گزارش</>
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
      ) : reports && reports.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => (
            <Card
              key={report.id}
              className="cursor-pointer hover:shadow-md hover:border-primary transition-all group"
              onClick={() => setSelectedReport(report.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileBarChart className="size-5 text-primary" />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {REPORT_TYPE_LABELS[report.type] || report.type}
                  </Badge>
                </div>
                <CardTitle className="text-base mt-3 line-clamp-2 group-hover:text-primary transition-colors">
                  {report.title}
                </CardTitle>
                <CardDescription className="text-xs">
                  {formatFaDateTime(report.createdAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xs text-muted-foreground line-clamp-3 mb-3">
                  {report.contentMarkdown.replace(/[#*-]/g, "").slice(0, 200)}...
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate(report.id);
                  }}
                >
                  <Trash2 className="size-3.5 ml-1 text-red-500" />
                  حذف
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-16">
            <FileBarChart className="size-12 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold text-lg mb-2">هنوز گزارشی تولید نشده</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
              با یک کلیک، گزارش‌های تحلیلی حرفه‌ای از دانش‌نامه خود بسازید
            </p>
            <Button onClick={() => setGenerateOpen(true)}>
              <Sparkles className="size-4 ml-2" />
              تولید اولین گزارش
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
