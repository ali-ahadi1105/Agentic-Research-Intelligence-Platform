/**
 * Export Utilities — PDF and CSV generation
 *
 * Uses jsPDF for PDF generation and PapaParse for CSV.
 * All exports happen client-side — no server roundtrip needed.
 */
import jsPDF from "jspdf";
import Papa from "papaparse";
// @ts-ignore
import { PersianShaper } from "arabic-persian-reshaper";

let cachedVazirmatnBase64 = "";

async function loadVazirmatnFont() {
  if (cachedVazirmatnBase64) return cachedVazirmatnBase64;
  try {
    const response = await fetch("/fonts/Vazirmatn-base64.txt");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    cachedVazirmatnBase64 = await response.text();
    return cachedVazirmatnBase64;
  } catch (error) {
    console.error("Failed to load Vazirmatn base64 font:", error);
    return "";
  }
}

function processPersianText(text: string): string {
  if (!text) return "";

  // 1. Shape the Persian/Arabic text
  const shaped = PersianShaper.convertArabic(text);

  // 2. Identify LTR blocks (alphanumeric sequences) to protect them from character reversal
  const ltrRegex = /[a-zA-Z0-9]+/g;
  const ltrBlocks: string[] = [];
  
  let placeholderCount = 0;
  const tempString = shaped.replace(ltrRegex, (match) => {
    ltrBlocks.push(match);
    return `__LTR_${placeholderCount++}__`;
  });

  // 3. Reverse the string character-by-character
  const reversed = tempString.split("").reverse().join("");

  // 4. Restore LTR blocks in their original LTR reading direction
  const restored = reversed.replace(/__([0-9]+)_RTL__/g, (match, indexStr) => {
    const index = parseInt(indexStr, 10);
    return ltrBlocks[index] || "";
  });

  return restored;
}

// ============================================================
// CSV Export
// ============================================================

/**
 * Export an array of objects to a CSV file.
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string,
  columns?: { key: string; label: string }[]
) {
  // If columns are specified, filter and rename
  let csvData = data;
  if (columns) {
    csvData = data.map((row) => {
      const newRow: Record<string, unknown> = {};
      for (const col of columns) {
        newRow[col.label] = row[col.key] ?? "";
      }
      return newRow;
    });
  }

  const csv = Papa.unparse(csvData);
  downloadBlob(csv, `${filename}.csv`, "text/csv;charset=utf-8;");
}

// ============================================================
// PDF Export
// ============================================================

/**
 * Export a text/markdown report to PDF.
 * Handles Persian text by using Unicode-compatible rendering.
 */
export async function exportReportToPDF(
  title: string,
  content: string,
  filename: string
) {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 7;

  let y = margin;

  const base64Font = await loadVazirmatnFont();
  if (base64Font) {
    pdf.addFileToVFS("Vazirmatn-Regular.ttf", base64Font);
    pdf.addFont("Vazirmatn-Regular.ttf", "Vazirmatn", "normal");
    pdf.addFont("Vazirmatn-Regular.ttf", "Vazirmatn", "bold");
    pdf.setFont("Vazirmatn", "normal");
  } else {
    pdf.setFont("helvetica", "normal");
  }

  // Title
  const hasTitlePersian = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(title);
  pdf.setFontSize(18);
  if (base64Font) {
    pdf.setFont("Vazirmatn", "bold");
  } else {
    pdf.setFont("helvetica", "bold");
  }

  const titleLines = pdf.splitTextToSize(title, maxWidth);
  titleLines.forEach((line) => {
    const processed = hasTitlePersian ? processPersianText(line) : line;
    const x = hasTitlePersian ? pageWidth - margin : margin;
    const align = hasTitlePersian ? "right" : "left";
    pdf.text(processed, x, y, { align });
    y += lineHeight;
  });
  y += 5;

  // Date
  pdf.setFontSize(10);
  if (base64Font) {
    pdf.setFont("Vazirmatn", "normal");
  } else {
    pdf.setFont("helvetica", "normal");
  }
  pdf.setTextColor(128, 128, 128);
  pdf.text(
    `Generated: ${new Date().toLocaleString("en-GB")}`,
    margin,
    y
  );
  y += lineHeight + 5;
  pdf.setTextColor(0, 0, 0);

  // Separator line
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Content — parse markdown and render
  pdf.setFontSize(11);
  const lines = content.split("\n");

  for (const line of lines) {
    // Check if we need a new page (buffer for footer)
    if (y > pageHeight - margin - 10) {
      pdf.addPage();
      y = margin;
    }

    const trimmed = line.trim();

    // Skip empty lines (but add spacing)
    if (!trimmed) {
      y += lineHeight * 0.5;
      continue;
    }

    const hasPersian = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(trimmed);

    // Headings
    if (trimmed.startsWith("### ")) {
      if (base64Font) {
        pdf.setFont("Vazirmatn", "bold");
      } else {
        pdf.setFont("helvetica", "bold");
      }
      pdf.setFontSize(12);
      const text = trimmed.replace(/^###\s+/, "");
      const wrapped = pdf.splitTextToSize(text, maxWidth);
      wrapped.forEach((wrappedLine) => {
        const processed = hasPersian ? processPersianText(wrappedLine) : wrappedLine;
        const x = hasPersian ? pageWidth - margin : margin;
        const align = hasPersian ? "right" : "left";
        pdf.text(processed, x, y, { align });
        y += lineHeight + 2;
      });
      if (base64Font) {
        pdf.setFont("Vazirmatn", "normal");
      } else {
        pdf.setFont("helvetica", "normal");
      }
      pdf.setFontSize(11);
    } else if (trimmed.startsWith("## ")) {
      if (base64Font) {
        pdf.setFont("Vazirmatn", "bold");
      } else {
        pdf.setFont("helvetica", "bold");
      }
      pdf.setFontSize(14);
      const text = trimmed.replace(/^##\s+/, "");
      const wrapped = pdf.splitTextToSize(text, maxWidth);
      wrapped.forEach((wrappedLine) => {
        const processed = hasPersian ? processPersianText(wrappedLine) : wrappedLine;
        const x = hasPersian ? pageWidth - margin : margin;
        const align = hasPersian ? "right" : "left";
        pdf.text(processed, x, y, { align });
        y += lineHeight + 3;
      });
      if (base64Font) {
        pdf.setFont("Vazirmatn", "normal");
      } else {
        pdf.setFont("helvetica", "normal");
      }
      pdf.setFontSize(11);
    } else if (trimmed.startsWith("# ")) {
      if (base64Font) {
        pdf.setFont("Vazirmatn", "bold");
      } else {
        pdf.setFont("helvetica", "bold");
      }
      pdf.setFontSize(16);
      const text = trimmed.replace(/^#\s+/, "");
      const wrapped = pdf.splitTextToSize(text, maxWidth);
      wrapped.forEach((wrappedLine) => {
        const processed = hasPersian ? processPersianText(wrappedLine) : wrappedLine;
        const x = hasPersian ? pageWidth - margin : margin;
        const align = hasPersian ? "right" : "left";
        pdf.text(processed, x, y, { align });
        y += lineHeight + 4;
      });
      if (base64Font) {
        pdf.setFont("Vazirmatn", "normal");
      } else {
        pdf.setFont("helvetica", "normal");
      }
      pdf.setFontSize(11);
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      // Bullet point
      const text = trimmed.replace(/^[-*]\s+/, "");
      const wrapped = pdf.splitTextToSize(text, maxWidth - 8);
      wrapped.forEach((wrappedLine) => {
        const processed = hasPersian ? processPersianText(wrappedLine) : wrappedLine;
        if (hasPersian) {
          const bulletText = processed + "  •";
          pdf.text(bulletText, pageWidth - margin, y, { align: "right" });
        } else {
          const bulletText = "  • " + processed;
          pdf.text(bulletText, margin, y, { align: "left" });
        }
        y += lineHeight;
      });
    } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      // Bold line
      if (base64Font) {
        pdf.setFont("Vazirmatn", "bold");
      } else {
        pdf.setFont("helvetica", "bold");
      }
      const text = trimmed.replace(/^\*\*|\*\*$/g, "");
      const wrapped = pdf.splitTextToSize(text, maxWidth);
      wrapped.forEach((wrappedLine) => {
        const processed = hasPersian ? processPersianText(wrappedLine) : wrappedLine;
        const x = hasPersian ? pageWidth - margin : margin;
        const align = hasPersian ? "right" : "left";
        pdf.text(processed, x, y, { align });
        y += lineHeight;
      });
      if (base64Font) {
        pdf.setFont("Vazirmatn", "normal");
      } else {
        pdf.setFont("helvetica", "normal");
      }
    } else {
      // Normal text
      const wrapped = pdf.splitTextToSize(trimmed, maxWidth);
      wrapped.forEach((wrappedLine) => {
        const processed = hasPersian ? processPersianText(wrappedLine) : wrappedLine;
        const x = hasPersian ? pageWidth - margin : margin;
        const align = hasPersian ? "right" : "left";
        pdf.text(processed, x, y, { align });
        y += lineHeight;
      });
    }
  }

  // Footer with page numbers
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    if (base64Font) {
      pdf.setFont("Vazirmatn", "normal");
    } else {
      pdf.setFont("helvetica", "normal");
    }
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Page ${i} / ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }

  pdf.save(`${filename}.pdf`);
}

// ============================================================
// Table PDF Export (for entities, claims, etc.)
// ============================================================

/**
 * Export tabular data to a PDF with a styled table.
 */
export async function exportTableToPDF(
  title: string,
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[],
  filename: string
) {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;

  const base64Font = await loadVazirmatnFont();
  if (base64Font) {
    pdf.addFileToVFS("Vazirmatn-Regular.ttf", base64Font);
    pdf.addFont("Vazirmatn-Regular.ttf", "Vazirmatn", "normal");
    pdf.addFont("Vazirmatn-Regular.ttf", "Vazirmatn", "bold");
    pdf.setFont("Vazirmatn", "normal");
  } else {
    pdf.setFont("helvetica", "normal");
  }

  // Title
  const hasTitlePersian = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(title);
  pdf.setFontSize(16);
  if (base64Font) {
    pdf.setFont("Vazirmatn", "bold");
  } else {
    pdf.setFont("helvetica", "bold");
  }
  const processedTitle = hasTitlePersian ? processPersianText(title) : title;
  pdf.text(processedTitle, hasTitlePersian ? pageWidth - margin : margin, 20, {
    align: hasTitlePersian ? "right" : "left",
  });

  // Date
  pdf.setFontSize(9);
  if (base64Font) {
    pdf.setFont("Vazirmatn", "normal");
  } else {
    pdf.setFont("helvetica", "normal");
  }
  pdf.setTextColor(128, 128, 128);
  pdf.text(
    `Generated: ${new Date().toLocaleString("en-GB")}`,
    margin,
    26
  );
  pdf.setTextColor(0, 0, 0);

  // Table
  const tableStartY = 32;
  const colCount = columns.length;
  const colWidth = maxWidth / colCount;
  const rowHeight = 8;
  const headerHeight = 10;

  let y = tableStartY;

  // Header background
  pdf.setFillColor(240, 240, 240);
  pdf.rect(margin, y, maxWidth, headerHeight, "F");

  // Header text
  pdf.setFontSize(10);
  if (base64Font) {
    pdf.setFont("Vazirmatn", "bold");
  } else {
    pdf.setFont("helvetica", "bold");
  }
  columns.forEach((col, i) => {
    const label = col.label;
    const hasPersian = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(label);
    const processedText = hasPersian ? processPersianText(label) : label;

    const wrapped = pdf.splitTextToSize(processedText, colWidth - 4);
    const textToDraw = wrapped[0] || "";

    if (hasPersian) {
      pdf.text(textToDraw, margin + (i + 1) * colWidth - 2, y + 7, { align: "right" });
    } else {
      pdf.text(textToDraw, margin + i * colWidth + 2, y + 7, { align: "left" });
    }
  });
  y += headerHeight;

  // Rows
  if (base64Font) {
    pdf.setFont("Vazirmatn", "normal");
  } else {
    pdf.setFont("helvetica", "normal");
  }
  pdf.setFontSize(9);

  for (const row of rows) {
    if (y > pageHeight - 20) {
      pdf.addPage();
      y = margin;

      // Repeat header
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, y, maxWidth, headerHeight, "F");
      if (base64Font) {
        pdf.setFont("Vazirmatn", "bold");
      } else {
        pdf.setFont("helvetica", "bold");
      }
      pdf.setFontSize(10);
      columns.forEach((col, i) => {
        const label = col.label;
        const hasPersian = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(label);
        const processedText = hasPersian ? processPersianText(label) : label;

        const wrapped = pdf.splitTextToSize(processedText, colWidth - 4);
        const textToDraw = wrapped[0] || "";

        if (hasPersian) {
          pdf.text(textToDraw, margin + (i + 1) * colWidth - 2, y + 7, { align: "right" });
        } else {
          pdf.text(textToDraw, margin + i * colWidth + 2, y + 7, { align: "left" });
        }
      });
      y += headerHeight;
      if (base64Font) {
        pdf.setFont("Vazirmatn", "normal");
      } else {
        pdf.setFont("helvetica", "normal");
      }
      pdf.setFontSize(9);
    }

    // Alternate row background
    if (Math.floor((y - tableStartY - headerHeight) / rowHeight) % 2 === 0) {
      pdf.setFillColor(249, 249, 249);
      pdf.rect(margin, y, maxWidth, rowHeight, "F");
    }

    columns.forEach((col, i) => {
      const value = String(row[col.key] ?? "");
      const hasPersian = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(value);
      const processedText = hasPersian ? processPersianText(value) : value;

      const wrapped = pdf.splitTextToSize(processedText, colWidth - 4);
      const textToDraw = wrapped[0] || "";

      if (hasPersian) {
        pdf.text(textToDraw, margin + (i + 1) * colWidth - 2, y + 6, { align: "right" });
      } else {
        pdf.text(textToDraw, margin + i * colWidth + 2, y + 6, { align: "left" });
      }
    });

    y += rowHeight;
  }

  // Border
  pdf.setDrawColor(200, 200, 200);
  pdf.rect(margin, tableStartY, maxWidth, y - tableStartY);

  // Page numbers
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    if (base64Font) {
      pdf.setFont("Vazirmatn", "normal");
    } else {
      pdf.setFont("helvetica", "normal");
    }
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Page ${i} / ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
  }

  pdf.save(`${filename}.pdf`);
}

// ============================================================
// Helper
// ============================================================

function downloadBlob(content: string, filename: string, contentType: string) {
  const blob = new Blob(["\uFEFF" + content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
