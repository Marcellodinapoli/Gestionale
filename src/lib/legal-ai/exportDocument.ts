/** Download locale Word/PDF — solo client, nessun upload server. */

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Word apre correttamente HTML salvato come .doc (export locale). */
export function exportDraftAsWordDoc(title: string, body: string) {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body).replace(/\n/g, "<br/>");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeTitle}</title></head><body><pre style="font-family:Calibri, sans-serif; white-space:pre-wrap;">${safeBody}</pre></body></html>`;
  const blob = new Blob(["\ufeff", html], {
    type: "application/msword;charset=utf-8",
  });
  const base = title.replace(/[^\w\-]+/gi, "_").slice(0, 80) || "atto";
  downloadBlob(`${base}.doc`, blob);
}

/** PDF testuale minimale (PDF 1.4) senza dipendenze esterne. */
export function exportDraftAsPdf(title: string, body: string) {
  const lines = wrapPdfLines(body, 90);
  const contentLines = [
    "BT",
    "/F1 11 Tf",
    "50 750 Td",
    `(${escapePdfString(title.slice(0, 120))}) Tj`,
    "0 -18 Td",
    "/F1 10 Tf",
  ];
  for (const line of lines) {
    contentLines.push(`(${escapePdfString(line)}) Tj`);
    contentLines.push("0 -14 Td");
  }
  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const streamLen = new TextEncoder().encode(stream).length;

  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj",
    `4 0 obj<< /Length ${streamLen} >>stream\n${stream}\nendstream\nendobj`,
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + "\n";
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const base = title.replace(/[^\w\-]+/gi, "_").slice(0, 80) || "atto";
  downloadBlob(`${base}.pdf`, blob);
}

function escapePdfString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapPdfLines(text: string, maxLen: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    let rest = paragraph.trim();
    if (!rest) {
      out.push("");
      continue;
    }
    while (rest.length > maxLen) {
      let cut = rest.lastIndexOf(" ", maxLen);
      if (cut < 20) cut = maxLen;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
  }
  return out.slice(0, 45);
}
