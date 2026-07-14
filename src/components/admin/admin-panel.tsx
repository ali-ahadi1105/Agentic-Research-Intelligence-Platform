"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLogsView } from "./audit-logs-view";
import { ApiKeysView } from "./api-keys-view";
import { PromptManagementView } from "./prompt-management-view";
import { NotificationsView } from "./notifications-view";
import { UsersView } from "./users-view";
import { ModelProvidersView } from "./model-providers-view";
import { ScrollText, KeyRound, FileCode2, Bell, Users, Cpu } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { hasPermission } from "@/lib/permissions-client";
import { Card, CardContent } from "@/components/ui/card";

export function AdminPanel() {
  const { user } = useAuthStore();
  const role = user?.role || "viewer";

  const canSeeAudit = hasPermission(role, "admin.audit");
  const canSeeApiKeys = hasPermission(role, "admin.api_keys");
  const canSeePrompts = hasPermission(role, "admin.prompts");
  const canSeeUsers = hasPermission(role, "admin.users");
  const canSeeModelProviders = hasPermission(role, "admin.settings");

  if (!canSeeAudit && !canSeeApiKeys && !canSeePrompts && !canSeeUsers && !canSeeModelProviders) {
    return (
      <Card className="border-dashed">
        <CardContent className="text-center py-16">
          <h3 className="font-semibold text-lg mb-2">دسترسی غیرمجاز</h3>
          <p className="text-muted-foreground text-sm">
            شما اجازه دسترسی به پنل مدیریت را ندارید
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">پنل مدیریت</h1>
        <p className="text-muted-foreground mt-1">
          مدیریت audit logs، API keys، prompt templates، notifications و کاربران
        </p>
      </div>

      <Tabs defaultValue="audit">
        <TabsList className="flex-wrap h-auto">
          {canSeeAudit && (
            <TabsTrigger value="audit">
              <ScrollText className="size-4 ml-2" />
              لاگ‌های ممیزی
            </TabsTrigger>
          )}
          {canSeeApiKeys && (
            <TabsTrigger value="apikeys">
              <KeyRound className="size-4 ml-2" />
              کلیدهای API
            </TabsTrigger>
          )}
          {canSeePrompts && (
            <TabsTrigger value="prompts">
              <FileCode2 className="size-4 ml-2" />
              مدیریت Prompt
            </TabsTrigger>
          )}
          {canSeeModelProviders && (
            <TabsTrigger value="models">
              <Cpu className="size-4 ml-2" />
              مدل‌های AI
            </TabsTrigger>
          )}
          <TabsTrigger value="notifications">
            <Bell className="size-4 ml-2" />
            اعلان‌ها
          </TabsTrigger>
          {canSeeUsers && (
            <TabsTrigger value="users">
              <Users className="size-4 ml-2" />
              کاربران
            </TabsTrigger>
          )}
        </TabsList>

        {canSeeAudit && (
          <TabsContent value="audit"><AuditLogsView /></TabsContent>
        )}
        {canSeeApiKeys && (
          <TabsContent value="apikeys"><ApiKeysView /></TabsContent>
        )}
        {canSeePrompts && (
          <TabsContent value="prompts"><PromptManagementView /></TabsContent>
        )}
        {canSeeModelProviders && (
          <TabsContent value="models"><ModelProvidersView /></TabsContent>
        )}
        <TabsContent value="notifications"><NotificationsView /></TabsContent>
        {canSeeUsers && (
          <TabsContent value="users"><UsersView /></TabsContent>
        )}
      </Tabs>
    </div>
  );
}
