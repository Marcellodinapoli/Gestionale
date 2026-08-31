/**
 * Genera database/scripts/migration-audit.md
 * Uso: node database/scripts/generate-migration-audit.mjs
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const SRC = join(ROOT, "src");

const MODELS = [
  "pratica", "incasso", "attivita", "user", "mandante", "debitore", "garante",
  "importBatch", "auditLog", "configurazioneSistema", "messaggioInterno",
  "messaggioAgenda", "impegnoAgenda", "praticaLock", "postazione", "sede",
  "provvigione", "fattura", "pianoRata", "documento", "registrazioneChiamata",
  "tenant", "debitoreRecapito", "garanteRecapito", "passwordHistory",
];

const DOMAIN_MAP = {
  pratica: "Pratiche",
  incasso: "Incassi",
  attivita: "Attivita",
  user: "Utenti",
  mandante: "Mandanti",
  debitore: "Debitori",
  debitoreRecapito: "Recapiti",
  garante: "Garanti",
  garanteRecapito: "Recapiti",
  importBatch: "Import/Affidi",
  auditLog: "Audit",
  configurazioneSistema: "Configurazione",
  messaggioInterno: "Messaggi",
  messaggioAgenda: "Agenda/Memo",
  impegnoAgenda: "Agenda",
  praticaLock: "Lock",
  postazione: "Postazioni",
  sede: "Sedi",
  provvigione: "Provvigioni",
  fattura: "Fatture",
  pianoRata: "PianoRate",
  documento: "Documenti",
  registrazioneChiamata: "Registrazioni",
  tenant: "Tenant/Auth",
  passwordHistory: "Auth",
};

const CONNECTOR_ENDPOINTS = [
  "GET /health",
  "GET /health/db",
  "GET /api/v1/tenants/:tenantId/pratiche/:id",
  "POST /api/v1/tenants/:tenantId/pratiche/search",
  "GET /api/v1/tenants/:tenantId/dashboard/home",
  "GET|POST|DELETE /api/v1/tenants/:tenantId/pratiche/:id/lock",
];

const SQL_TABLES = [
  "Tenants", "Users", "Sedi", "Postazioni", "Mandanti", "Debitori", "DebitoreRecapiti",
  "Pratiche", "Garanti", "GaranteRecapiti", "Incassi", "Attivita", "Provvigioni",
  "PianoRate", "ImportBatch", "Fatture", "Documenti", "RegistrazioniChiamate",
  "PraticheLock", "MessaggiInterni", "MessaggiAgenda", "ImpegniAgenda",
  "AuditLog", "ConfigurazioneSistema", "DashboardKpi", "PasswordHistory",
];

async function walk(dir, acc = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "formazione" || ent.name === "node_modules") continue;
      await walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(ent.name)) {
      acc.push(p);
    }
  }
  return acc;
}

function classifyFile(rel) {
  if (rel.includes("formazione")) return "formazione";
  if (rel.includes("firebase/firebasePrisma")) return "adapter";
  if (rel.includes("lib/prisma")) return "shim";
  if (rel.startsWith("src\\actions\\") || rel.startsWith("src/actions/")) return "actions";
  if (rel.includes("\\api\\") || rel.includes("/api/")) return "api";
  if (rel.includes("\\app\\") || rel.includes("/app/")) return "pages";
  return "lib";
}

async function main() {
  const files = await walk(SRC);
  const fileStats = [];
  const modelTotals = Object.fromEntries(MODELS.map((m) => [m, 0]));
  const opTotals = { findMany: 0, findFirst: 0, findUnique: 0, count: 0, aggregate: 0, groupBy: 0, create: 0, update: 0, delete: 0, createMany: 0, updateMany: 0, deleteMany: 0, upsert: 0 };
  let totalPrisma = 0;
  let firestoreDirect = 0;

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (rel.includes("lib/firebase/firebasePrisma")) continue;
    if (rel.includes("lib/data/")) continue;

    const content = await readFile(file, "utf8");
    const prismaMatches = [...content.matchAll(/prisma\.(\w+)\.(\w+)/g)];
    if (!prismaMatches.length && !/firestore|getFirestore|firebase-admin/.test(content)) continue;

    const models = {};
    const ops = {};
    for (const [, model, op] of prismaMatches) {
      models[model] = (models[model] ?? 0) + 1;
      ops[op] = (ops[op] ?? 0) + 1;
      if (modelTotals[model] !== undefined) modelTotals[model] += 1;
      if (opTotals[op] !== undefined) opTotals[op] += 1;
      totalPrisma += 1;
    }

    const fsHits = (content.match(/getFirestore|firestore\(\)|firebase-admin/g) ?? []).length;
    firestoreDirect += fsHits;

    if (prismaMatches.length || fsHits) {
      fileStats.push({
        rel,
        kind: classifyFile(rel),
        prisma: prismaMatches.length,
        firestore: fsHits,
        models,
        ops,
      });
    }
  }

  fileStats.sort((a, b) => b.prisma - a.prisma);

  const domainRollup = {};
  for (const [model, count] of Object.entries(modelTotals)) {
    if (!count) continue;
    const d = DOMAIN_MAP[model] ?? model;
    domainRollup[d] = (domainRollup[d] ?? 0) + count;
  }

  const lines = [];
  lines.push("# Migration Audit — Credixa Firestore → SQL Connector");
  lines.push("");
  lines.push(`Generato: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Riepilogo");
  lines.push("");
  lines.push(`| Metrica | Valore |`);
  lines.push(`|---------|--------|`);
  lines.push(`| File con chiamate \`prisma.*\` (escl. adapter) | **${fileStats.length}** |`);
  lines.push(`| Chiamate \`prisma.*\` totali (stima) | **~${totalPrisma}** |`);
  lines.push(`| Riferimenti Firestore diretti (non formazione) | **${firestoreDirect}** |`);
  lines.push(`| Tabelle SQL CredixaDev | **${SQL_TABLES.length}** |`);
  lines.push(`| Endpoint Connettore attuali | **${CONNECTOR_ENDPOINTS.length}** |`);
  lines.push("");
  lines.push("## Chiamate per modello Prisma");
  lines.push("");
  lines.push("| Modello | Chiamate | Dominio | Repository | Stato |");
  lines.push("|---------|----------|---------|------------|-------|");
  for (const model of MODELS.sort((a, b) => (modelTotals[b] ?? 0) - (modelTotals[a] ?? 0))) {
    const c = modelTotals[model] ?? 0;
    if (!c) continue;
    const domain = DOMAIN_MAP[model] ?? "?";
    const repo = `Connector${domain.replace(/\//g, "")}Repository`;
    lines.push(`| \`${model}\` | ${c} | ${domain} | \`${repo}\` | ⬜ da migrare |`);
  }
  lines.push("");
  lines.push("## Chiamate per operazione");
  lines.push("");
  lines.push("| Operazione | Count | Note migrazione |");
  lines.push("|------------|-------|-----------------|");
  for (const [op, c] of Object.entries(opTotals).sort((a, b) => b[1] - a[1])) {
    if (!c) continue;
    const note = ["aggregate", "groupBy"].includes(op) ? "⚠️ full-scan Firestore → SQL aggregato/KPI" : "";
    lines.push(`| \`${op}\` | ${c} | ${note} |`);
  }
  lines.push("");
  lines.push("## Rollup per dominio funzionale");
  lines.push("");
  for (const [d, c] of Object.entries(domainRollup).sort((a, b) => b[1] - a[1])) {
    lines.push(`- **${d}**: ~${c} chiamate prisma`);
  }
  lines.push("");
  lines.push("## Endpoint Connettore — stato");
  lines.push("");
  lines.push("### Implementati");
  for (const e of CONNECTOR_ENDPOINTS) lines.push(`- ✅ ${e}`);
  lines.push("");
  lines.push("### Da implementare (minimo)");
  const needed = [
    "POST /api/v1/tenants/:tenantId/pratiche (create)",
    "PATCH /api/v1/tenants/:tenantId/pratiche/:id",
    "GET /api/v1/tenants/:tenantId/debitori/:id",
    "GET /api/v1/tenants/:tenantId/mandanti",
    "GET /api/v1/tenants/:tenantId/incassi (search/by pratica)",
    "POST /api/v1/tenants/:tenantId/incassi",
    "GET|POST /api/v1/tenants/:tenantId/attivita",
    "GET /api/v1/tenants/:tenantId/users",
    "GET /api/v1/tenants/:tenantId/agenda/memo",
    "GET /api/v1/tenants/:tenantId/agenda/impegni",
    "GET|POST /api/v1/tenants/:tenantId/messaggi",
    "GET|POST /api/v1/tenants/:tenantId/import/batches",
    "GET|PUT /api/v1/tenants/:tenantId/config",
    "POST /api/v1/tenants/:tenantId/audit",
    "GET /api/v1/tenants/:tenantId/garanti/by-pratica/:praticaId",
    "GET /api/v1/tenants/:tenantId/rate/by-pratica/:praticaId",
    "GET /api/v1/tenants/:tenantId/sedi",
    "GET /api/v1/tenants/:tenantId/postazioni",
    "GET /api/v1/tenants/:tenantId/provvigioni",
  ];
  for (const e of needed) lines.push(`- ⬜ ${e}`);
  lines.push("");
  lines.push("## File coinvolti (ordinati per impatto)");
  lines.push("");
  lines.push("| File | Tipo | prisma | Firestore | Modelli principali |");
  lines.push("|------|------|--------|-----------|-------------------|");
  for (const f of fileStats.slice(0, 60)) {
    const topModels = Object.entries(f.models).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, n]) => `${m}(${n})`).join(", ");
    lines.push(`| \`${f.rel}\` | ${f.kind} | ${f.prisma} | ${f.firestore} | ${topModels} |`);
  }
  if (fileStats.length > 60) lines.push(`| … | | | | +${fileStats.length - 60} file |`);
  lines.push("");
  lines.push("## Moduli Firestore esclusi dalla migrazione operativa");
  lines.push("");
  lines.push("- `src/lib/formazione/**` — Formazione (Firebase Auth + Firestore client)");
  lines.push("- `src/components/formazione/**`");
  lines.push("- `src/lib/firebase/firebasePrisma.ts` — adapter legacy (deprecare a fine migrazione)");
  lines.push("");
  lines.push("## Gap schema SQL vs app");
  lines.push("");
  lines.push("| Area | Gap | Azione |");
  lines.push("|------|-----|--------|");
  lines.push("| Mandanti | `PerimetriJson` vs struttura perimetri app | migration 006 se necessario |");
  lines.push("| Users | `GruppoMandantiJson`, `LavorazioneSuggerita` | verificare colonne mancanti |");
  lines.push("| DashboardKpi | tabella vuota | popolare job/batch o query aggregate |");
  lines.push("| Import | flussi batch complessi | endpoint import dedicati |");
  lines.push("");

  const out = join(ROOT, "database", "scripts", "migration-audit.md");
  await writeFile(out, lines.join("\n"), "utf8");
  console.log(`Scritto ${out} (${fileStats.length} file, ~${totalPrisma} chiamate prisma)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
