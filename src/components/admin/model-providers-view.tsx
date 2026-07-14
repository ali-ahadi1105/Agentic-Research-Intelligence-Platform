"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Cpu, Plus, Loader2, Trash2, CheckCircle2, XCircle, Star, Edit3,
} from "lucide-react";
import { toast } from "sonner";

interface ModelProviderInfo {
  id?: string;
  label: string;
  type: string;
  baseUrl?: string | null;
  chatModel: string;
  embeddingModel?: string | null;
  isActive: boolean;
  isDefault?: boolean;
  useForChat: boolean;
  useForEmbeddings: boolean;
  apiKeyMasked?: string;
}

interface EnvProviderInfo {
  type: string;
  name: string;
  available: boolean;
  model?: string;
}

const TYPE_LABELS: Record<string, string> = {
  "openai-compatible": "OpenAI-Compatible",
  "openai": "OpenAI",
  "anthropic": "Anthropic Claude",
  "gemini": "Google Gemini",
};

export function ModelProvidersView() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editProvider, setEditProvider] = useState<ModelProviderInfo | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["model-providers"],
    queryFn: () =>
      fetch("/api/v1/admin/model-providers", { credentials: "include" }).then((r) =>
        r.json()
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/v1/admin/model-providers/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["model-providers"] });
      toast.success("Provider حذف شد");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="size-6 animate-spin ml-2" />
        در حال بارگذاری...
      </div>
    );
  }

  const envProviders: EnvProviderInfo[] = data?.data?.envProviders || [];
  const userProviders: ModelProviderInfo[] = data?.data?.userProviders || [];
  const defaultConfigured: boolean = data?.data?.defaultConfigured || false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">مدیریت مدل‌های AI</h2>
          <p className="text-sm text-muted-foreground">
            پیکربندی پروایدرهای LLM — OpenAI, Anthropic, Gemini, و سرورهای OpenAI-Compatible
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 ml-2" />پروایدر جدید</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>افزودن پروایدر مدل</DialogTitle>
            </DialogHeader>
            <ProviderForm
              onSuccess={() => {
                setCreateOpen(false);
                qc.invalidateQueries({ queryKey: ["model-providers"] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* System default status */}
      <Card className={defaultConfigured ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {defaultConfigured ? (
              <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h3 className="font-medium text-sm">
                {defaultConfigured ? "پروایدر پیش‌فرض فعال" : "پروایدر پیش‌فرض پیکربندی نشده"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {defaultConfigured
                  ? "پروایدر پیش‌فرض از متغیرهای محیطی (.env) خوانده شده و فعال است."
                  : "متغیرهای OPENAI_API_KEY یا ANTHROPIC_API_KEY یا GEMINI_API_KEY را در .env تنظیم کنید."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Environment-configured providers */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          پروایدرهای سیستمی (از .env)
        </h3>
        <div className="grid sm:grid-cols-3 gap-3">
          {envProviders.map((p) => (
            <Card key={p.type}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{TYPE_LABELS[p.type] || p.type}</span>
                  {p.available ? (
                    <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">
                      فعال
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      غیرفعال
                    </Badge>
                  )}
                </div>
                {p.model && (
                  <p className="text-xs text-muted-foreground font-mono" dir="ltr">{p.model}</p>
                )}
                {!p.available && (
                  <p className="text-xs text-muted-foreground mt-1">
                    کلید API در .env تنظیم نشده
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* User-configured providers */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          پروایدرهای سازمانی ({userProviders.length})
        </h3>
        {userProviders.length > 0 ? (
          <div className="space-y-2">
            {userProviders.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Cpu className="size-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium">{p.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABELS[p.type] || p.type}
                        </Badge>
                        {p.isDefault && (
                          <Badge variant="default" className="text-xs">
                            <Star className="size-3 ml-1" />
                            پیش‌فرض
                          </Badge>
                        )}
                        <Badge variant={p.isActive ? "secondary" : "outline"} className="text-xs">
                          {p.isActive ? "فعال" : "غیرفعال"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <code dir="ltr" className="bg-muted px-1.5 py-0.5 rounded">{p.chatModel}</code>
                        {p.baseUrl && (
                          <code dir="ltr" className="bg-muted px-1.5 py-0.5 rounded truncate max-w-[200px]">
                            {p.baseUrl}
                          </code>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs">
                        {p.useForChat && (
                          <Badge variant="secondary" className="text-[10px]">چت</Badge>
                        )}
                        {p.useForEmbeddings && (
                          <Badge variant="secondary" className="text-[10px]">Embedding</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditProvider(p)}
                      >
                        <Edit3 className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => p.id && deleteMutation.mutate(p.id)}
                      >
                        <Trash2 className="size-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                هنوز پروایدری اضافه نکرده‌اید. برای استفاده از مدل دلخواه، یک پروایدر جدید اضافه کنید.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {editProvider && (
        <Dialog open onOpenChange={() => setEditProvider(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>ویرایش پروایدر</DialogTitle>
            </DialogHeader>
            <ProviderForm
              provider={editProvider}
              onSuccess={() => {
                setEditProvider(null);
                qc.invalidateQueries({ queryKey: ["model-providers"] });
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ProviderForm({
  provider,
  onSuccess,
}: {
  provider?: ModelProviderInfo;
  onSuccess: () => void;
}) {
  const isEdit = !!provider?.id;
  const [label, setLabel] = useState(provider?.label || "");
  const [type, setType] = useState(provider?.type || "openai-compatible");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl || "");
  const [chatModel, setChatModel] = useState(provider?.chatModel || "gpt-4o-mini");
  const [embeddingModel, setEmbeddingModel] = useState(provider?.embeddingModel || "text-embedding-3-small");
  const [isDefault, setIsDefault] = useState(provider?.isDefault || false);
  const [useForChat, setUseForChat] = useState(provider?.useForChat ?? true);
  const [useForEmbeddings, setUseForEmbeddings] = useState(provider?.useForEmbeddings ?? false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        label,
        type,
        apiKey: apiKey || "••••••••", // keep existing if not changed
        baseUrl: baseUrl || undefined,
        chatModel,
        embeddingModel: embeddingModel || undefined,
        isDefault,
        useForChat,
        useForEmbeddings,
      };

      if (isEdit && provider?.id) {
        const res = await fetch(`/api/v1/admin/model-providers/${provider.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        return res.json();
      } else {
        const res = await fetch("/api/v1/admin/model-providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        return res.json();
      }
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(isEdit ? "پروایدر به‌روزرسانی شد" : "پروایدر اضافه شد");
        onSuccess();
      } else {
        toast.error(data.errors?.[0]?.message || "خطا");
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "خطا"),
  });

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>نام *</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="مثلاً: سرور vLLM من" />
      </div>

      <div className="space-y-2">
        <Label>نوع پروایدر *</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="openai-compatible">OpenAI-Compatible (vLLM, Ollama, LocalAI, ...)</SelectItem>
            <SelectItem value="openai">OpenAI رسمی</SelectItem>
            <SelectItem value="anthropic">Anthropic Claude</SelectItem>
            <SelectItem value="gemini">Google Gemini</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>API Key {isEdit && "(برای تغییر، کلید جدید وارد کنید)"}</Label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={isEdit ? "•••••••• (بدون تغییر)" : "sk-..."}
          dir="ltr"
        />
      </div>

      <div className="space-y-2">
        <Label>Base URL</Label>
        <Input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={
            type === "anthropic"
              ? "https://api.anthropic.com"
              : type === "gemini"
                ? "https://generativelanguage.googleapis.com"
                : "https://api.openai.com/v1"
          }
          dir="ltr"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>مدل چت *</Label>
          <Input
            value={chatModel}
            onChange={(e) => setChatModel(e.target.value)}
            placeholder="gpt-4o-mini"
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label>مدل Embedding</Label>
          <Input
            value={embeddingModel}
            onChange={(e) => setEmbeddingModel(e.target.value)}
            placeholder="text-embedding-3-small"
            dir="ltr"
          />
        </div>
      </div>

      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <div>
            <Label>استفاده به‌عنوان پیش‌فرض</Label>
            <p className="text-xs text-muted-foreground">این پروایدر برای همه عملیات‌ها استفاده می‌شود</p>
          </div>
          <Switch checked={isDefault} onCheckedChange={setIsDefault} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label>استفاده برای چت</Label>
            <p className="text-xs text-muted-foreground">استخراج موجودیت، چت، گزارش</p>
          </div>
          <Switch checked={useForChat} onCheckedChange={setUseForChat} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label>استفاده برای Embedding</Label>
            <p className="text-xs text-muted-foreground">جستجوی معنایی (RAG)</p>
          </div>
          <Switch checked={useForEmbeddings} onCheckedChange={setUseForEmbeddings} />
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || !label || !chatModel}
        className="w-full"
      >
        {saveMutation.isPending ? (
          <><Loader2 className="size-4 animate-spin ml-2" />در حال ذخیره...</>
        ) : (
          isEdit ? "به‌روزرسانی" : "افزودن پروایدر"
        )}
      </Button>
    </div>
  );
}
