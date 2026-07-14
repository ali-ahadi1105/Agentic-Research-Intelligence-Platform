"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  KeyRound, Plus, Loader2, Copy, Check, Trash2, AlertCircle, Clock,
} from "lucide-react";
import { formatFaDateTime, timeAgo } from "@/lib/fa";
import { toast } from "sonner";

export function ApiKeysView() {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();

  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: api.admin.apiKeys.list,
  });

  const createMutation = useMutation({
    mutationFn: () => api.admin.apiKeys.create(name),
    onSuccess: (data) => {
      setCreatedKey(data.key || null);
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setName("");
      toast.success("کلید API ساخته شد");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "خطا"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.admin.apiKeys.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("کلید غیرفعال شد");
    },
  });

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">کلیدهای API</h2>
          <p className="text-sm text-muted-foreground">
            مدیریت کلیدهای API برای دسترسی برنامه‌نویسی به سیستم
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setCreatedKey(null);
            setCopied(false);
          }
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 ml-2" />کلید جدید</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ایجاد کلید API جدید</DialogTitle>
            </DialogHeader>
            {!createdKey ? (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="key-name">نام کلید</Label>
                  <Input
                    id="key-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثلاً: اسکریپت تست"
                  />
                </div>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!name || createMutation.isPending}
                  className="w-full"
                >
                  {createMutation.isPending ? (
                    <><Loader2 className="size-4 animate-spin ml-2" />در حال ساخت...</>
                  ) : (
                    "ایجاد کلید"
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900">هشدار مهم</p>
                    <p className="text-amber-800 mt-1">
                      این کلید فقط یک بار نمایش داده می‌شود. آن را در جای امن ذخیره کنید.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>کلید API</Label>
                  <div className="flex gap-2">
                    <Input
                      value={createdKey}
                      readOnly
                      dir="ltr"
                      className="font-mono text-xs"
                    />
                    <Button onClick={handleCopy} size="icon">
                      {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                    </Button>
                  </div>
                </div>
                <Button onClick={() => setCreateOpen(false)} className="w-full">
                  تمام
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin ml-2" />
          در حال بارگذاری...
        </div>
      ) : keys && keys.length > 0 ? (
        <div className="space-y-2">
          {keys.map((key) => (
            <Card key={key.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <KeyRound className="size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{key.name}</span>
                    <Badge variant={key.isActive ? "default" : "secondary"} className="text-xs">
                      {key.isActive ? "فعال" : "غیرفعال"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    <code dir="ltr" className="bg-muted px-1.5 py-0.5 rounded">{key.keyPrefix}...</code>
                    {key.user && <span>ساخته‌شده توسط: {key.user.name || key.user.email}</span>}
                    {key.lastUsedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        آخرین استفاده: {timeAgo(key.lastUsedAt)}
                      </span>
                    )}
                    <span>ایجاد: {formatFaDateTime(key.createdAt)}</span>
                  </div>
                </div>
                {key.isActive && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deactivateMutation.mutate(key.id)}
                    title="غیرفعال کردن"
                  >
                    <Trash2 className="size-4 text-red-500" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <KeyRound className="size-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">هنوز کلید API ساخته نشده است</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
