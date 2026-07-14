import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  ok,
  created,
  badRequest,
  unauthorizedResponse,
  internalError,
  authorizeWorkspace,
  notFound,
} from "@/lib/services/api-helpers";
import { extractTextFromFile, cleanText, countWords } from "@/lib/services/document-processor";
import { processSourceKnowledge } from "@/lib/services/pipeline";
import { AuditLog } from "@/lib/services/audit";
import { webSearch, readWebPage } from "@/lib/ai/client";

/**
 * GET /api/v1/workspaces/[workspaceId]/documents
 * List all sources/documents in the workspace.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    const sources = await db.source.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        document: {
          select: { id: true, wordCount: true, language: true },
        },
      },
    });

    return ok(sources);
  } catch (err) {
    console.error("[Documents API] GET error:", err);
    return internalError();
  }
}

/**
 * POST /api/v1/workspaces/[workspaceId]/documents
 * Upload one or more files, or import a URL.
 * Body:
 *   - multipart/form-data with `files` field (file upload), OR
 *   - JSON { action: "import_url", url: "...", title: "..." } to fetch a web page, OR
 *   - JSON { action: "search_and_import", query: "...", num: 5 } to search and import top results
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    const contentType = request.headers.get("content-type") || "";

    // ============ File upload ============
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const files = formData.getAll("files").filter((f): f is File => f instanceof File);

      if (files.length === 0) {
        return badRequest("هیچ فایلی ارسال نشد");
      }

      const created_sources = [];

      for (const file of files) {
        // 10MB limit
        if (file.size > 10 * 1024 * 1024) {
          created_sources.push({
            title: file.name,
            error: "حجم فایل بیش از ۱۰ مگابایت است",
          });
          continue;
        }

        const mimeType = file.type || "application/octet-stream";
        const { content, language, metadata } = await extractTextFromFile(file, mimeType);

        const source = await db.source.create({
          data: {
            workspaceId,
            title: file.name,
            type: detectTypeFromMime(mimeType, file.name),
            mimeType,
            sizeBytes: file.size,
            status: "processing",
            processingProgress: 5,
            language,
            metadata: JSON.stringify(metadata),
            uploadedById: auth.userId,
          },
        });

        const cleanedContent = cleanText(content);
        const wordCount = countWords(cleanedContent);

        await db.document.create({
          data: {
            sourceId: source.id,
            content: cleanedContent,
            contentCleaned: cleanedContent,
            language,
            wordCount,
            metadata: JSON.stringify(metadata),
          },
        });

        // Trigger async processing
        processSourceKnowledge(source.id).catch((err) => {
          console.error(`[Documents] Background processing failed for ${source.id}:`, err);
        });

        created_sources.push({
          id: source.id,
          title: source.title,
          status: source.status,
        });

        await AuditLog.log({
          userId: auth.userId,
          organizationId: auth.organizationId,
          action: "create",
          resourceType: "source",
          resourceId: source.id,
          details: { title: source.title, type: source.type },
        });
      }

      return created({ sources: created_sources });
    }

    // ============ JSON actions ============
    const body = await request.json();

    if (body.action === "import_url") {
      const { url, title } = body;
      if (!url) return badRequest("url لازم است");

      const page = await readWebPage(url);
      if (!page || !page.text) {
        return badRequest("امکان دریافت محتوای صفحه وجود نداشت");
      }

      const source = await db.source.create({
        data: {
          workspaceId,
          title: title || page.title || url,
          type: "web_page",
          sourceUrl: url,
          status: "processing",
          processingProgress: 5,
          language: "unknown",
          metadata: JSON.stringify({
            url,
            publishedTime: page.publishedTime,
            format: "web_page",
          }),
          uploadedById: auth.userId,
        },
      });

      const cleanedContent = cleanText(page.text);
      const wordCount = countWords(cleanedContent);

      await db.document.create({
        data: {
          sourceId: source.id,
          content: cleanedContent,
          contentCleaned: cleanedContent,
          language: "unknown",
          wordCount,
          metadata: JSON.stringify({
            url,
            title: page.title,
            htmlLength: page.html.length,
          }),
        },
      });

      // Trigger processing
      processSourceKnowledge(source.id).catch((err) => {
        console.error(`[Documents] Background processing failed for ${source.id}:`, err);
      });

      return created({ source: { id: source.id, title: source.title } });
    }

    if (body.action === "search_and_import") {
      const { query, num = 3 } = body;
      if (!query) return badRequest("query لازم است");

      const results = await webSearch(query, num);

      const imported: Array<{ id: string; title: string; url: string }> = [];

      for (const r of results.slice(0, num)) {
        try {
          const page = await readWebPage(r.url);
          if (!page || !page.text || page.text.length < 100) continue;

          const source = await db.source.create({
            data: {
              workspaceId,
              title: r.title || page.title || r.url,
              type: "web_page",
              sourceUrl: r.url,
              status: "processing",
              processingProgress: 5,
              metadata: JSON.stringify({
                url: r.url,
                publishedTime: page.publishedTime || r.publishedDate,
                searchQuery: query,
                snippet: r.snippet,
              }),
              uploadedById: auth.userId,
            },
          });

          const cleanedContent = cleanText(page.text);
          const wordCount = countWords(cleanedContent);

          await db.document.create({
            data: {
              sourceId: source.id,
              content: cleanedContent,
              contentCleaned: cleanedContent,
              language: "unknown",
              wordCount,
              metadata: JSON.stringify({
                url: r.url,
                title: page.title,
                snippet: r.snippet,
              }),
            },
          });

          processSourceKnowledge(source.id).catch((err) => {
            console.error(`[Documents] Background processing failed for ${source.id}:`, err);
          });

          imported.push({ id: source.id, title: source.title, url: r.url });
        } catch (err) {
          console.error(`[Documents] Failed to import ${r.url}:`, err);
        }
      }

      return created({ sources: imported, searchResults: results });
    }

    if (body.action === "add_manual_note") {
      const { title, content } = body;
      if (!title || !content) return badRequest("title و content لازم است");

      const source = await db.source.create({
        data: {
          workspaceId,
          title,
          type: "manual_note",
          status: "processing",
          processingProgress: 5,
          language: "unknown",
          metadata: JSON.stringify({ format: "manual_note" }),
          uploadedById: auth.userId,
        },
      });

      const cleanedContent = cleanText(content);
      await db.document.create({
        data: {
          sourceId: source.id,
          content: cleanedContent,
          contentCleaned: cleanedContent,
          language: "unknown",
          wordCount: countWords(cleanedContent),
          metadata: JSON.stringify({ format: "manual_note" }),
        },
      });

      processSourceKnowledge(source.id).catch((err) => {
        console.error(`[Documents] Background processing failed for ${source.id}:`, err);
      });

      return created({ source: { id: source.id, title: source.title } });
    }

    return badRequest("action نامعتبر است");
  } catch (err) {
    console.error("[Documents API] POST error:", err);
    return internalError();
  }
}

function detectTypeFromMime(mime: string, name: string): string {
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (mime.includes("officedocument.wordprocessingml") || name.endsWith(".docx"))
    return "docx";
  if (mime.includes("officedocument.spreadsheetml") || name.endsWith(".xlsx"))
    return "excel";
  if (mime.includes("officedocument.presentationml") || name.endsWith(".pptx"))
    return "powerpoint";
  if (mime === "text/markdown" || name.endsWith(".md")) return "markdown";
  if (mime === "text/csv" || name.endsWith(".csv")) return "csv";
  if (mime === "text/html" || name.endsWith(".html")) return "web_page";
  if (mime === "text/plain" || name.endsWith(".txt")) return "txt";
  if (mime.startsWith("image/")) return "image";
  return "txt";
}
