/**
 * RBAC Permission System (per PROJECT.md § 62)
 *
 * 5 roles with hierarchical permissions:
 *   super_admin      — system-wide access
 *   admin            — full org access
 *   research_manager — manage workspaces, sources, approve claims
 *   analyst          — add/edit entities, claims, evidence; cannot delete
 *   viewer           — read-only
 */
import "server-only";
import type { AuthContext } from "./api-helpers";

export type Role = "super_admin" | "admin" | "research_manager" | "analyst" | "viewer";

export type Permission =
  | "workspace.create"
  | "workspace.update"
  | "workspace.delete"
  | "document.upload"
  | "document.delete"
  | "entity.create"
  | "entity.update"
  | "entity.delete"
  | "entity.merge"
  | "claim.create"
  | "claim.update"
  | "claim.delete"
  | "claim.approve"
  | "relationship.create"
  | "relationship.delete"
  | "report.generate"
  | "report.delete"
  | "chat.send"
  | "admin.access"
  | "admin.users"
  | "admin.audit"
  | "admin.api_keys"
  | "admin.prompts"
  | "admin.settings";

const PERMISSION_MATRIX: Record<Role, Permission[]> = {
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

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = PERMISSION_MATRIX[role as Role];
  if (!perms) return false;
  return perms.includes(permission);
}

export function can(auth: AuthContext, permission: Permission): boolean {
  return hasPermission(auth.userRole, permission);
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

export function getRolePermissions(role: string): Permission[] {
  return PERMISSION_MATRIX[role as Role] || [];
}

export function getAllRoles(): Role[] {
  return ["super_admin", "admin", "research_manager", "analyst", "viewer"];
}
