"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ENTITY_TYPE_LABELS, CLAIM_STATUS_LABELS, CLAIM_STATUS_COLORS } from "@/lib/fa";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";
import { useAppStore } from "@/stores/app-store";

export function SearchResults({ workspaceId }: { workspaceId: string }) {
  const [query, setQuery] = useState("");
  const { setView, setSelectedEntity } = useAppStore();
  const trimmed = query.trim();

  const { data, isLoading } = useQuery({
    queryKey: ["search", workspaceId, trimmed],
    queryFn: () => api.search.query(workspaceId, trimmed),
    enabled: trimmed.length >= 2,
  });

  const hasResults =
    data &&
    (data.entities.length > 0 ||
      data.claims.length > 0 ||
      data.evidence.length > 0 ||
      data.sources.length > 0 ||
      (data.chunks?.length || 0) > 0);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجو در موجودیت‌ها، ادعاها، شواهد و منابع..."
          className="pr-10"
          autoFocus
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin ml-2" />
          در حال جستجو...
        </div>
      )}

      {!isLoading && trimmed.length >= 2 && !hasResults && (
        <div className="text-center py-12 text-muted-foreground">
          نتیجه‌ای برای «{trimmed}» یافت نشد
        </div>
      )}

      {!isLoading && trimmed.length < 2 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          حداقل ۲ حرف تایپ کنید
        </div>
      )}

      {data && hasResults && (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {data.chunks?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                نتایج معنایی ({data.chunks.length})
              </h3>
              <div className="space-y-2">
                {data.chunks.map((c: { chunkId: string; content: string; score: number; sourceTitle?: string; sourceType?: string }) => (
                  <Card key={c.chunkId} className="p-3 bg-accent/5 border-accent/30">
                    <p className="text-sm line-clamp-3 mb-2">{c.content}</p>
                    <div className="flex items-center justify-between gap-2">
                      {c.sourceTitle && (
                        <span className="text-xs text-muted-foreground truncate">
                          — {c.sourceTitle}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-xs shrink-0">
                        شباهت: {Math.round(c.score * 100)}%
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {data.entities.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                موجودیت‌ها ({data.entities.length})
              </h3>
              <div className="space-y-2">
                {data.entities.map((e) => (
                  <Card
                    key={e.id}
                    className="p-3 cursor-pointer hover:border-primary"
                    onClick={() => {
                      setSelectedEntity(e.id);
                      setView("entities");
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{e.name}</div>
                      <Badge variant="outline">
                        {ENTITY_TYPE_LABELS[e.type] || e.type}
                      </Badge>
                    </div>
                    {e.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {e.description}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {data.claims.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                ادعاها ({data.claims.length})
              </h3>
              <div className="space-y-2">
                {data.claims.map((c) => (
                  <Card
                    key={c.id}
                    className="p-3 cursor-pointer hover:border-primary"
                    onClick={() => setView("claims")}
                  >
                    <p className="text-sm">{c.statement}</p>
                    <div className="mt-2">
                      <Badge
                        variant="outline"
                        className={CLAIM_STATUS_COLORS[c.status]}
                      >
                        {CLAIM_STATUS_LABELS[c.status] || c.status}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {data.evidence.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                شواهد ({data.evidence.length})
              </h3>
              <div className="space-y-2">
                {data.evidence.map((ev) => (
                  <Card key={ev.id} className="p-3 bg-muted/30 border-dashed">
                    <p className="text-sm italic line-clamp-2">«{ev.excerpt}»</p>
                    {ev.source && (
                      <p className="text-xs text-muted-foreground mt-1">
                        — {ev.source.title}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {data.sources.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                منابع ({data.sources.length})
              </h3>
              <div className="space-y-2">
                {data.sources.map((s) => (
                  <Card
                    key={s.id}
                    className="p-3 cursor-pointer hover:border-primary"
                    onClick={() => setView("documents")}
                  >
                    <div className="text-sm font-medium">{s.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {s.type}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
