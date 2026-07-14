/**
 * Document Processing Service (per PROJECT.md § 33, 67)
 *
 * Convert every source into normalized machine-readable content.
 * Extracts text from various file formats: txt, markdown, pdf, docx, html, etc.
 */
import "server-only";

/**
 * Extract text content from an uploaded file based on MIME type.
 * For formats we don't have native parsers for, we attempt basic extraction.
 */
export async function extractTextFromFile(
  file: File,
  mimeType: string
): Promise<{ content: string; language: string | null; metadata: Record<string, unknown> }> {
  // Plain text formats
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml"
  ) {
    const content = await file.text();
    return {
      content,
      language: detectLanguage(content),
      metadata: { charCount: content.length, format: "text" },
    };
  }

  // Markdown
  if (mimeType === "text/markdown" || file.name.endsWith(".md")) {
    const content = await file.text();
    return {
      content,
      language: detectLanguage(content),
      metadata: { charCount: content.length, format: "markdown" },
    };
  }

  // PDF — try to extract via Buffer text scan (basic)
  if (mimeType === "application/pdf" || file.name.endsWith(".pdf")) {
    const arrayBuffer = await file.arrayBuffer();
    const text = extractTextFromPdf(arrayBuffer);
    return {
      content: text,
      language: detectLanguage(text),
      metadata: { charCount: text.length, format: "pdf", byteSize: arrayBuffer.byteLength },
    };
  }

  // Office formats — we can't easily parse .docx/.xlsx without extra deps
  // Return metadata-only with a notice
  if (
    mimeType.includes("officedocument") ||
    mimeType.includes("msword") ||
    file.name.match(/\.(docx|doc|xlsx|xls|pptx|ppt)$/)
  ) {
    return {
      content: `[فایل ${file.name} — برای پردازش کامل به PDF یا TXT تبدیل کنید. اندازه: ${(file.size / 1024).toFixed(1)} کیلوبایت]`,
      language: "fa",
      metadata: { charCount: 0, format: "office", note: "Office format requires conversion" },
    };
  }

  // CSV
  if (mimeType === "text/csv" || file.name.endsWith(".csv")) {
    const content = await file.text();
    return {
      content,
      language: detectLanguage(content),
      metadata: { charCount: content.length, format: "csv" },
    };
  }

  // HTML
  if (mimeType === "text/html" || file.name.endsWith(".html")) {
    const html = await file.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      content: text,
      language: detectLanguage(text),
      metadata: { charCount: text.length, format: "html", htmlLength: html.length },
    };
  }

  // Default: try as text
  try {
    const content = await file.text();
    return {
      content,
      language: detectLanguage(content),
      metadata: { charCount: content.length, format: "unknown" },
    };
  } catch {
    return {
      content: `[فایل ${file.name} — فرمت پشتیبانی نمی‌شود]`,
      language: null,
      metadata: { charCount: 0, format: "unsupported", mimeType },
    };
  }
}

/**
 * Basic PDF text extraction by scanning content streams.
 * Note: For production use, use pdf-parse or pdfjs-dist.
 */
function extractTextFromPdf(buffer: ArrayBuffer): string {
  // PDFs store text in BT...ET blocks with Tj/TJ operators
  // This is a very basic extraction that gets readable ASCII text
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  // Extract text between parentheses in Tj operators
  const texts: string[] = [];
  const regex = /\(([^)]*)\)\s*Tj/g;
  let match;
  while ((match = regex.exec(binary)) !== null) {
    if (match[1] && match[1].length > 0) {
      texts.push(match[1]);
    }
  }

  // Also try TJ arrays
  const tjRegex = /\[([^\]]*)\]\s*TJ/g;
  while ((match = tjRegex.exec(binary)) !== null) {
    const inner = match[1];
    const innerMatch = inner.match(/\(([^)]*)\)/g);
    if (innerMatch) {
      texts.push(innerMatch.map((s) => s.slice(1, -1)).join(" "));
    }
  }

  const text = texts.join(" ").replace(/\\[nr()]/g, " ").trim();
  return text || `[PDF — اندازه: ${(buffer.byteLength / 1024).toFixed(1)} کیلوبایت. متن قابل استخراج نبود.]`;
}

/**
 * Simple language detection based on character ranges.
 */
function detectLanguage(text: string): string {
  if (!text || text.length === 0) return "unknown";

  const sample = text.slice(0, 1000);
  let faCount = 0;
  let arCount = 0;
  let zhCount = 0;
  let latinCount = 0;

  for (const ch of sample) {
    const code = ch.charCodeAt(0);
    if (code >= 0x0600 && code <= 0x06ff) faCount++;
    else if (code >= 0x0750 && code <= 0x077f) arCount++;
    else if (code >= 0x4e00 && code <= 0x9fff) zhCount++;
    else if (code >= 0x0041 && code <= 0x007a) latinCount++;
  }

  if (faCount > 10 && faCount > latinCount) return "fa";
  if (arCount > 10 && arCount > latinCount) return "ar";
  if (zhCount > 10 && zhCount > latinCount) return "zh";
  if (latinCount > 10) return "en";
  return "unknown";
}

/**
 * Clean and normalize extracted text.
 */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+$/g, "")
    .trim();
}

/**
 * Calculate word count for a text.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  // For Persian/Arabic, count by spaces. For CJK, count by characters.
  const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0).length;
  return Math.max(words, cjk);
}
