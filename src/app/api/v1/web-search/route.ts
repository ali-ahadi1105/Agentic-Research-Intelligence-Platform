import { NextRequest } from "next/server";
import { webSearch } from "@/lib/services/web-search";
import { ok, internalError } from "@/lib/services/api-helpers";

/**
 * POST /api/v1/web-search
 * Body: { query: string, num?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const { query, num = 5 } = await request.json();
    if (!query || typeof query !== "string") {
      return Response.json({ success: false, errors: [{ message: "query is required" }] }, { status: 400 });
    }
    const results = await webSearch(query, num);
    return ok(results);
  } catch (err) {
    console.error("[WebSearch API] Error:", err);
    return internalError();
  }
}
