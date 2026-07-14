"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, User } from "lucide-react";
import { formatFaDateTime, timeAgo } from "@/lib/fa";
import { toast } from "sonner";
import { getRoleLabel, getAllRoles } from "@/lib/permissions-client";

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-800 border-purple-200",
  admin: "bg-emerald-100 text-emerald-800 border-emerald-200",
  research_manager: "bg-blue-100 text-blue-800 border-blue-200",
  analyst: "bg-amber-100 text-amber-800 border-amber-200",
  viewer: "bg-gray-100 text-gray-800 border-gray-200",
};

export function UsersView() {
  const qc = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ["org-members"],
    queryFn: api.admin.users.list,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      api.admin.users.updateRole(memberId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-members"] });
      toast.success("نقش کاربر به‌روزرسانی شد");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "خطا"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="size-6 animate-spin ml-2" />
        در حال بارگذاری...
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="text-center py-12">
          <p className="text-sm text-muted-foreground">کاربری یافت نشد</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">مدیریت کاربران</h2>
        <p className="text-sm text-muted-foreground">
          {members.length} عضو در سازمان — مدیریت نقش‌ها و دسترسی‌ها
        </p>
      </div>

      <div className="space-y-2">
        {members.map((m) => (
          <Card key={m.id}>
            <CardContent className="p-4 flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback>
                  {m.user.name?.[0] || m.user.email[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{m.user.name || "بدون نام"}</span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${ROLE_COLORS[m.role] || ""}`}
                  >
                    {getRoleLabel(m.role)}
                  </Badge>
                  {!m.user.isActive && (
                    <Badge variant="secondary" className="text-xs">غیرفعال</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                  <span dir="ltr">{m.user.email}</span>
                  {m.user.lastLoginAt && (
                    <span>آخرین ورود: {timeAgo(m.user.lastLoginAt)}</span>
                  )}
                  <span>عضویت: {formatFaDateTime(m.joinedAt)}</span>
                </div>
              </div>
              <Select
                value={m.role}
                onValueChange={(role) => updateRoleMutation.mutate({ memberId: m.id, role })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAllRoles().map((r) => (
                    <SelectItem key={r} value={r}>{getRoleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
