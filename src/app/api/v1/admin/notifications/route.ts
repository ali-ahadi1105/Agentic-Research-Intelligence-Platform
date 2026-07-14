import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  ok,
  unauthorizedResponse,
  internalError,
} from "@/lib/services/api-helpers";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    const notifications = await db.notification.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await db.notification.count({
      where: { userId: auth.userId, isRead: false },
    });

    return ok({ notifications, unreadCount });
  } catch (err) {
    console.error("[Notifications API] GET error:", err);
    return internalError();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    const body = await request.json();
    const { action, notificationId } = body;

    if (action === "mark_all_read") {
      await db.notification.updateMany({
        where: { userId: auth.userId, isRead: false },
        data: { isRead: true },
      });
      return ok({ updated: true });
    }

    if (action === "mark_read" && notificationId) {
      await db.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
      return ok({ updated: true });
    }

    if (action === "delete" && notificationId) {
      await db.notification.delete({
        where: { id: notificationId },
      });
      return ok({ deleted: true });
    }

    return ok({});
  } catch (err) {
    console.error("[Notifications API] PATCH error:", err);
    return internalError();
  }
}
