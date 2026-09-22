export type CvValidationOk = {
  ok: true;
  contentType: string;
  extension: "pdf" | "doc" | "docx";
};

export type CvValidationErr = {
  ok: false;
  status: 400 | 413;
  code: string;
  message: string;
};

const ALLOWED: Record<
  string,
  { extension: "pdf" | "doc" | "docx"; magics: Buffer[] }
> = {
  "application/pdf": {
    extension: "pdf",
    magics: [Buffer.from("%PDF")],
  },
  "application/msword": {
    extension: "doc",
    // OLE Compound File
    magics: [Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extension: "docx",
    // ZIP / PK
    magics: [Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from([0x50, 0x4b, 0x05, 0x06])],
  },
};

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function matchesMagic(bytes: Buffer, magics: Buffer[]): boolean {
  return magics.some(
    (m) => bytes.length >= m.length && bytes.subarray(0, m.length).equals(m)
  );
}

function extensionFromFileName(fileName: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return m ? m[1]!.toLowerCase() : null;
}

/**
 * Valida MIME, estensione, magic bytes e dimensione CV.
 */
export function validateCvUpload(opts: {
  bytes: Buffer;
  contentType: string | undefined;
  fileName: string;
  maxBytes: number;
}): CvValidationOk | CvValidationErr {
  if (!opts.bytes || opts.bytes.length === 0) {
    return {
      ok: false,
      status: 400,
      code: "EMPTY_FILE",
      message: "File vuoto",
    };
  }
  if (opts.bytes.length > opts.maxBytes) {
    return {
      ok: false,
      status: 413,
      code: "FILE_TOO_LARGE",
      message: "File oltre MAX_CV_SIZE_BYTES",
    };
  }

  const ext = extensionFromFileName(opts.fileName);
  if (!ext || !EXT_TO_MIME[ext]) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_EXTENSION",
      message: "Estensione consentite: pdf, doc, docx",
    };
  }

  const declared = String(opts.contentType || "")
    .split(";")[0]!
    .trim()
    .toLowerCase();
  const expectedMime = EXT_TO_MIME[ext]!;
  const mime = declared || expectedMime;
  const rule = ALLOWED[mime];
  if (!rule) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_MIME",
      message: "MIME non consentito",
    };
  }
  if (rule.extension !== ext) {
    return {
      ok: false,
      status: 400,
      code: "MIME_EXTENSION_MISMATCH",
      message: "MIME e estensione non coerenti",
    };
  }
  if (!matchesMagic(opts.bytes, rule.magics)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_MAGIC",
      message: "Contenuto file non valido per il tipo dichiarato",
    };
  }

  return { ok: true, contentType: mime, extension: rule.extension };
}
