"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { formatFaDateTime, formatNumber } from "@/lib/fa";
import { toast } from "sonner";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function SettingsView() {
  const { currentWorkspaceId, setWorkspace } = useAppStore();
  const { user, organization } = useAuthStore();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [researchGoal, setResearchGoal] = useState("");

  const { data: workspace } = useQuery({
    queryKey: ["workspace", currentWorkspaceId],
    queryFn: () => api.workspaces.get(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  });

  // Sync local state when workspace changes
  useState(() => {
    if (workspace) {
      setName(workspace.name);
      setDescription(workspace.description || "");
      setResearchGoal(workspace.researchGoal || "");
    }
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.workspaces.update(currentWorkspaceId!, {
        name,
        description: description || undefined,
        researchGoal: researchGoal || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace", currentWorkspaceId] });
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("تنظیمات ذخیره شد");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.workspaces.delete(currentWorkspaceId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      setWorkspace(null);
      toast.success("Workspace حذف شد");
    },
  });

  if (!currentWorkspaceId) return null;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">تنظیمات</h1>
        <p className="text-muted-foreground mt-1">پیکربندی Workspace و حساب کاربری</p>
      </div>

      {/* User profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">پروفایل کاربری</CardTitle>
          <CardDescription>اطلاعات حساب شما</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-muted-foreground">نام:</div>
            <div className="col-span-2 font-medium">{user?.name}</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-muted-foreground">ایمیل:</div>
            <div className="col-span-2 font-medium" dir="ltr">{user?.email}</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-muted-foreground">نقش:</div>
            <div className="col-span-2">
              <Badge variant="outline">{user?.role}</Badge>
            </div>
          </div>
          {organization && (
            <div className="grid grid-cols-3 gap-3">
              <div className="text-muted-foreground">سازمان:</div>
              <div className="col-span-2 font-medium">{organization.name}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workspace settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">تنظیمات Workspace</CardTitle>
          <CardDescription>ویرایش نام، توضیحات و هدف تحقیق</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-name">نام Workspace</Label>
            <Input
              id="ws-name"
              value={name || workspace?.name || ""}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-desc">توضیحات</Label>
            <Textarea
              id="ws-desc"
              value={description || workspace?.description || ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-goal">هدف تحقیق</Label>
            <Textarea
              id="ws-goal"
              value={researchGoal || workspace?.researchGoal || ""}
              onChange={(e) => setResearchGoal(e.target.value)}
              rows={2}
              placeholder="سؤال اصلی که این تحقیق به آن پاسخ می‌دهد"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            ایجاد: {formatFaDateTime(workspace?.createdAt || new Date())} ·
            به‌روزرسانی: {formatFaDateTime(workspace?.updatedAt || new Date())}
          </div>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "در حال ذخیره..." : "ذخیره تغییرات"}
          </Button>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base text-red-600">منطقه خطر</CardTitle>
          <CardDescription>عملیات‌های غیرقابل بازگشت</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 p-3 bg-red-50 rounded-lg">
            <div>
              <div className="font-medium text-sm">حذف Workspace</div>
              <div className="text-xs text-muted-foreground">
                تمام اسناد، موجودیت‌ها، ادعاها و گفتگوها حذف خواهند شد
              </div>
            </div>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm("آیا مطمئن هستید؟ این عمل غیرقابل بازگشت است.")) {
                  deleteMutation.mutate();
                }
              }}
            >
              حذف Workspace
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
