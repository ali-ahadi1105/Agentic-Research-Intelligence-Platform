"use client";

import { useState, useMemo } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, Node, Edge,
  Position, Handle, useNodesState, useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ENTITY_TYPE_LABELS, ENTITY_TYPE_COLORS, RELATIONSHIP_LABELS,
  formatNumber,
} from "@/lib/fa";
import { Loader2, Network, Activity, GitBranch, Users2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const nodeTypes = {
  entity: EntityNode,
};

export function KnowledgeGraphView() {
  const { currentWorkspaceId, selectedEntityId, setSelectedEntity } = useAppStore();
  const [typeFilter, setTypeFilter] = useState("all");
  const [pathSource, setPathSource] = useState("");
  const [pathTarget, setPathTarget] = useState("");
  const [pathResult, setPathResult] = useState<{ path: { entityId: string; name: string; type: string }[]; edges: { type: string; direction: string }[]; length: number } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["graph", currentWorkspaceId, typeFilter],
    queryFn: () =>
      api.graph.get(currentWorkspaceId!, {
        type: typeFilter !== "all" ? typeFilter : undefined,
        minConfidence: 0.3,
        limit: 80,
      }),
    enabled: !!currentWorkspaceId,
  });

  const { data: analytics } = useQuery({
    queryKey: ["graph-analytics", currentWorkspaceId],
    queryFn: () => api.graph.analytics(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  });

  const findPathMutation = useMutation({
    mutationFn: () => api.graph.shortestPath(currentWorkspaceId!, pathSource, pathTarget),
    onSuccess: (result) => {
      setPathResult(result);
    },
  });

  const nodes: Node[] = useMemo(() => {
    if (!data) return [];
    // If we have a path result, highlight path nodes
    const pathNodeIds = pathResult ? new Set(pathResult.path.map((p) => p.entityId)) : new Set<string>();
    return data.nodes.map((n, i) => {
      const angle = (i / data.nodes.length) * 2 * Math.PI;
      const radius = 200 + (i % 3) * 80;
      return {
        id: n.id,
        type: "entity",
        position: {
          x: 400 + radius * Math.cos(angle),
          y: 300 + radius * Math.sin(angle),
        },
        data: {
          ...n,
          isSelected: n.id === selectedEntityId,
          isOnPath: pathNodeIds.has(n.id),
        },
      };
    });
  }, [data, selectedEntityId, pathResult]);

  const edges: Edge[] = useMemo(() => {
    if (!data) return [];
    const pathEdgeSet = pathResult ? new Set(
      pathResult.path.slice(1).map((_, i) => `${pathResult.path[i].entityId}|${pathResult.path[i + 1].entityId}`)
    ) : new Set<string>();
    return data.edges.map((e) => {
      const isOnPath = pathEdgeSet.has(`${e.source}|${e.target}`) || pathEdgeSet.has(`${e.target}|${e.source}`);
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: RELATIONSHIP_LABELS[e.type] || e.type,
        animated: isOnPath || e.confidence > 0.7,
        style: {
          stroke: isOnPath ? "#dc2626" : e.confidence > 0.7 ? "#059669" : e.confidence > 0.5 ? "#d97706" : "#94a3b8",
          strokeWidth: isOnPath ? 3 : 1 + e.confidence * 1.5,
        },
        labelStyle: { fontSize: 10, fill: "#64748b" },
        labelBgStyle: { fill: "#fff" },
      };
    });
  }, [data, pathResult]);

  const [nodesState, setNodesState, onNodesChange] = useNodesState(nodes);
  const [edgesState, setEdgesState, onEdgesChange] = useEdgesState(edges);

  useMemo(() => {
    setNodesState(nodes);
    setEdgesState(edges);
  }, [nodes, edges, setNodesState, setEdgesState]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-6 animate-spin ml-2" />
        در حال بارگذاری گراف...
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="text-center py-16">
          <Network className="size-12 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-semibold text-lg mb-2">گراف دانش خالی است</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            پس از استخراج موجودیت‌ها و روابط از اسناد، گراف به‌صورت خودکار ساخته می‌شود
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">گراف دانش</h1>
          <p className="text-muted-foreground mt-1">
            {data.stats.nodeCount} گره، {data.stats.edgeCount} یال
          </p>
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="همه انواع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه انواع</SelectItem>
            {Object.entries(ENTITY_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        {/* Left sidebar: Analytics */}
        <div className="lg:col-span-1 space-y-4">
          {analytics && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="size-4" />
                    آمار گراف
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Stat label="گره‌ها" value={analytics.nodeCount} />
                  <Stat label="یال‌ها" value={analytics.edgeCount} />
                  <Stat label="چگالی" value={`${(analytics.density * 100).toFixed(1)}%`} />
                  <Stat label="میانگین درجه" value={analytics.avgDegree.toFixed(2)} />
                  <Stat label="اجزای همبند" value={analytics.communities.length} />
                  <Stat label="موجودیت‌های ایزوله" value={analytics.isolatedEntities.length} />
                </CardContent>
              </Card>

              {analytics.topEntitiesByDegree.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="size-4" />
                      موجودیت‌های پرارتباط
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {analytics.topEntitiesByDegree.slice(0, 5).map((e, i) => (
                      <div key={e.entityId} className="flex items-center gap-2 text-xs">
                        <span className="size-5 rounded bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                          {i + 1}
                        </span>
                        <span
                          className="font-medium cursor-pointer hover:text-primary truncate"
                          onClick={() => setSelectedEntity(e.entityId)}
                        >
                          {e.name}
                        </span>
                        <Badge variant="secondary" className="text-[10px] mr-auto shrink-0">
                          {e.degree}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {analytics.communities.length > 1 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users2 className="size-4" />
                      اجتماعات
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {analytics.communities.slice(0, 5).map((c) => (
                      <div key={c.id} className="text-xs">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-medium">اجتماع {c.id + 1}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {c.entities.length} عضو
                          </Badge>
                        </div>
                        <div className="text-muted-foreground truncate">
                          {c.entities.slice(0, 3).map((e) => e.name).join("، ")}
                          {c.entities.length > 3 && ` +${c.entities.length - 3}`}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Center: Graph */}
        <Card className="lg:col-span-2">
          <CardContent className="p-0 h-[600px]">
            <ReactFlow
              nodes={nodesState}
              edges={edgesState}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setSelectedEntity(node.id === selectedEntityId ? null : node.id)}
              fitView
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{ type: "smoothstep" }}
            >
              <Background color="#e2e8f0" gap={16} />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={(n) => ENTITY_TYPE_COLORS[(n.data as { type?: string })?.type || ""] || "#94a3b8"}
                maskColor="rgba(0,0,0,0.05)"
                pannable
                zoomable
              />
            </ReactFlow>
          </CardContent>
        </Card>

        {/* Right sidebar: Shortest Path Finder */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <GitBranch className="size-4" />
                یابنده مسیر
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">از موجودیت</Label>
                <Select value={pathSource} onValueChange={setPathSource}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="انتخاب..." /></SelectTrigger>
                  <SelectContent>
                    {data.nodes.map((n) => (
                      <SelectItem key={n.id} value={n.id}>{n.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">به موجودیت</Label>
                <Select value={pathTarget} onValueChange={setPathTarget}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="انتخاب..." /></SelectTrigger>
                  <SelectContent>
                    {data.nodes.map((n) => (
                      <SelectItem key={n.id} value={n.id}>{n.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={!pathSource || !pathTarget || pathSource === pathTarget || findPathMutation.isPending}
                onClick={() => findPathMutation.mutate()}
              >
                {findPathMutation.isPending ? (
                  <><Loader2 className="size-3.5 animate-spin ml-1" />جستجو...</>
                ) : (
                  "یافتن کوتاه‌ترین مسیر"
                )}
              </Button>

              {pathResult === null && !findPathMutation.isPending && pathSource && pathTarget && (
                <div className="text-xs text-muted-foreground text-center py-2">
                  مسیری یافت نشد
                </div>
              )}

              {pathResult && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="text-xs font-medium text-muted-foreground">
                    طول مسیر: {pathResult.length} گام
                  </div>
                  <div className="space-y-1">
                    {pathResult.path.map((node, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                          {i + 1}
                        </span>
                        <span className="font-medium">{node.name}</span>
                        <Badge variant="outline" className="text-[9px]">
                          {ENTITY_TYPE_LABELS[node.type] || node.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Type breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">توزیع انواع</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {Object.entries(data.stats.typeBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2 text-xs">
                    <div
                      className="size-3 rounded-sm shrink-0"
                      style={{ background: ENTITY_TYPE_COLORS[type] || "#6b7280" }}
                    />
                    <span className="flex-1">{ENTITY_TYPE_LABELS[type] || type}</span>
                    <span className="font-medium">{formatNumber(count)}</span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{typeof value === "number" ? formatNumber(value) : value}</span>
    </div>
  );
}

function EntityNode({ data }: { data: { label: string; type: string; description?: string | null; confidence: number; status: string; isSelected?: boolean; isOnPath?: boolean } }) {
  const color = ENTITY_TYPE_COLORS[data.type] || "#6b7280";
  const isSelected = data.isSelected;
  const isOnPath = data.isOnPath;

  return (
    <div
      className="px-3 py-2 rounded-lg border-2 bg-white shadow-sm transition-all min-w-[100px] max-w-[200px]"
      style={{
        borderColor: isOnPath ? "#dc2626" : isSelected ? color : `${color}40`,
        borderWidth: isOnPath || isSelected ? 3 : 2,
        boxShadow: isOnPath
          ? `0 0 0 4px ${"#dc2626"}20`
          : isSelected
            ? `0 0 0 4px ${color}20`
            : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      <div className="flex items-center gap-1.5 mb-1">
        <div className="size-2 rounded-full" style={{ background: color }} />
        <span className="text-[10px] text-muted-foreground">
          {ENTITY_TYPE_LABELS[data.type] || data.type}
        </span>
      </div>
      <div className="font-medium text-xs text-center leading-tight">{data.label}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: color }} />
    </div>
  );
}

// Import at bottom to avoid circular deps
import { useMutation } from "@tanstack/react-query";
