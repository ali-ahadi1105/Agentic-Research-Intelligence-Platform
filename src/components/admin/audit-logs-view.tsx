"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ScrollText, User } from "lucide-react";
import { formatFaDateTime } from "@/lib/fa";

const ACTION_LABELS: Record<string, string> = {
  create: "ایجاد",
  update: "به‌روزرسانی",
  delete: "حذف",
  approve: "تأیید",
  reject: "رد",
  login: "ورود",
  logout: "خروج",
  permission_change: "تغییر دسترسی",
  model_change: "تغییر مدل",
  settings_change: "تغییر تنظیمات",
  workspace_access: "دسترسی به workspace",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-800 border-emerald-200",
  update: "bg-blue-100 text-blue-800 border-blue-200",
  delete: "bg-red-100 text-red-800 border-red-200",
  approve: "bg-teal-100 text-teal-800 border-teal-200",
  reject: "bg-orange-100 text-orange-800 border-orange-200",
  login: "bg-gray-100 text-gray-800 border-gray-200",
  logout: "bg-gray-100 text-gray-800 border-gray-200",
  permission_change: "bg-purple-100 text-purple-800 border-purple-200",
  model_change: "bg-amber-100 text-amber-800 border-amber-200",
  settings_change: "bg-yellow-100 text-yellow-800 border-yellow-200",
  workspace_access: "bg-cyan-100 text-cyan-800 border-cyan-200",
};

export function AuditLogsView() {
  const [action, setAction] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", action],
    queryFn: () => api.admin.auditLogs({ action: action !== "all" ? action : undefined, limit: 100 }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">لاگ‌های ممیزی</h2>
          <p className="text-sm text-muted-foreground">
            ثبت تمام عملیات‌های مهم سیستم — {data?.total || 0} رویداد
          </p>
        </div>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="همه عملیات‌ها" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه عملیات‌ها</SelectItem>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin ml-2" />
          در حال بارگذاری...
        </div>
      ) : data && data.logs.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {data.logs.map((log) => (
                <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-muted/30">
                  <div className="size-8 rounded bg-muted flex items-center justify-center shrink-0">
                    <ScrollText className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className={`text-xs ${ACTION_COLORS[log.action] || ""}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                      {log.resourceType && (
                        <Badge variant="secondary" className="text-xs">
                          {log.resourceType}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground mr-auto">
                        {formatFaDateTime(log.createdAt)}
                      </span>
                    </div>
                    {log.user && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <User className="size-3" />
                        {log.user.name || log.user.email}
                      </div>
                    )}
                    {log.details && log.details !== "{}" && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">جزئیات</summary>
                        <pre className="mt-1 p-2 bg-muted rounded text-[10px] overflow-x-auto" dir="ltr">
                          {JSON.stringify(JSON.parse(log.details), null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <p className="text-sm text-muted-foreground">هیچ لاگی ثبت نشده است</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
