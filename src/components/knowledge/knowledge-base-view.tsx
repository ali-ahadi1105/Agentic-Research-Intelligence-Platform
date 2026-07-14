"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Boxes, Quote, FileSearch, Loader2, Plus, Check, X, AlertTriangle,
  Search, Trash2, Merge, Network, FileDown, FileType,
} from "lucide-react";
import {
  ENTITY_TYPE_LABELS, ENTITY_TYPE_COLORS,
  CLAIM_STATUS_LABELS, CLAIM_STATUS_COLORS,
  confidenceLabel, confidenceColor, timeAgo,
} from "@/lib/fa";
import { toast } from "sonner";
import { exportToCSV, exportTableToPDF } from "@/lib/export";
import type { Entity, Claim, Evidence } from "@/types";

export function KnowledgeBaseView() {
  return (
    <Tabs defaultValue="entities" className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold mb-1">دانش‌نامه</h1>
        <p className="text-muted-foreground">
          موجودیت‌ها، ادعاها و شواهد استخراج‌شده — با قابلیت ویرایش و اعتبارسنجی
        </p>
      </div>
      <TabsList>
        <TabsTrigger value="entities"><Boxes className="size-4 ml-2" />موجودیت‌ها</TabsTrigger>
        <TabsTrigger value="claims"><Quote className="size-4 ml-2" />ادعاها</TabsTrigger>
        <TabsTrigger value="evidence"><FileSearch className="size-4 ml-2" />شواهد</TabsTrigger>
      </TabsList>
      <TabsContent value="entities"><EntitiesTab /></TabsContent>
      <TabsContent value="claims"><ClaimsTab /></TabsContent>
      <TabsContent value="evidence"><EvidenceTab /></TabsContent>
    </Tabs>
  );
}

// ============================================================
// ENTITIES TAB
// ============================================================

function EntitiesTab() {
  const { currentWorkspaceId, setSelectedEntity, setView } = useAppStore();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [newEntity, setNewEntity] = useState({ name: "", type: "person", description: "" });

  const qc = useQueryClient();

  const { data: entities, isLoading } = useQuery({
    queryKey: ["entities", currentWorkspaceId, search, typeFilter],
    queryFn: () =>
      api.entities.list(currentWorkspaceId!, {
        search: search || undefined,
        type: typeFilter !== "all" ? typeFilter : undefined,
      }),
    enabled: !!currentWorkspaceId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Entity> }) =>
      api.entities.update(currentWorkspaceId!, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entities", currentWorkspaceId] });
      qc.invalidateQueries({ queryKey: ["graph", currentWorkspaceId] });
      toast.success("به‌روزرسانی شد");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.entities.delete(currentWorkspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entities", currentWorkspaceId] });
      toast.success("حذف شد");
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.entities.create(currentWorkspaceId!, newEntity),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entities", currentWorkspaceId] });
      toast.success("موجودیت جدید اضافه شد");
      setCreateOpen(false);
      setNewEntity({ name: "", type: "person", description: "" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="جستجوی موجودیت..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="همه انواع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه انواع</SelectItem>
            {Object.entries(ENTITY_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {entities && entities.length > 0 && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportToCSV(
                  entities.map((e) => ({
                    name: e.name,
                    type: ENTITY_TYPE_LABELS[e.type] || e.type,
                    description: e.description || "",
                    confidence: Math.round(e.confidence * 100) + "%",
                    status: e.status,
                    aliases: (JSON.parse(e.aliases || "[]") as string[]).join("; "),
                    claims: e._count?.claimEntities || 0,
                    relationships: (e._count?.sourceRelations || 0) + (e._count?.targetRelations || 0),
                  })),
                  "entities-export",
                  [
                    { key: "name", label: "Name" },
                    { key: "type", label: "Type" },
                    { key: "description", label: "Description" },
                    { key: "confidence", label: "Confidence" },
                    { key: "status", label: "Status" },
                    { key: "aliases", label: "Aliases" },
                    { key: "claims", label: "Claims" },
                    { key: "relationships", label: "Relationships" },
                  ]
                );
                toast.success("فایل CSV دانلود شد");
              }}
            >
              <FileDown className="size-4 ml-1" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const toastId = toast.loading("در حال آماده‌سازی PDF...");
                try {
                  await exportTableToPDF(
                    "Entities Export",
                    [
                      { key: "name", label: "Name" },
                      { key: "type", label: "Type" },
                      { key: "confidence", label: "Confidence" },
                      { key: "status", label: "Status" },
                      { key: "claims", label: "Claims" },
                    ],
                    entities.map((e) => ({
                      name: e.name,
                      type: ENTITY_TYPE_LABELS[e.type] || e.type,
                      confidence: Math.round(e.confidence * 100) + "%",
                      status: e.status,
                      claims: e._count?.claimEntities || 0,
                    })),
                    "entities-export"
                  );
                  toast.success("فایل PDF دانلود شد", { id: toastId });
                } catch (err) {
                  console.error("PDF Export Error:", err);
                  toast.error("خطا در بارگذاری فونت یا تولید PDF", { id: toastId });
                }
              }}
            >
              <FileType className="size-4 ml-1" />
              PDF
            </Button>
          </>
        )}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 ml-2" />موجودیت جدید</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>افزودن موجودیت دستی</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>نام *</Label>
                <Input
                  value={newEntity.name}
                  onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>نوع</Label>
                <Select
                  value={newEntity.type}
                  onValueChange={(v) => setNewEntity({ ...newEntity, type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ENTITY_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>توضیحات</Label>
                <Textarea
                  value={newEntity.description}
                  onChange={(e) => setNewEntity({ ...newEntity, description: e.target.value })}
                  rows={3}
                />
              </div>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newEntity.name || createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending ? "در حال افزودن..." : "افزودن"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : entities && entities.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {entities.map((entity) => (
            <EntityCard
              key={entity.id}
              entity={entity}
              onVerify={() => updateMutation.mutate({ id: entity.id, data: { status: "verified", confidence: 1.0 } })}
              onReject={() => updateMutation.mutate({ id: entity.id, data: { status: "rejected" } })}
              onDelete={() => deleteMutation.mutate(entity.id)}
              onClick={() => { setSelectedEntity(entity.id); setView("graph"); }}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="موجودیتی یافت نشد"
          description="با آپلود اسناد، موجودیت‌ها به‌طور خودکار استخراج می‌شوند"
        />
      )}
    </div>
  );
}

function EntityCard({
  entity, onVerify, onReject, onDelete, onClick,
}: {
  entity: Entity;
  onVerify: () => void;
  onReject: () => void;
  onDelete: () => void;
  onClick?: () => void;
}) {
  const aliases = JSON.parse(entity.aliases || "[]") as string[];
  const color = ENTITY_TYPE_COLORS[entity.type] || "#6b7280";

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="size-10 rounded-lg flex items-center justify-center shrink-0 text-white font-bold"
            style={{ background: color }}
          >
            {entity.name[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="font-medium cursor-pointer hover:text-primary"
                onClick={onClick}
              >
                {entity.name}
              </h3>
              <Badge variant="outline" className="text-xs" style={{ borderColor: color, color }}>
                {ENTITY_TYPE_LABELS[entity.type] || entity.type}
              </Badge>
            </div>
            {entity.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {entity.description}
              </p>
            )}
            {aliases.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {aliases.slice(0, 3).map((a, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>اطمینان: {Math.round(entity.confidence * 100)}%</span>
              <span>{entity._count?.claimEntities || 0} ادعا</span>
              <span>{(entity._count?.sourceRelations || 0) + (entity._count?.targetRelations || 0)} رابطه</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity">
          {entity.status !== "verified" && (
            <Button size="sm" variant="ghost" onClick={onVerify}>
              <Check className="size-3.5 ml-1 text-emerald-600" />تأیید
            </Button>
          )}
          {entity.status !== "rejected" && (
            <Button size="sm" variant="ghost" onClick={onReject}>
              <X className="size-3.5 ml-1 text-red-600" />رد
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="size-3.5 ml-1" />حذف
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// CLAIMS TAB
// ============================================================

function ClaimsTab() {
  const { currentWorkspaceId } = useAppStore();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const qc = useQueryClient();

  const { data: claims, isLoading } = useQuery({
    queryKey: ["claims", currentWorkspaceId, statusFilter],
    queryFn: () =>
      api.claims.list(currentWorkspaceId!, {
        status: statusFilter !== "all" ? statusFilter : undefined,
      }),
    enabled: !!currentWorkspaceId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Claim> }) =>
      api.claims.update(currentWorkspaceId!, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["claims", currentWorkspaceId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.claims.delete(currentWorkspaceId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["claims", currentWorkspaceId] });
      toast.success("ادعا حذف شد");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="همه وضعیت‌ها" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه وضعیت‌ها</SelectItem>
            {Object.entries(CLAIM_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {claims && claims.length > 0 && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportToCSV(
                  claims.map((c) => ({
                    statement: c.statement,
                    type: c.type,
                    confidence: Math.round(c.confidence * 100) + "%",
                    status: CLAIM_STATUS_LABELS[c.status] || c.status,
                    authoredBy: c.authoredBy,
                    createdAt: new Date(c.createdAt).toLocaleString("en-GB"),
                    entities: (c.entities || []).map((ce) => ce.entity.name).join("; "),
                    evidenceCount: (c.evidence || []).length,
                  })),
                  "claims-export",
                  [
                    { key: "statement", label: "Statement" },
                    { key: "type", label: "Type" },
                    { key: "confidence", label: "Confidence" },
                    { key: "status", label: "Status" },
                    { key: "authoredBy", label: "Author" },
                    { key: "createdAt", label: "Created" },
                    { key: "entities", label: "Entities" },
                    { key: "evidenceCount", label: "Evidence Count" },
                  ]
                );
                toast.success("فایل CSV دانلود شد");
              }}
            >
              <FileDown className="size-4 ml-1" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const toastId = toast.loading("در حال آماده‌سازی PDF...");
                try {
                  await exportTableToPDF(
                    "Claims Export",
                    [
                      { key: "statement", label: "Statement" },
                      { key: "confidence", label: "Confidence" },
                      { key: "status", label: "Status" },
                      { key: "evidenceCount", label: "Evidence" },
                    ],
                    claims.map((c) => ({
                      statement: c.statement.slice(0, 100),
                      confidence: Math.round(c.confidence * 100) + "%",
                      status: CLAIM_STATUS_LABELS[c.status] || c.status,
                      evidenceCount: (c.evidence || []).length,
                    })),
                    "claims-export"
                  );
                  toast.success("فایل PDF دانلود شد", { id: toastId });
                } catch (err) {
                  console.error("PDF Export Error:", err);
                  toast.error("خطا در بارگذاری فونت یا تولید PDF", { id: toastId });
                }
              }}
            >
              <FileType className="size-4 ml-1" />
              PDF
            </Button>
          </>
        )}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : claims && claims.length > 0 ? (
        <div className="space-y-3">
          {claims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              onVerify={() => updateMutation.mutate({ id: claim.id, data: { status: "verified" } })}
              onReject={() => updateMutation.mutate({ id: claim.id, data: { status: "rejected" } })}
              onDispute={() => updateMutation.mutate({ id: claim.id, data: { status: "disputed" } })}
              onDelete={() => deleteMutation.mutate(claim.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="ادعایی یافت نشد"
          description="پس از پردازش اسناد، ادعاها به‌طور خودکار با شواهد استخراج می‌شوند"
        />
      )}
    </div>
  );
}

function ClaimCard({
  claim, onVerify, onReject, onDispute, onDelete,
}: {
  claim: Claim;
  onVerify: () => void;
  onReject: () => void;
  onDispute: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="group">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge variant="outline" className={`text-xs ${CLAIM_STATUS_COLORS[claim.status]}`}>
                {CLAIM_STATUS_LABELS[claim.status] || claim.status}
              </Badge>
              <Badge variant="secondary" className={`text-xs ${confidenceColor(claim.confidence)}`}>
                اطمینان: {confidenceLabel(claim.confidence)}
              </Badge>
              {claim.authoredBy === "ai" ? (
                <Badge variant="outline" className="text-xs">استخراج‌شده با AI</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">دستی</Badge>
              )}
              <span className="text-xs text-muted-foreground mr-auto">{timeAgo(claim.createdAt)}</span>
            </div>

            <p
              className="text-sm leading-relaxed cursor-pointer hover:bg-muted/30 -mx-1 px-1 py-0.5 rounded"
              onClick={() => setExpanded(!expanded)}
            >
              {claim.statement}
            </p>

            {expanded && claim.evidence && claim.evidence.length > 0 && (
              <div className="mt-3 space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground">شواهد:</h4>
                {claim.evidence.map((ev) => (
                  <div key={ev.id} className="text-xs bg-muted/50 border-r-2 border-accent p-2 rounded">
                    <p className="italic mb-1">«{ev.excerpt}»</p>
                    {ev.source && (
                      <p className="text-muted-foreground">— {ev.source.title}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {expanded && claim.entities && claim.entities.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground">موجودیت‌های مرتبط:</span>
                {claim.entities.map((ce) => (
                  <Badge key={ce.entity.id} variant="outline" className="text-xs">
                    {ce.entity.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 mt-3 pt-3 border-t">
          {claim.status !== "verified" && (
            <Button size="sm" variant="ghost" onClick={onVerify}>
              <Check className="size-3.5 ml-1 text-emerald-600" />تأیید
            </Button>
          )}
          {claim.status !== "rejected" && (
            <Button size="sm" variant="ghost" onClick={onReject}>
              <X className="size-3.5 ml-1 text-red-600" />رد
            </Button>
          )}
          {claim.status !== "disputed" && (
            <Button size="sm" variant="ghost" onClick={onDispute}>
              <AlertTriangle className="size-3.5 ml-1 text-orange-600" />مورد اختلاف
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
            {expanded ? "بستن" : "مشاهده شواهد"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="mr-auto">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// EVIDENCE TAB
// ============================================================

function EvidenceTab() {
  const { currentWorkspaceId } = useAppStore();
  const { data: evidence, isLoading } = useQuery({
    queryKey: ["evidence", currentWorkspaceId],
    queryFn: () => api.evidence.list(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  });

  if (isLoading) return <LoadingState />;
  if (!evidence || evidence.length === 0) {
    return (
      <EmptyState
        title="شاهدی ثبت نشده"
        description="شواهد به‌طور خودکار از اسناد استخراج و به ادعاها متصل می‌شوند"
      />
    );
  }

  return (
    <div className="space-y-3">
      {evidence.map((ev) => (
        <EvidenceCard key={ev.id} evidence={ev} />
      ))}
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: Evidence }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="size-8 rounded bg-accent/10 flex items-center justify-center shrink-0">
            <FileSearch className="size-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm italic border-r-2 border-accent pr-3 mb-2">
              «{evidence.excerpt}»
            </p>
            {evidence.claim && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">ادعا:</span> {evidence.claim.statement}
              </p>
            )}
            {evidence.source && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">منبع:</span> {evidence.source.title}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs">
              <Badge variant="secondary" className={confidenceColor(evidence.confidence)}>
                اطمینان: {Math.round(evidence.confidence * 100)}%
              </Badge>
              <span className="text-muted-foreground">{timeAgo(evidence.createdAt)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Shared components
// ============================================================

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="size-6 animate-spin ml-2" />
      در حال بارگذاری...
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="text-center py-12">
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
      </CardContent>
    </Card>
  );
}
