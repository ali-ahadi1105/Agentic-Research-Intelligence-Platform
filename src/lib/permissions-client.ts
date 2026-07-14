/**
 * Client-side permission helpers (mirror of server-side permissions.ts)
 */

export type Role = "super_admin" | "admin" | "research_manager" | "analyst" | "viewer";

export type ClientPermission =
  | "workspace.create" | "workspace.update" | "workspace.delete"
  | "document.upload" | "document.delete"
  | "entity.create" | "entity.update" | "entity.delete" | "entity.merge"
  | "claim.create" | "claim.update" | "claim.delete" | "claim.approve"
  | "relationship.create" | "relationship.delete"
  | "report.generate" | "report.delete"
  | "chat.send"
  | "admin.access" | "admin.users" | "admin.audit" | "admin.api_keys" | "admin.prompts" | "admin.settings";

const PERMISSION_MATRIX: Record<Role, ClientPermission[]> = {
  super_admin: [
    "workspace.create", "workspace.update", "workspace.delete",
    "document.upload", "document.delete",
    "entity.create", "entity.update", "entity.delete", "entity.merge",
    "claim.create", "claim.update", "claim.delete", "claim.approve",
    "relationship.create", "relationship.delete",
    "report.generate", "report.delete",
    "chat.send",
    "admin.access", "admin.users", "admin.audit", "admin.api_keys", "admin.prompts", "admin.settings",
  ],
  admin: [
    "workspace.create", "workspace.update", "workspace.delete",
    "document.upload", "document.delete",
    "entity.create", "entity.update", "entity.delete", "entity.merge",
    "claim.create", "claim.update", "claim.delete", "claim.approve",
    "relationship.create", "relationship.delete",
    "report.generate", "report.delete",
    "chat.send",
    "admin.access", "admin.audit", "admin.api_keys", "admin.prompts", "admin.settings",
  ],
  research_manager: [
    "workspace.create", "workspace.update",
    "document.upload", "document.delete",
    "entity.create", "entity.update", "entity.delete", "entity.merge",
    "claim.create", "claim.update", "claim.approve",
    "relationship.create", "relationship.delete",
    "report.generate", "report.delete",
    "chat.send",
    "admin.audit",
  ],
  analyst: [
    "document.upload",
    "entity.create", "entity.update",
    "claim.create", "claim.update",
    "relationship.create",
    "report.generate",
    "chat.send",
  ],
  viewer: [
    "chat.send",
  ],
};

export function hasPermission(role: string, permission: ClientPermission): boolean {
  const perms = PERMISSION_MATRIX[role as Role];
  if (!perms) return false;
  return perms.includes(permission);
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    super_admin: "مدیر ارشد سیستم",
    admin: "مدیر سازمان",
    research_manager: "مدیر تحقیق",
    analyst: "تحلیل‌گر",
    viewer: "مشاهده‌گر",
  };
  return labels[role] || role;
}

export function getAllRoles(): Role[] {
  return ["super_admin", "admin", "research_manager", "analyst", "viewer"];
}
