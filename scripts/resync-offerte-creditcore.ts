/**
 * Ri-sync offerte PUBBLICATE su CreditCore con campi card completi
 * (scadenza, orario, guadagno, notizie veloci, companyName).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import sql from "mssql";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function loadSaPath(): string {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (fromEnv) return fromEnv;
  const envFile = readFileSync(path.resolve(".env"), "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const m = line.match(/^\s*FIREBASE_SERVICE_ACCOUNT_PATH\s*=\s*(.*)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("FIREBASE_SERVICE_ACCOUNT_PATH mancante");
}

function scheduleLabel(orario: string): string | null {
  switch (String(orario || "").trim().toUpperCase()) {
    case "FULL_TIME":
      return "Full time";
    case "PART_TIME":
      return "Part time";
    case "TURNO":
      return "Turni";
    default:
      return String(orario || "").trim() || null;
  }
}

function contractLabel(tipo: string): string | null {
  switch (String(tipo || "").trim().toUpperCase()) {
    case "TEMPO_INDETERMINATO":
      return "Tempo indeterminato";
    case "TEMPO_DETERMINATO":
      return "Tempo determinato";
    case "APPRENDISTATO":
      return "Apprendistato";
    case "STAGE":
      return "Stage";
      case "COLLABORAZIONE":
      return "Collaborazione / progetto";
    default:
      return String(tipo || "").trim() || null;
  }
}

function modeLabel(modalita: string): string {
  switch (modalita) {
    case "REMOTO":
      return "Da remoto";
    case "IBRIDO":
      return "Ibrido";
    default:
      return "In presenza";
  }
}

function workMode(modalita: string): string {
  switch (modalita) {
    case "REMOTO":
      return "remote";
    case "IBRIDO":
      return "hybrid";
    default:
      return "presence";
  }
}

loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve("connector/.env"));

async function main() {
  const pool = await sql.connect({
    server: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME || "CredixaDev",
    user: process.env.DB_USER || "credixa_dev",
    password: process.env.DB_PASSWORD || "",
    options: { encrypt: false, trustServerCertificate: true },
  });

  const sa = JSON.parse(readFileSync(path.resolve(loadSaPath()), "utf8"));
  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  if (!getApps().length) initializeApp({ credential: cert(sa as never) });
  const db = getFirestore();

  const rows = await pool.request().query(`
    SELECT o.Id AS OffertaId, o.TenantId, t.Nome AS TenantNome,
           o.Titolo, o.Luogo, o.ModalitaLavoro, o.TipoContratto, o.Orario,
           o.Descrizione, o.AttivitaPrincipali, o.Requisiti, o.Competenze,
           o.Retribuzione, o.Benefit, o.NumeroPosizioni, o.IndeedJobId, o.CreatedAt
    FROM dbo.OfferteLavoro o
    LEFT JOIN dbo.Tenants t ON t.Id = o.TenantId
    WHERE o.Stato = N'PUBBLICATA'
  `);

  const patched: string[] = [];
  for (const row of rows.recordset) {
    const tenantId = String(row.TenantId);
    const offertaId = String(row.OffertaId);
    const companyName = String(row.TenantNome || "").trim() || tenantId;
    const docId = `gestionale_${tenantId.replace(/[^a-zA-Z0-9_-]/g, "_")}_${offertaId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const createdAt = row.CreatedAt instanceof Date ? row.CreatedAt : new Date();
    const expiryDate = new Date(createdAt.getTime());
    expiryDate.setUTCDate(expiryDate.getUTCDate() + 60);

    const sched = scheduleLabel(String(row.Orario || ""));
    const contr = contractLabel(String(row.TipoContratto || ""));
    const quickNews: string[] = [];
    if (sched) quickNews.push(sched);
    if (contr) quickNews.push(contr);
    quickNews.push(modeLabel(String(row.ModalitaLavoro || "")));
    if (Number(row.NumeroPosizioni) > 1) {
      quickNews.push(`${row.NumeroPosizioni} posizioni`);
    }
    for (const b of String(row.Benefit || "")
      .split(/\r?\n|;|•/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (quickNews.length >= 6) break;
      quickNews.push(b.length > 40 ? `${b.slice(0, 40)}…` : b);
    }

    await db
      .collection("job_offers")
      .doc(docId)
      .set(
        {
          source: "gestionale",
          tenantId,
          offertaId,
          indeedJobId: row.IndeedJobId || null,
          title: row.Titolo,
          companyId: tenantId,
          companyName,
          location: row.Luogo,
          description: row.Descrizione || "",
          tasks: row.AttivitaPrincipali || null,
          skills: row.Competenze || null,
          benefits: row.Benefit || null,
          salary: row.Retribuzione || null,
          positions: row.NumeroPosizioni,
          workMode: workMode(String(row.ModalitaLavoro || "")),
          schedule: row.Orario || null,
          scheduleLabel: sched,
          contractType: row.TipoContratto || null,
          contractLabel: contr,
          requirements: row.Requisiti || null,
          quickNews,
          expiryDate,
          status: "approved",
          online: true,
          updatedAt: new Date(),
          createdAt,
        },
        { merge: true }
      );
    patched.push(
      `${row.Titolo} | orario=${sched || "-"} | guadagno=${row.Retribuzione || "-"} | scadenza=${expiryDate.toISOString().slice(0, 10)}`
    );
  }

  console.log(JSON.stringify({ ok: true, patched }, null, 2));
  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
