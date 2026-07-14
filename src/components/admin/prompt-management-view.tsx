"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  FileCode2, Loader2, Edit3, History, RotateCcw, ChevronLeft,
} from "lucide-react";
import { formatFaDateTime } from "@/lib/fa";
import { toast } from "sonner";
import type { PromptTemplate } from "@/types";

export function PromptManagementView() {
  const [editKey, setEditKey] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState<string | null>(null);

  const { data: prompts, isLoading } = useQuery({
    queryKey: ["prompts"],
    queryFn: api.admin.prompts.list,
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">مدیریت Prompt Templates</h2>
        <p className="text-sm text-muted-foreground">
          Promptهای سیستم با versioning — هر تغییر نسخه جدیدی می‌سازد
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin ml-2" />
          در حال بارگذاری...
        </div>
      ) : prompts && prompts.length > 0 ? (
        <div className="grid gap-3">
          {prompts.map((prompt) => (
            <Card key={prompt.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileCode2 className="size-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium">{prompt.name}</span>
                        <Badge variant="outline" className="text-xs">v{prompt.version}</Badge>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded" dir="ltr">{prompt.key}</code>
                      </div>
                      {prompt.description && (
                        <p className="text-sm text-muted-foreground mb-2">{prompt.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>دما: {prompt.temperature}</span>
                        <span>Max tokens: {prompt.maxTokens}</span>
                        {prompt.variables.length > 0 && (
                          <span>متغیرها: {prompt.variables.join("، ")}</span>
                        )}
                        <span>به‌روزرسانی: {formatFaDateTime(prompt.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditKey(prompt.key)}
                    >
                      <Edit3 className="size-3.5 ml-1" />
                      ویرایش
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setHistoryKey(prompt.key)}
                    >
                      <History className="size-3.5 ml-1" />
                      تاریخچه
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <p className="text-sm text-muted-foreground">promptی بارگذاری نشده</p>
          </CardContent>
        </Card>
      )}

      {editKey && (
        <EditPromptDialog
          promptKey={editKey}
          onClose={() => setEditKey(null)}
        />
      )}

      {historyKey && (
        <HistoryDialog
          promptKey={historyKey}
          onClose={() => setHistoryKey(null)}
        />
      )}
    </div>
  );
}

function EditPromptDialog({ promptKey, onClose }: { promptKey: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: prompt } = useQuery({
    queryKey: ["prompt", promptKey],
    queryFn: () => api.admin.prompts.list().then((all) => all.find((p) => p.key === promptKey)),
  });

  const [systemPrompt, setSystemPrompt] = useState("");
  const [description, setDescription] = useState("");
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(2000);

  // Sync when prompt loads
  useState(() => {
    if (prompt) {
      setSystemPrompt(prompt.systemPrompt);
      setDescription(prompt.description || "");
      setTemperature(prompt.temperature);
      setMaxTokens(prompt.maxTokens);
    }
  });

  const updateMutation = useMutation({
    mutationFn: () => api.admin.prompts.update(promptKey, {
      systemPrompt,
      description,
      temperature,
      maxTokens,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prompts"] });
      qc.invalidateQueries({ queryKey: ["prompt", promptKey] });
      toast.success("Prompt به‌روزرسانی شد — نسخه جدید ساخته شد");
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "خطا"),
  });

  if (!prompt) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ویرایش Prompt — {prompt.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            هر تغییر یک نسخه جدید می‌سازد. نسخه قبلی برای rollback حفظ می‌شود.
          </div>
          <div className="space-y-2">
            <Label>توضیحات</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>System Prompt</Label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={12}
              className="font-mono text-xs"
              dir="ltr"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>دمای تولید (Temperature)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>حداکثر توکن</Label>
              <Input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                dir="ltr"
              />
            </div>
          </div>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="w-full"
          >
            {updateMutation.isPending ? (
              <><Loader2 className="size-4 animate-spin ml-2" />در حال ذخیره...</>
            ) : (
              "ذخیره نسخه جدید"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ promptKey, onClose }: { promptKey: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: versions, isLoading } = useQuery({
    queryKey: ["prompt-versions", promptKey],
    queryFn: () => api.admin.prompts.versions(promptKey),
  });

  const rollbackMutation = useMutation({
    mutationFn: (version: number) => api.admin.prompts.rollback(promptKey, version),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prompts"] });
      qc.invalidateQueries({ queryKey: ["prompt-versions", promptKey] });
      toast.success("به نسخه قبلی بازگردانده شد");
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "خطا"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تاریخچه نسخه‌های Prompt</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : versions && versions.length > 0 ? (
          <div className="space-y-2 pt-2">
            {versions.map((v: PromptTemplate) => (
              <Card key={v.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={v.isActive ? "default" : "secondary"}>
                        v{v.version}
                      </Badge>
                      {v.isActive && (
                        <Badge variant="outline" className="text-xs text-emerald-700">
                          فعال
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground mr-auto">
                        {formatFaDateTime(v.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 font-mono" dir="ltr">
                      {v.systemPrompt.slice(0, 150)}...
                    </p>
                  </div>
                  {!v.isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rollbackMutation.mutate(v.version)}
                      disabled={rollbackMutation.isPending}
                    >
                      <RotateCcw className="size-3.5 ml-1" />
                      بازگشت
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8">
            نسخه‌ای ثبت نشده
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
