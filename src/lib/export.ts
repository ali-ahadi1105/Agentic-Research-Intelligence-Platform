/**
 * Export Utilities — PDF and CSV generation
 *
 * Uses jsPDF for PDF generation and PapaParse for CSV.
 * All exports happen client-side — no server roundtrip needed.
 */
import "client-only";
import Papa from "papaparse";

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
  _filename: string
) {
  // Open a new window with proper styling, then user clicks "دریافت PDF" to print/save
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    // Fallback: download markdown
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.md`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // Absolute font URL (relative doesn't work in a new blank window)
  const origin = window.location.origin;

  printWindow.document.write(`
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @font-face {
      font-family: 'Vazirmatn';
      src: url('${origin}/fonts/Vazirmatn-Regular.ttf') format('truetype');
      font-weight: normal;
    }
    @font-face {
      font-family: 'Vazirmatn';
      src: url('${origin}/fonts/Vazirmatn-Regular.ttf') format('truetype');
      font-weight: bold;
    }
    * { font-family: 'Vazirmatn', 'Noto Naskh Arabic', 'DejaVu Sans', sans-serif; }
    body {
      direction: rtl; text-align: right;
      padding: 2cm; line-height: 1.8;
      color: #1a1a1a; font-size: 12pt;
    }
    h1 { font-size: 22pt; margin-top: 0; margin-bottom: 0.5em; }
    h2 { font-size: 16pt; margin-top: 1.5em; }
    h3 { font-size: 14pt; margin-top: 1.2em; }
    p { margin: 0.5em 0; }
    ul, ol { padding-right: 1.5em; padding-left: 0; }
    li { margin: 0.3em 0; }
    table { width: 100%; border-collapse: collapse; margin: 1em 0; }
    th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: right; }
    th { background: #f0f0f0; }
    .toolbar {
      text-align: center; padding: 20px 0; border-bottom: 2px solid #eee;
      margin-bottom: 20px;
    }
    .btn-pdf {
      background: #2563eb; color: white; border: none;
      padding: 12px 32px; font-size: 16px; border-radius: 8px;
      cursor: pointer; font-family: 'Vazirmatn', sans-serif;
    }
    .btn-pdf:hover { background: #1d4ed8; }
    .btn-pdf svg { vertical-align: middle; margin-left: 8px; }
    @media print {
      @page { margin: 2cm; }
      body { padding: 0; }
      .toolbar { display: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn-pdf" onclick="window.print()">
      📥 دریافت PDF / Save as PDF
    </button>
    <p style="color:#666;font-size:10pt;margin-top:8px">
      روی دکمه کلیک کن، سپس در پنجره باز شده «Save as PDF» را انتخاب کن
    </p>
  </div>
  <h1>${title}</h1>
  <div id="content"></div>
  <script>
    const contentDiv = document.getElementById('content');
    const md = ${JSON.stringify(content)};
    
    let html = md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="font-size:18pt">$1</h1>')
      .replace(/^\\*\\*(.+)\\*\\*$/gm, '<strong>$1</strong>')
      .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
      .replace(/\\n{2,}/g, '</p><p>')
      .replace(/\\n/g, '<br>');
    
    html = html.replace(/(<li>.*<\\/li>(\\s*<li>.*<\\/li>)*)/g, '<ul>$1</ul>');
    contentDiv.innerHTML = '<p>' + html + '</p>';
  </script>
</body>
</html>
  `);

  printWindow.document.close();
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
  _filename: string
) {
  // Use browser print-to-PDF with HTML table for reliable Persian/RTL support
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const origin = window.location.origin;

  const tableRows = rows
    .map(
      (row) =>
        `<tr>${columns
          .map(
            (col) =>
              `<td style="border:1px solid #ccc;padding:6px 10px;text-align:right">${String(
                row[col.key] ?? ""
              )}</td>`
          )
          .join("")}</tr>`
    )
    .join("\n");

  const headerRow = `<tr>${columns
    .map(
      (col) =>
        `<th style="border:1px solid #ccc;padding:8px 12px;text-align:right;background:#f0f0f0;font-weight:bold">${col.label}</th>`
    )
    .join("")}</tr>`;

  printWindow.document.write(`
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @font-face {
      font-family: 'Vazirmatn';
      src: url('${origin}/fonts/Vazirmatn-Regular.ttf') format('truetype');
    }
    * { font-family: 'Vazirmatn', 'Noto Naskh Arabic', 'DejaVu Sans', sans-serif; }
    body { direction: rtl; text-align: right; padding: 2cm; color: #1a1a1a; }
    h1 { font-size: 18pt; }
    table { width: 100%; border-collapse: collapse; margin-top: 1em; }
    th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: right; }
    th { background: #f0f0f0; font-weight: bold; }
    .toolbar { text-align: center; padding: 20px 0; border-bottom: 2px solid #eee; margin-bottom: 20px; }
    .btn-pdf {
      background: #2563eb; color: white; border: none;
      padding: 12px 32px; font-size: 16px; border-radius: 8px;
      cursor: pointer; font-family: 'Vazirmatn', sans-serif;
    }
    .btn-pdf:hover { background: #1d4ed8; }
    @media print { @page { margin: 1.5cm; } body { padding: 0; } .toolbar { display: none; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn-pdf" onclick="window.print()">📥 دریافت PDF / Save as PDF</button>
    <p style="color:#666;font-size:10pt;margin-top:8px">روی دکمه کلیک کن، سپس «Save as PDF» را انتخاب کن</p>
  </div>
  <h1>${title}</h1>
  <table>${headerRow}${tableRows}</table>
</body>
</html>
  `);
  printWindow.document.close();
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
