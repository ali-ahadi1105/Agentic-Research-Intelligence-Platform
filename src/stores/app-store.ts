"use client";

import { create } from "zustand";

export type ViewKey =
  | "dashboard"
  | "workspace"
  | "documents"
  | "entities"
  | "claims"
  | "evidence"
  | "graph"
  | "timeline"
  | "reports"
  | "chat"
  | "settings"
  | "admin";

interface AppState {
  currentWorkspaceId: string | null;
  currentView: ViewKey;
  // For chat
  currentConversationId: string | null;
  // For entity detail
  selectedEntityId: string | null;
  // For report viewing
  selectedReportId: string | null;

  setWorkspace: (id: string | null) => void;
  setView: (view: ViewKey) => void;
  setConversation: (id: string | null) => void;
  setSelectedEntity: (id: string | null) => void;
  setSelectedReport: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentWorkspaceId: null,
  currentView: "dashboard",
  currentConversationId: null,
  selectedEntityId: null,
  selectedReportId: null,

  setWorkspace: (id) =>
    set({ currentWorkspaceId: id, currentView: id ? "workspace" : "dashboard" }),
  setView: (view) => set({ currentView: view }),
  setConversation: (id) => set({ currentConversationId: id }),
  setSelectedEntity: (id) => set({ selectedEntityId: id }),
  setSelectedReport: (id) => set({ selectedReportId: id }),
}));
