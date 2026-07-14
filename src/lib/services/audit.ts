/**
 * Audit Log Service (per PROJECT.md § 24)
 * Track every important action. Audit logs must be immutable.
 */
import "server-only";
import { db } from "../db";

export interface AuditLogInput {
  userId?: string;
  organizationId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export const AuditLog = {
  async log(input: AuditLogInput) {
    try {
      await db.auditLog.create({
        data: {
          userId: input.userId || null,
          organizationId: input.organizationId || null,
          action: input.action,
          resourceType: input.resourceType || null,
          resourceId: input.resourceId || null,
          details: JSON.stringify(input.details || {}),
          ipAddress: input.ipAddress || null,
          userAgent: input.userAgent || null,
        },
      });
    } catch (err) {
      console.error("[AuditLog] Failed to log:", err);
    }
  },

  async list(filters: { organizationId?: string; userId?: string; action?: string; limit?: number } = {}) {
    const where: Record<string, unknown> = {};
    if (filters.organizationId) where.organizationId = filters.organizationId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;

    return db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters.limit || 50,
      include: { user: { select: { name: true, email: true } } },
    });
  },
};
