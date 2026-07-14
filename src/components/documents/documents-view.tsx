"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  FileText, Upload, Link2, Loader2, Plus,
  RotateCw, Trash2, FileUp, Clock, CheckCircle2, AlertCircle, Sparkles, Eye,
} from "lucide-react";
import { SOURCE_TYPE_LABELS, SOURCE_STATUS_LABELS, formatBytes, timeAgo } from "@/lib/fa";
import { toast } from "sonner";
import type { Source } from "@/types";

export function DocumentsView() {
  const { currentWorkspaceId } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [viewSource, setViewSource] = useState<Source | null>(null);
  const qc = useQueryClient();

  const { data: sources, isLoading } = useQuery({
    queryKey: ["documents", currentWorkspaceId],
    queryFn: () => api.documents.list(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.some((s) => s.status === "processing" || s.status === "pending")) {
        return 3000;
      }
      return false;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => api.documents.upload(currentWorkspaceId!, files),
    onSuccess: (data) => {
      toast.success(`${data.sources.length} فایل آپلود شد`);
      qc.invalidateQueries({ queryKey: ["documents", currentWorkspaceId] });
      qc.invalidateQueries({ queryKey: ["stats", currentWorkspaceId] });
      setUploadOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "خطا در آپلود"),
  });

  const urlMutation = useMutation({
    mutationFn: (url: string) => api.documents.importUrl(currentWorkspaceId!, url),
    onSuccess: () => {
      toast.success("صفحه وب دریافت و پردازش آغاز شد");
      qc.invalidateQueries({ queryKey: ["documents", currentWorkspaceId] });
      setUrlInput("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "خطا"),
  });

  const manualMutation = useMutation({
    mutationFn: () => api.documents.addManualNote(currentWorkspaceId!, manualTitle, manualContent),
    onSuccess: () => {
      toast.success("یادداشت دستی اضافه شد");
      qc.invalidateQueries({ queryKey: ["documents", currentWorkspaceId] });
      setManualTitle("");
      setManualContent("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "خطا"),
  });

  const reprocessMutation = useMutation({
    mutationFn: (sourceId: string) => api.documents.reprocess(currentWorkspaceId!, sourceId),
    onSuccess: () => {
      toast.success("پردازش مجدد آغاز شد");
      qc.invalidateQueries({ queryKey: ["documents", currentWorkspaceId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sourceId: string) => api.documents.delete(currentWorkspaceId!, sourceId),
    onSuccess: () => {
      toast.success("منبع حذف شد");
      qc.invalidateQueries({ queryKey: ["documents", currentWorkspaceId] });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      uploadMutation.mutate(files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      uploadMutation.mutate(files);
    }
  };

  if (!currentWorkspaceId) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">اسناد و منابع</h1>
          <p className="text-muted-foreground mt-1">
            اسناد را آپلود کنید، از وب دریافت کنید، یا یادداشت دستی اضافه کنید
          </p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 ml-2" />
              افزودن منبع
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>افزودن منبع جدید</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="upload">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="upload">آپلود فایل</TabsTrigger>
                <TabsTrigger value="url">صفحه وب</TabsTrigger>
                <TabsTrigger value="manual">یادداشت</TabsTrigger>
              </TabsList>

              {/* Upload */}
              <TabsContent value="upload" className="space-y-4 pt-4">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.txt,.md,.csv,.html,.docx,.xlsx,.pptx"
                  />
                  <FileUp className="size-10 mx-auto mb-3 text-muted-foreground" />
                  <div className="font-medium mb-1">فایل‌ها را اینجا بکشید</div>
                  <div className="text-sm text-muted-foreground">
                    یا برای انتخاب کلیک کنید — حداکثر ۱۰ مگابایت
                  </div>
                </div>
                {uploadMutation.isPending && (
                  <div className="flex items-center justify-center py-4 text-sm">
                    <Loader2 className="size-4 animate-spin ml-2" />
                    در حال آپلود...
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  فرمت‌های پشتیبانی‌شده: PDF، TXT، Markdown، CSV، HTML
                </div>
              </TabsContent>

              {/* URL import */}
              <TabsContent value="url" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="url-input">آدرس صفحه</Label>
                  <Input
                    id="url-input"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/article"
                    dir="ltr"
                  />
                </div>
                <Button
                  onClick={() => urlInput && urlMutation.mutate(urlInput)}
                  disabled={!urlInput || urlMutation.isPending}
                  className="w-full"
                >
                  {urlMutation.isPending ? (
                    <><Loader2 className="size-4 animate-spin ml-2" /> در حال دریافت...</>
                  ) : (
                    <><Link2 className="size-4 ml-2" /> دریافت و پردازش</>
                  )}
                </Button>
              </TabsContent>

              {/* Manual note */}
              <TabsContent value="manual" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-title">عنوان</Label>
                  <Input
                    id="manual-title"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="مثلاً: یادداشت ملاقات با سرمایه‌گذار"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-content">محتوا</Label>
                  <Textarea
                    id="manual-content"
                    value={manualContent}
                    onChange={(e) => setManualContent(e.target.value)}
                    placeholder="متن یادداشت..."
                    rows={6}
                  />
                </div>
                <Button
                  onClick={() => manualTitle && manualContent && manualMutation.mutate()}
                  disabled={!manualTitle || !manualContent || manualMutation.isPending}
                  className="w-full"
                >
                  {manualMutation.isPending ? (
                    <><Loader2 className="size-4 animate-spin ml-2" /> در حال افزودن...</>
                  ) : (
                    <><Plus className="size-4 ml-2" /> افزودن یادداشت</>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Source list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-6 animate-spin ml-2" />
          در حال بارگذاری...
        </div>
      ) : sources && sources.length > 0 ? (
        <div className="space-y-3">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              workspaceId={currentWorkspaceId}
              onView={() => setViewSource(source)}
              onReprocess={() => reprocessMutation.mutate(source.id)}
              onDelete={() => deleteMutation.mutate(source.id)}
            />
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-16">
            <Sparkles className="size-12 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold text-lg mb-2">هنوز منبعی اضافه نشده</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              اولین سند را آپلود کنید یا از وب دریافت کنید تا پردازش دانش‌نامه آغاز شود
            </p>
          </CardContent>
        </Card>
      )}

      {/* Document Content Viewer */}
      {viewSource && (
        <DocumentViewerDialog
          source={viewSource}
          workspaceId={currentWorkspaceId}
          onClose={() => setViewSource(null)}
        />
      )}
    </div>
  );
}

function SourceCard({
  source, workspaceId, onView, onReprocess, onDelete,
}: {
  source: Source;
  workspaceId: string;
  onView: () => void;
  onReprocess: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="size-5 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3
                className="font-medium truncate cursor-pointer hover:text-primary transition-colors"
                onClick={onView}
              >
                {source.title}
              </h3>
              <Badge variant="outline" className="text-xs">
                {SOURCE_TYPE_LABELS[source.type] || source.type}
              </Badge>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {source.document?.wordCount && (
                <span>{source.document.wordCount.toLocaleString("fa-IR")} کلمه</span>
              )}
              {source.sizeBytes && <span>{formatBytes(source.sizeBytes)}</span>}
              {source.language && <span>زبان: {source.language}</span>}
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {timeAgo(source.createdAt)}
              </span>
              {source._count?.evidence !== undefined && source._count.evidence > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {source._count.evidence} شاهد
                </Badge>
              )}
            </div>

            {source.status === "processing" && (
              <div className="mt-2 flex items-center gap-2">
                <Progress value={source.processingProgress} className="flex-1 h-1.5" />
                <span className="text-xs text-muted-foreground">{source.processingProgress}%</span>
              </div>
            )}

            {source.status === "failed" && source.processingError && (
              <div className="mt-2 text-xs text-red-600 flex items-start gap-1">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <span>{source.processingError}</span>
              </div>
            )}

            {source.sourceUrl && (
              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline mt-1 inline-block truncate max-w-full"
                dir="ltr"
              >
                {source.sourceUrl}
              </a>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {source.status === "processed" && (
              <CheckCircle2 className="size-4 text-emerald-500" />
            )}
            <Button size="icon" variant="ghost" onClick={onView} title="مشاهده محتوا">
              <Eye className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onReprocess} title="پردازش مجدد">
              <RotateCw className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} title="حذف">
              <Trash2 className="size-4 text-red-500" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Document Content Viewer Dialog
 * Fetches the full document content and displays it.
 */
function DocumentViewerDialog({
  source,
  workspaceId,
  onClose,
}: {
  source: Source;
  workspaceId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["document-content", workspaceId, source.id],
    queryFn: () => api.documents.get(workspaceId, source.id),
    enabled: !!source.id,
  });

  const content = data?.document?.content || "";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            {source.title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pb-3 border-b">
          <Badge variant="outline">
            {SOURCE_TYPE_LABELS[source.type] || source.type}
          </Badge>
          {data?.document?.wordCount && (
            <span>{data.document.wordCount.toLocaleString("fa-IR")} کلمه</span>
          )}
          {data?.document?.language && <span>زبان: {data.document.language}</span>}
          <Badge variant={source.status === "processed" ? "default" : "secondary"}>
            {SOURCE_STATUS_LABELS[source.status] || source.status}
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : content ? (
          <div className="flex-1 overflow-y-auto max-h-[55vh]">
            <pre className="text-sm whitespace-pre-wrap leading-relaxed font-sans p-2">
              {content}
            </pre>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="size-10 mx-auto mb-3 opacity-50" />
            <p>محتوای متنی برای این سند استخراج نشده است</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
