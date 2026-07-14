"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Boxes, Quote, FileBarChart, Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { timeAgo } from "@/lib/fa";
import { toast } from "sonner";

export function WorkspaceBrowser() {
  const { setWorkspace } = useAppStore();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: api.workspaces.list,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; researchGoal?: string }) =>
      api.workspaces.create(data),
    onSuccess: (ws) => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      setOpen(false);
      setWorkspace(ws.id);
      toast.success("Workspace ساخته شد");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "خطا"),
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [researchGoal, setResearchGoal] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name,
      description: description || undefined,
      researchGoal: researchGoal || undefined,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Workspaceهای تحقیقاتی</h1>
          <p className="text-muted-foreground mt-1">
            هر Workspace یک پروژه تحقیقاتی ایزوله با دانش‌نامه اختصاصی خود است
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 ml-2" />
              Workspace جدید
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ایجاد Workspace تحقیقاتی</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="ws-name">نام *</Label>
                <Input
                  id="ws-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثلاً: تحقیق روی اکوسیستم استارتاپی"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ws-goal">هدف تحقیق</Label>
                <Textarea
                  id="ws-goal"
                  value={researchGoal}
                  onChange={(e) => setResearchGoal(e.target.value)}
                  placeholder="چه سؤالی می‌خواهید پاسخ دهید؟"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ws-desc">توضیحات</Label>
                <Textarea
                  id="ws-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="توضیح کوتاه درباره پروژه"
                  rows={2}
                />
              </div>
              <Button type="submit" disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin ml-2" /> در حال ساخت...
                  </>
                ) : (
                  "ایجاد Workspace"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-6 animate-spin ml-2" />
          در حال بارگذاری...
        </div>
      ) : workspaces && workspaces.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <Card
              key={ws.id}
              className="cursor-pointer hover:shadow-md hover:border-primary transition-all group"
              onClick={() => setWorkspace(ws.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base group-hover:text-primary transition-colors">
                    {ws.name}
                  </CardTitle>
                  <ArrowLeft className="size-4 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all" />
                </div>
                {ws.researchGoal && (
                  <CardDescription className="line-clamp-2">
                    {ws.researchGoal}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3 text-xs">
                  <Stat icon={FileText} count={ws._count?.sources || 0} label="منبع" />
                  <Stat icon={Boxes} count={ws._count?.entities || 0} label="موجودیت" />
                  <Stat icon={Quote} count={ws._count?.claims || 0} label="ادعا" />
                  <Stat icon={FileBarChart} count={ws._count?.reports || 0} label="گزارش" />
                </div>
                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                  به‌روزرسانی {timeAgo(ws.updatedAt)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-16">
            <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="size-7 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">اولین Workspace خود را بسازید</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
              یک Workspace ایجاد کنید، اسناد را آپلود کنید و اجازه دهید هوش مصنوعی
              دانش‌نامه‌ای ساختاریافته برای شما بسازد.
            </p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4 ml-2" />
              شروع کنید
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon: Icon, count, label }: { icon: React.ElementType; count: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon className="size-3.5" />
      <span className="font-medium text-foreground">{count}</span>
      <span>{label}</span>
    </div>
  );
}
