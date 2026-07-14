"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar } from "lucide-react";
import { TIMELINE_TYPE_LABELS, formatFaDate } from "@/lib/fa";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

const TYPE_COLORS: Record<string, string> = {
  founding: "#059669",
  funding: "#7c3aed",
  acquisition: "#dc2626",
  partnership: "#0891b2",
  product_launch: "#d97706",
  leadership_change: "#db2777",
  milestone: "#65a30d",
  event: "#475569",
};

export function TimelineView() {
  const { currentWorkspaceId } = useAppStore();
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: events, isLoading } = useQuery({
    queryKey: ["timeline", currentWorkspaceId, typeFilter],
    queryFn: () =>
      api.timeline.list(currentWorkspaceId!, typeFilter !== "all" ? typeFilter : undefined),
    enabled: !!currentWorkspaceId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-6 animate-spin ml-2" />
        در حال بارگذاری خط زمانی...
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="text-center py-16">
          <Calendar className="size-12 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-semibold text-lg mb-2">رویدادی ثبت نشده</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            رویدادهای دارای تاریخ به‌طور خودکار از اسناد استخراج می‌شوند
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort events by date (nulls last)
  const sorted = [...events].sort((a, b) => {
    if (!a.eventDate && !b.eventDate) return 0;
    if (!a.eventDate) return 1;
    if (!b.eventDate) return -1;
    return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">خط زمانی</h1>
          <p className="text-muted-foreground mt-1">
            رویدادهای کلیدی به ترتیب زمانی — {sorted.length} رویداد
          </p>
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="همه انواع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه انواع</SelectItem>
            {Object.entries(TIMELINE_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative pr-6">
        {/* Vertical line */}
        <div className="absolute right-[7px] top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-6">
          {sorted.map((event) => {
            const color = TYPE_COLORS[event.type] || "#475569";
            return (
              <div key={event.id} className="relative pr-6">
                {/* Dot */}
                <div
                  className="absolute right-0 top-1.5 size-4 rounded-full border-2 border-background"
                  style={{ background: color }}
                />

                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{ borderColor: color, color }}
                        >
                          {TIMELINE_TYPE_LABELS[event.type] || event.type}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {event.eventDate ? formatFaDate(event.eventDate) : "تاریخ نامشخص"}
                        </span>
                        {event.eventDateStr && event.eventDateStr !== event.eventDate && (
                          <span className="text-xs text-muted-foreground">
                            ({event.eventDateStr})
                          </span>
                        )}
                      </div>
                      {event.confidence < 0.7 && (
                        <Badge variant="secondary" className="text-xs">
                          اطمینان: {Math.round(event.confidence * 100)}%
                        </Badge>
                      )}
                    </div>

                    <h3 className="font-medium mb-1">{event.title}</h3>
                    {event.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {event.description}
                      </p>
                    )}

                    {event.entity && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        موجودیت مرتبط:{" "}
                        <span className="font-medium text-foreground">{event.entity.name}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
