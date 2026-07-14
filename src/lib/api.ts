/**
 * API client for the frontend. All requests go to /api/v1/...
 */
import type {
  ApiResponse,
  User,
  Organization,
  Workspace,
  Source,
  Entity,
  Claim,
  Evidence,
  TimelineEvent,
  Report,
  Conversation,
  Message,
  GraphData,
  WorkspaceStats,
  ResearchPlan,
  AuditLog,
  ApiKey,
  PromptTemplate,
  Notification,
  OrgMember,
  GraphAnalytics,
  ShortestPath,
  ContinuousUpdateResult,
} from "@/types";

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    credentials: "include",
  });

  const json: ApiResponse<T> = await res.json();

  if (!json.success || json.errors) {
    const msg = json.errors?.[0]?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json.data as T;
}

async function uploadFiles<T>(url: string, formData: FormData): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.success || json.errors) {
    throw new Error(json.errors?.[0]?.message || `HTTP ${res.status}`);
  }
  return json.data as T;
}

// ============ Auth ============
export const api = {
  auth: {
    me: () => request<{ user: User; organization: Organization | null }>("/api/v1/auth"),
    register: (email: string, password: string, name: string) =>
      request<{ user: User; organization: Organization }>("/api/v1/auth", {
        method: "POST",
        body: JSON.stringify({ action: "register", email, password, name }),
      }),
    login: (email: string, password: string) =>
      request<{ user: User; organization: Organization | null }>("/api/v1/auth", {
        method: "POST",
        body: JSON.stringify({ action: "login", email, password }),
      }),
    logout: () =>
      request<Record<string, never>>("/api/v1/auth", {
        method: "POST",
        body: JSON.stringify({ action: "logout" }),
      }),
  },

  workspaces: {
    list: () => request<Workspace[]>("/api/v1/workspaces"),
    get: (id: string) => request<Workspace & { sourceStats: { status: string; _count: number }[] }>(`/api/v1/workspaces/${id}`),
    create: (data: { name: string; description?: string; researchGoal?: string; color?: string }) =>
      request<Workspace>("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Workspace>) =>
      request<Workspace>(`/api/v1/workspaces/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/api/v1/workspaces/${id}`, {
        method: "DELETE",
      }),
    stats: (id: string) => request<WorkspaceStats>(`/api/v1/workspaces/${id}/stats`),
  },

  documents: {
    list: (wsId: string) => request<Source[]>(`/api/v1/workspaces/${wsId}/documents`),
    get: (wsId: string, sourceId: string) =>
      request<Source>(`/api/v1/workspaces/${wsId}/documents/${sourceId}`),
    upload: (wsId: string, files: File[]) =>
      uploadFiles<{ sources: { id?: string; title: string; error?: string; status?: string }[] }>(
        `/api/v1/workspaces/${wsId}/documents`,
        (() => {
          const fd = new FormData();
          files.forEach((f) => fd.append("files", f));
          return fd;
        })()
      ),
    importUrl: (wsId: string, url: string, title?: string) =>
      request<{ source: { id: string; title: string } }>(`/api/v1/workspaces/${wsId}/documents`, {
        method: "POST",
        body: JSON.stringify({ action: "import_url", url, title }),
      }),
    searchAndImport: (wsId: string, query: string, num = 3) =>
      request<{
        sources: { id: string; title: string; url: string }[];
        searchResults: { title: string; url: string; snippet: string }[];
      }>(`/api/v1/workspaces/${wsId}/documents`, {
        method: "POST",
        body: JSON.stringify({ action: "search_and_import", query, num }),
      }),
    addManualNote: (wsId: string, title: string, content: string) =>
      request<{ source: { id: string; title: string } }>(`/api/v1/workspaces/${wsId}/documents`, {
        method: "POST",
        body: JSON.stringify({ action: "add_manual_note", title, content }),
      }),
    reprocess: (wsId: string, sourceId: string) =>
      request<{ reprocessing: boolean }>(`/api/v1/workspaces/${wsId}/documents/${sourceId}?action=reprocess`, {
        method: "POST",
      }),
    delete: (wsId: string, sourceId: string) =>
      request<{ deleted: boolean }>(`/api/v1/workspaces/${wsId}/documents/${sourceId}`, {
        method: "DELETE",
      }),
  },

  entities: {
    list: (wsId: string, params?: { type?: string; status?: string; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.type) q.set("type", params.type);
      if (params?.status) q.set("status", params.status);
      if (params?.search) q.set("search", params.search);
      return request<Entity[]>(`/api/v1/workspaces/${wsId}/entities?${q}`);
    },
    create: (wsId: string, data: Partial<Entity>) =>
      request<Entity>(`/api/v1/workspaces/${wsId}/entities`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (wsId: string, id: string, data: Partial<Entity>) =>
      request<Entity>(`/api/v1/workspaces/${wsId}/entities/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (wsId: string, id: string) =>
      request<{ deleted: boolean }>(`/api/v1/workspaces/${wsId}/entities/${id}`, {
        method: "DELETE",
      }),
    merge: (wsId: string, sourceId: string, targetId: string) =>
      request<{ merged: boolean }>(`/api/v1/workspaces/${wsId}/entities/${sourceId}?action=merge`, {
        method: "POST",
        body: JSON.stringify({ targetEntityId: targetId }),
      }),
  },

  claims: {
    list: (wsId: string, params?: { status?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      return request<Claim[]>(`/api/v1/workspaces/${wsId}/claims?${q}`);
    },
    create: (wsId: string, data: { statement: string; type?: string; confidence?: number; entityIds?: string[]; evidence?: { excerpt: string; sourceId?: string }[] }) =>
      request<Claim>(`/api/v1/workspaces/${wsId}/claims`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (wsId: string, id: string, data: Partial<Claim>) =>
      request<Claim>(`/api/v1/workspaces/${wsId}/claims/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (wsId: string, id: string) =>
      request<{ deleted: boolean }>(`/api/v1/workspaces/${wsId}/claims/${id}`, {
        method: "DELETE",
      }),
  },

  evidence: {
    list: (wsId: string, claimId?: string) => {
      const q = new URLSearchParams();
      if (claimId) q.set("claimId", claimId);
      return request<Evidence[]>(`/api/v1/workspaces/${wsId}/evidence?${q}`);
    },
    create: (wsId: string, data: { claimId: string; excerpt: string; sourceId?: string; confidence?: number }) =>
      request<Evidence>(`/api/v1/workspaces/${wsId}/evidence`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  relationships: {
    list: (wsId: string) =>
      request<Relationship[]>(`/api/v1/workspaces/${wsId}/relationships`),

    create: (wsId: string, data: { sourceEntityId: string; targetEntityId: string; type: string; confidence?: number }) =>
      request<Relationship>(`/api/v1/workspaces/${wsId}/relationships`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  graph: {
    get: (wsId: string, params?: { type?: string; minConfidence?: number; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.type) q.set("type", params.type);
      if (params?.minConfidence) q.set("minConfidence", String(params.minConfidence));
      if (params?.limit) q.set("limit", String(params.limit));
      return request<GraphData>(`/api/v1/workspaces/${wsId}/graph?${q}`);
    },
    analytics: (wsId: string) =>
      request<GraphAnalytics>(`/api/v1/workspaces/${wsId}/graph/analytics`),
    shortestPath: (wsId: string, sourceId: string, targetId: string) =>
      request<ShortestPath>(`/api/v1/workspaces/${wsId}/graph/path?source=${sourceId}&target=${targetId}`),
  },

  timeline: {
    list: (wsId: string, type?: string) => {
      const q = new URLSearchParams();
      if (type) q.set("type", type);
      return request<TimelineEvent[]>(`/api/v1/workspaces/${wsId}/timeline?${q}`);
    },
    create: (wsId: string, data: Partial<TimelineEvent>) =>
      request<TimelineEvent>(`/api/v1/workspaces/${wsId}/timeline`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  reports: {
    list: (wsId: string) => request<Report[]>(`/api/v1/workspaces/${wsId}/reports`),
    get: (wsId: string, id: string) => request<Report>(`/api/v1/workspaces/${wsId}/reports/${id}`),
    generate: (wsId: string, type: string, title?: string) =>
      request<Report>(`/api/v1/workspaces/${wsId}/reports`, {
        method: "POST",
        body: JSON.stringify({ type, title }),
      }),
    delete: (wsId: string, id: string) =>
      request<{ deleted: boolean }>(`/api/v1/workspaces/${wsId}/reports/${id}`, {
        method: "DELETE",
      }),
  },

  chat: {
    list: (wsId: string) => request<Conversation[]>(`/api/v1/workspaces/${wsId}/chat`),
    get: (wsId: string, convId: string) =>
      request<Conversation & { messages: Message[] }>(`/api/v1/workspaces/${wsId}/chat/${convId}`),
    create: (wsId: string, title?: string) =>
      request<Conversation>(`/api/v1/workspaces/${wsId}/chat`, {
        method: "POST",
        body: JSON.stringify({ action: "create_conversation", title }),
      }),
    send: (wsId: string, convId: string, question: string) =>
      request<{ message: Message; answer: string; citations: Citation[]; relatedEntities: Entity[] }>(
        `/api/v1/workspaces/${wsId}/chat`,
        {
          method: "POST",
          body: JSON.stringify({ action: "send", conversationId: convId, question }),
        }
      ),
    delete: (wsId: string, convId: string) =>
      request<{ deleted: boolean }>(`/api/v1/workspaces/${wsId}/chat/${convId}`, {
        method: "DELETE",
      }),
  },

  plan: {
    generate: (wsId: string, goal: string, context?: string) =>
      request<ResearchPlan>(`/api/v1/workspaces/${wsId}/plan`, {
        method: "POST",
        body: JSON.stringify({ goal, context }),
      }),
  },

  search: {
    query: (wsId: string, q: string, type?: string) => {
      const params = new URLSearchParams({ q });
      if (type) params.set("type", type);
      return request<{
        entities: Entity[];
        claims: Claim[];
        evidence: Evidence[];
        sources: Source[];
      }>(`/api/v1/workspaces/${wsId}/search?${params}`);
    },
  },

  seed: {
    workspace: (wsId: string) =>
      request<{ seeded: boolean; sources: { id: string; title: string }[]; message: string }>("/api/v1/seed", {
        method: "POST",
        body: JSON.stringify({ workspaceId: wsId }),
      }),
  },

  continuousUpdate: {
    trigger: (wsId: string) =>
      request<ContinuousUpdateResult>(`/api/v1/workspaces/${wsId}/continuous-update`, {
        method: "POST",
      }),
  },

  admin: {
    auditLogs: (params?: { action?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.action) q.set("action", params.action);
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.offset) q.set("offset", String(params.offset));
      return request<{ logs: AuditLog[]; total: number }>(`/api/v1/admin/audit-logs?${q}`);
    },

    apiKeys: {
      list: () => request<ApiKey[]>("/api/v1/admin/api-keys"),
      create: (name: string, scopes?: string[]) =>
        request<ApiKey>("/api/v1/admin/api-keys", {
          method: "POST",
          body: JSON.stringify({ name, scopes: scopes || [] }),
        }),
      deactivate: (id: string) =>
        request<{ deactivated: boolean }>(`/api/v1/admin/api-keys?id=${id}`, {
          method: "DELETE",
        }),
    },

    prompts: {
      list: () => request<PromptTemplate[]>("/api/v1/admin/prompts"),
      versions: (key: string) =>
        request<PromptTemplate[]>(`/api/v1/admin/prompts?key=${key}`),
      update: (key: string, updates: { systemPrompt?: string; description?: string; temperature?: number; maxTokens?: number }) =>
        request<PromptTemplate>("/api/v1/admin/prompts", {
          method: "PATCH",
          body: JSON.stringify({ key, ...updates }),
        }),
      rollback: (key: string, version: number) =>
        request<PromptTemplate>("/api/v1/admin/prompts", {
          method: "PATCH",
          body: JSON.stringify({ action: "rollback", key, version }),
        }),
    },

    notifications: {
      list: () =>
        request<{ notifications: Notification[]; unreadCount: number }>("/api/v1/admin/notifications"),
      markAllRead: () =>
        request<{ updated: boolean }>("/api/v1/admin/notifications", {
          method: "PATCH",
          body: JSON.stringify({ action: "mark_all_read" }),
        }),
      markRead: (id: string) =>
        request<{ updated: boolean }>("/api/v1/admin/notifications", {
          method: "PATCH",
          body: JSON.stringify({ action: "mark_read", notificationId: id }),
        }),
      delete: (id: string) =>
        request<{ deleted: boolean }>("/api/v1/admin/notifications", {
          method: "PATCH",
          body: JSON.stringify({ action: "delete", notificationId: id }),
        }),
    },

    users: {
      list: () => request<OrgMember[]>("/api/v1/admin/users"),
      updateRole: (memberId: string, role: string) =>
        request<OrgMember>("/api/v1/admin/users", {
          method: "PATCH",
          body: JSON.stringify({ memberId, role }),
        }),
    },
  },
};

import type { Citation, Relationship } from "@/types";
