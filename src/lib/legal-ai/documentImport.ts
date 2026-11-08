/**
 * Estrazione testo da file caricati in Legal AI — solo client, nessun upload server.
 */

export const LEGAL_AI_IMPORT_MAX_BYTES = 1_500_000;

const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".log"];

export function legalAiImportAcceptAttribute(): string {
  return [".txt", ".md", ".html", ".htm", ".rtf", ".docx"].join(",");
}

function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i >= 0 ? fileName.slice(i).toLowerCase() : "";
}

function normalizeExtractedText(raw: string): { ok: true; text: string } | { ok: false; message: string } {
  const text = raw.replace(/\u0000/g, "").trim();
  if (!text) {
    return { ok: false, message: "Il file non contiene testo leggibile." };
  }
  if (text.length > 500_000) {
    return { ok: false, message: "Testo estratto troppo lungo per la sessione locale." };
  }
  return { ok: true, text };
}

function htmlToPlainText(html: string): string {
  const withoutBlocks = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withBreaks = withoutBlocks
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, " ");
  return stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function rtfToPlainText(rtf: string): string {
  let s = rtf.replace(/\\'[0-9a-f]{2}/gi, " ");
  s = s.replace(/\\par[d]?/gi, "\n");
  s = s.replace(/\{\\[^}]*\}/g, " ");
  s = s.replace(/[{}\\]/g, " ");
  return s.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

function docxXmlToPlainText(xml: string): string {
  const withBreaks = xml
    .replace(/<w:tab[^/]*\/>/gi, "\t")
    .replace(/<w:br[^/]*\/>/gi, "\n")
    .replace(/<\/w:p>/gi, "\n\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, " ");
  return stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function inflateRawDeflate(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Browser non supporta decompressione DOCX.");
  }
  const ds = new DecompressionStream("deflate-raw");
  const copy = new Uint8Array(compressed.byteLength);
  copy.set(compressed);
  const stream = new Blob([copy]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/** Estrae word/document.xml da un buffer DOCX (ZIP) senza dipendenze esterne. */
export async function extractDocxDocumentXml(buffer: ArrayBuffer): Promise<string | null> {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder("utf-8");
  let offset = 0;
  const target = "word/document.xml";

  while (offset + 30 <= bytes.length) {
    if (
      bytes[offset] !== 0x50 ||
      bytes[offset + 1] !== 0x4b ||
      bytes[offset + 2] !== 0x03 ||
      bytes[offset + 3] !== 0x04
    ) {
      break;
    }
    const method = bytes[offset + 8]! | (bytes[offset + 9]! << 8);
    const compSize =
      bytes[offset + 18]! |
      (bytes[offset + 19]! << 8) |
      (bytes[offset + 20]! << 16) |
      (bytes[offset + 21]! << 24);
    const nameLen = bytes[offset + 26]! | (bytes[offset + 27]! << 8);
    const extraLen = bytes[offset + 28]! | (bytes[offset + 29]! << 8);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > bytes.length) break;
    const entryName = decoder.decode(bytes.subarray(nameStart, nameEnd));
    const dataStart = nameEnd + extraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > bytes.length) break;

    if (entryName === target) {
      const chunk = bytes.subarray(dataStart, dataEnd);
      if (method === 0) {
        return decoder.decode(chunk);
      }
      if (method === 8) {
        const inflated = await inflateRawDeflate(chunk);
        return decoder.decode(inflated);
      }
      return null;
    }

    offset = dataEnd;
  }
  return null;
}

export async function extractLegalAiDocumentText(
  file: Pick<File, "name" | "size" | "text" | "arrayBuffer">
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  if (file.size > LEGAL_AI_IMPORT_MAX_BYTES) {
    return { ok: false, message: "File troppo grande (max 1,5 MB)." };
  }

  const ext = extensionOf(file.name);

  if (TEXT_EXTENSIONS.includes(ext)) {
    return normalizeExtractedText(await file.text());
  }
  if (ext === ".html" || ext === ".htm") {
    return normalizeExtractedText(htmlToPlainText(await file.text()));
  }
  if (ext === ".rtf") {
    return normalizeExtractedText(rtfToPlainText(await file.text()));
  }
  if (ext === ".docx") {
    try {
      const xml = await extractDocxDocumentXml(await file.arrayBuffer());
      if (!xml) {
        return { ok: false, message: "Impossibile leggere il contenuto del file Word (.docx)." };
      }
      return normalizeExtractedText(docxXmlToPlainText(xml));
    } catch {
      return { ok: false, message: "Impossibile aprire il file .docx in questo browser." };
    }
  }
  if (ext === ".doc") {
    return {
      ok: false,
      message: "I file .doc non sono supportati: salva come .docx o .txt e ricarica.",
    };
  }
  if (ext === ".pdf") {
    return {
      ok: false,
      message: "I PDF non sono ancora supportati: esporta il testo in .docx o .txt.",
    };
  }

  return {
    ok: false,
    message: "Formato non supportato. Usa .txt, .md, .html, .rtf o .docx.",
  };
}

export function legalAiDocumentPreview(text: string, maxLen = 480): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}
