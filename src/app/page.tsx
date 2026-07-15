"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useAppStore } from "@/stores/app-store";
import { AuthScreen } from "@/components/auth/auth-screen";
import { AppShell } from "@/components/layout/app-shell";
import { WorkspaceBrowser } from "@/components/workspaces/workspace-browser";
import { WorkspaceOverview } from "@/components/dashboard/workspace-overview";
import { DocumentsView } from "@/components/documents/documents-view";
import { KnowledgeBaseView } from "@/components/knowledge/knowledge-base-view";
import { KnowledgeGraphView } from "@/components/graph/knowledge-graph-view";
import { TimelineView } from "@/components/timeline/timeline-view";
import { ReportsView } from "@/components/reports/reports-view";
import { OpportunityView } from "@/components/opportunity/opportunity-view";
import { AutoResearchView } from "@/components/research/auto-research-view";
import { ChatView } from "@/components/chat/chat-view";
import { SettingsView } from "@/components/dashboard/settings-view";
import { AdminPanel } from "@/components/admin/admin-panel";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const { currentWorkspaceId, currentView } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <AppShell>
      {!currentWorkspaceId ? (
        <WorkspaceBrowser />
      ) : currentView === "workspace" ? (
        <WorkspaceOverview />
      ) : currentView === "documents" ? (
        <DocumentsView />
      ) : currentView === "entities" || currentView === "claims" || currentView === "evidence" ? (
        <KnowledgeBaseView />
      ) : currentView === "graph" ? (
        <KnowledgeGraphView />
      ) : currentView === "timeline" ? (
        <TimelineView />
      ) : currentView === "reports" ? (
        <ReportsView />
      ) : currentView === "opportunity" ? (
        <OpportunityView />
      ) : currentView === "auto-research" ? (
        <AutoResearchView />
      ) : currentView === "chat" ? (
        <ChatView />
      ) : currentView === "settings" ? (
        <SettingsView />
      ) : currentView === "admin" ? (
        <AdminPanel />
      ) : (
        <WorkspaceOverview />
      )}
    </AppShell>
  );
}
