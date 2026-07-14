import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  ok,
  created,
  badRequest,
  unauthorizedResponse,
  internalError,
  notFound,
} from "@/lib/services/api-helpers";
import { can } from "@/lib/services/permissions";
import crypto from "crypto";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    if (!can(auth, "admin.api_keys")) {
      return notFound("دسترسی غیرمجاز");
    }

    const keys = await db.apiKey.findMany({
      where: { organizationId: auth.organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    return ok(keys);
  } catch (err) {
    console.error("[API Keys API] GET error:", err);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    if (!can(auth, "admin.api_keys")) {
      return notFound("دسترسی غیرمجاز");
    }

    const body = await request.json();
    const { name, scopes = [], expiresAt } = body;

    if (!name) return badRequest("name لازم است");

    // Generate API key
    const rawKey = `rk_${crypto.randomBytes(32).toString("hex")}`;
    const keyPrefix = rawKey.slice(0, 11); // rk_XXXXXXXX
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const apiKey = await db.apiKey.create({
      data: {
        organizationId: auth.organizationId,
        userId: auth.userId,
        name,
        keyPrefix,
        keyHash,
        scopes: JSON.stringify(scopes),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return created({
      ...apiKey,
      key: rawKey, // Only returned once at creation
      message: "این کلید فقط یک بار نمایش داده می‌شود. آن را در جای امن ذخیره کنید.",
    });
  } catch (err) {
    console.error("[API Keys API] POST error:", err);
    return internalError();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    if (!can(auth, "admin.api_keys")) {
      return notFound("دسترسی غیرمجاز");
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("id");
    if (!keyId) return badRequest("id لازم است");

    await db.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });

    return ok({ deactivated: true });
  } catch (err) {
    console.error("[API Keys API] DELETE error:", err);
    return internalError();
  }
}
