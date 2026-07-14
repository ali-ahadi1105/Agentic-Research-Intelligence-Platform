"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Trash2, Loader2, CheckCheck } from "lucide-react";
import { formatFaDateTime, timeAgo } from "@/lib/fa";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  job_completed: "تکمیل پردازش",
  mention: "اشاره",
  research_update: "به‌روزرسانی تحقیق",
  system_alert: "هشدار سیستم",
};

const TYPE_COLORS: Record<string, string> = {
  job_completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  mention: "bg-blue-100 text-blue-800 border-blue-200",
  research_update: "bg-purple-100 text-purple-800 border-purple-200",
  system_alert: "bg-amber-100 text-amber-800 border-amber-200",
};

export function NotificationsView() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.admin.notifications.list,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.admin.notifications.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("همه اعلان‌ها خوانده شدند");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.admin.notifications.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">اعلان‌ها</h2>
          <p className="text-sm text-muted-foreground">
            {data?.unreadCount || 0} اعلان خوانده‌نشده از مجموع {data?.notifications?.length || 0}
          </p>
        </div>
        {data && data.unreadCount > 0 && (
          <Button
            variant="outline"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck className="size-4 ml-2" />
            خواندن همه
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin ml-2" />
          در حال بارگذاری...
        </div>
      ) : data && data.notifications.length > 0 ? (
        <div className="space-y-2">
          {data.notifications.map((n) => (
            <Card key={n.id} className={n.isRead ? "opacity-60" : ""}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${
                  n.isRead ? "bg-muted" : "bg-primary/10"
                }`}>
                  <Bell className={`size-4 ${n.isRead ? "text-muted-foreground" : "text-primary"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="outline" className={`text-xs ${TYPE_COLORS[n.type] || ""}`}>
                      {TYPE_LABELS[n.type] || n.type}
                    </Badge>
                    {!n.isRead && (
                      <span className="size-2 rounded-full bg-primary" title="خوانده‌نشده" />
                    )}
                    <span className="text-xs text-muted-foreground mr-auto">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteMutation.mutate(n.id)}
                >
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <BellOff className="size-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">اعلانی وجود ندارد</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
