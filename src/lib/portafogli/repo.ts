import "server-only";
import { randomUUID } from "node:crypto";
import { neonQuery } from "@/lib/neon/pool";
import { isNeonConfigured } from "@/lib/neon/client";
import { isNeonProvider } from "@/lib/data/factory";
import { prisma } from "@/lib/prisma";
import { isUuid } from "@/lib/tenant";
import { isManutenzione, type SessionUser } from "@/lib/permissions";
import {
  isPortafoglioStato,
  isPortafoglioTipo,
  type ImportBatchOption,
  type PortafoglioKpi,
  type PortafoglioListRow,
  type PortafoglioPraticaRow,
  type PortafoglioRecord,
  type PortafoglioWriteInput,
} from "@/lib/portafogli/types";

function tenantIdOrThrow(user: SessionUser) {
  const id = String(user.tenantId || "").trim();
  if (!id) throw new Error("Tenant mancante");
  return id;
}

function asTipo(v: unknown) {
  const s = String(v || "NPL");
  return isPortafoglioTipo(s) ? s : "NPL";
}

function asStato(v: unknown) {
  const s = String(v || "IN_VALUTAZIONE");
  return isPortafoglioStato(s) ? s : "IN_VALUTAZIONE";
}

function asDate(v: unknown): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function asNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapRecord(row: Record<string, unknown>): PortafoglioRecord {
  return {
    id: String(row.id ?? row.Id),
    tenantId: String(row.tenantId ?? row.TenantId),
    nome: String(row.nome ?? row.Nome ?? ""),
    codice: row.codice != null || row.Codice != null ? String(row.codice ?? row.Codice) : null,
    venditore:
      row.venditore != null || row.Venditore != null
        ? String(row.venditore ?? row.Venditore)
        : null,
    servicer:
      row.servicer != null || row.Servicer != null
        ? String(row.servicer ?? row.Servicer)
        : null,
    tipo: asTipo(row.tipo ?? row.Tipo),
    stato: asStato(row.stato ?? row.Stato),
    dataCutoff: asDate(row.dataCutoff ?? row.DataCutoff),
    dataAcquisto: asDate(row.dataAcquisto ?? row.DataAcquisto),
    nominaleDichiarato: asNum(row.nominaleDichiarato ?? row.NominaleDichiarato),
    prezzoOfferto:
      row.prezzoOfferto != null || row.PrezzoOfferto != null
        ? asNum(row.prezzoOfferto ?? row.PrezzoOfferto)
        : null,
    prezzoPagato:
      row.prezzoPagato != null || row.PrezzoPagato != null
        ? asNum(row.prezzoPagato ?? row.PrezzoPagato)
        : null,
    speseAcquisto: asNum(row.speseAcquisto ?? row.SpeseAcquisto),
    recuperoAtteso:
      row.recuperoAtteso != null || row.RecuperoAtteso != null
        ? asNum(row.recuperoAtteso ?? row.RecuperoAtteso)
        : null,
    note: row.note != null || row.Note != null ? String(row.note ?? row.Note) : null,
    createdById:
      row.createdById != null || row.CreatedById != null
        ? String(row.createdById ?? row.CreatedById)
        : null,
    createdAt: asDate(row.createdAt ?? row.CreatedAt) ?? new Date(),
    updatedAt: asDate(row.updatedAt ?? row.UpdatedAt) ?? new Date(),
  };
}

function usesNeon() {
  return isNeonProvider();
}

async function resolveTenantUuid(tenantId: string, slug?: string | null): Promise<string | null> {
  if (isUuid(tenantId)) return tenantId;
  const s = String(slug || "").trim();
  if (!s || isUuid(s)) return null;
  const rows = await neonQuery(
    `SELECT "Id" FROM "Tenants" WHERE lower("Slug") = lower($1) LIMIT 1`,
    [s]
  );
  const id = rows[0] ? String((rows[0] as { Id?: string }).Id ?? "") : "";
  return isUuid(id) ? id : null;
}

async function requireTenantUuid(user: SessionUser): Promise<string> {
  if (!isNeonConfigured()) {
    throw new Error("NEON_DATABASE_URL non configurato: Portafogli su Neon richiede la connection string.");
  }
  const tid = await resolveTenantUuid(tenantIdOrThrow(user), user.tenantSlug);
  if (!tid) throw new Error("Tenant Neon non risolto");
  return tid;
}

let neonSchemaReady = false;

async function ensureNeonSchema() {
  if (neonSchemaReady) return;
  if (!isNeonConfigured()) {
    throw new Error("NEON_DATABASE_URL non configurato: Portafogli su Neon richiede la connection string.");
  }
  await neonQuery(`
    CREATE TABLE IF NOT EXISTS "Portafogli" (
      "Id" uuid PRIMARY KEY,
      "TenantId" uuid NOT NULL,
      "Nome" text NOT NULL,
      "Codice" text,
      "Venditore" text,
      "Servicer" text,
      "Tipo" text NOT NULL DEFAULT 'NPL',
      "Stato" text NOT NULL DEFAULT 'IN_VALUTAZIONE',
      "DataCutoff" timestamptz,
      "DataAcquisto" timestamptz,
      "NominaleDichiarato" double precision NOT NULL DEFAULT 0,
      "PrezzoOfferto" double precision,
      "PrezzoPagato" double precision,
      "SpeseAcquisto" double precision NOT NULL DEFAULT 0,
      "RecuperoAtteso" double precision,
      "Note" text,
      "CreatedById" uuid,
      "CreatedAt" timestamptz NOT NULL DEFAULT now(),
      "UpdatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await neonQuery(
    `CREATE INDEX IF NOT EXISTS "Portafogli_TenantId_idx" ON "Portafogli" ("TenantId")`
  );
  await neonQuery(`ALTER TABLE "Pratiche" ADD COLUMN IF NOT EXISTS "PortafoglioId" uuid`);
  await neonQuery(`ALTER TABLE "Portafogli" ADD COLUMN IF NOT EXISTS "Servicer" text`);
  neonSchemaReady = true;
}

export async function listPortafogli(user: SessionUser): Promise<PortafoglioListRow[]> {
  if (isManutenzione(user)) return [];
  if (usesNeon()) {
    await ensureNeonSchema();
    const tid = await requireTenantUuid(user);
    const rows = await neonQuery(
      `SELECT pf.*,
         COUNT(p."Id")::int AS "nPratiche",
         COALESCE(SUM(p."Residuo"), 0)::float AS residuo,
         COALESCE((
           SELECT SUM(i."Importo") FROM "Incassi" i
           INNER JOIN "Pratiche" px ON px."Id" = i."PraticaId" AND px."TenantId" = i."TenantId"
           WHERE px."TenantId" = pf."TenantId" AND px."PortafoglioId" = pf."Id"
         ), 0)::float AS incassato
       FROM "Portafogli" pf
       LEFT JOIN "Pratiche" p ON p."PortafoglioId" = pf."Id" AND p."TenantId" = pf."TenantId"
       WHERE pf."TenantId" = $1::uuid
       GROUP BY pf."Id"
       ORDER BY pf."UpdatedAt" DESC`,
      [tid]
    );
    return rows.map((r) => {
      const rec = mapRecord(r as Record<string, unknown>);
      return {
        ...rec,
        nPratiche: asNum((r as { nPratiche?: number }).nPratiche),
        residuo: asNum((r as { residuo?: number }).residuo),
        incassato: asNum((r as { incassato?: number }).incassato),
      };
    });
  }

  const tid = tenantIdOrThrow(user);
  const rows = await prisma.portafoglio.findMany({
    where: { tenantId: tid },
    orderBy: { updatedAt: "desc" },
    include: {
      pratiche: { select: { residuo: true, incassi: { select: { importo: true } } } },
    },
  });
  return rows.map((r) => {
    const rec = mapRecord(r as unknown as Record<string, unknown>);
    return {
      ...rec,
      nPratiche: r.pratiche.length,
      residuo: r.pratiche.reduce((s, p) => s + asNum(p.residuo), 0),
      incassato: r.pratiche.reduce(
        (s, p) => s + p.incassi.reduce((a, i) => a + asNum(i.importo), 0),
        0
      ),
    };
  });
}

export async function getPortafoglio(
  user: SessionUser,
  id: string
): Promise<PortafoglioRecord | null> {
  if (isManutenzione(user)) return null;
  const pid = String(id || "").trim();
  if (!pid) return null;
  if (usesNeon()) {
    if (!isUuid(pid)) return null;
    await ensureNeonSchema();
    const tid = await requireTenantUuid(user);
    const rows = await neonQuery(
      `SELECT * FROM "Portafogli" WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid LIMIT 1`,
      [pid, tid]
    );
    return rows[0] ? mapRecord(rows[0] as Record<string, unknown>) : null;
  }
  const row = await prisma.portafoglio.findFirst({
    where: { id: pid, tenantId: tenantIdOrThrow(user) },
  });
  return row ? mapRecord(row as unknown as Record<string, unknown>) : null;
}

export async function createPortafoglio(
  user: SessionUser,
  input: PortafoglioWriteInput
): Promise<PortafoglioRecord> {
  if (isManutenzione(user)) throw new Error("Operazione non consentita");
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome obbligatorio");
  if (usesNeon()) {
    await ensureNeonSchema();
    const tid = await requireTenantUuid(user);
    const id = randomUUID();
    const createdBy = isUuid(user.id) ? user.id : null;
    await neonQuery(
      `INSERT INTO "Portafogli" (
         "Id","TenantId","Nome","Codice","Venditore","Servicer","Tipo","Stato",
         "DataCutoff","DataAcquisto","NominaleDichiarato","PrezzoOfferto",
         "PrezzoPagato","SpeseAcquisto","RecuperoAtteso","Note","CreatedById"
       ) VALUES (
         $1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,
         $9,$10,$11,$12,$13,$14,$15,$16,$17
       )`,
      [
        id,
        tid,
        nome,
        input.codice?.trim() || null,
        input.venditore?.trim() || null,
        input.servicer?.trim() || null,
        input.tipo,
        input.stato,
        input.dataCutoff ?? null,
        input.dataAcquisto ?? null,
        input.nominaleDichiarato ?? 0,
        input.prezzoOfferto ?? null,
        input.prezzoPagato ?? null,
        input.speseAcquisto ?? 0,
        input.recuperoAtteso ?? null,
        input.note?.trim() || null,
        createdBy,
      ]
    );
    const created = await getPortafoglio(user, id);
    if (!created) throw new Error("Creazione fallita");
    return created;
  }

  const created = await prisma.portafoglio.create({
    data: {
      tenantId: tenantIdOrThrow(user),
      nome,
      codice: input.codice?.trim() || null,
      venditore: input.venditore?.trim() || null,
      servicer: input.servicer?.trim() || null,
      tipo: input.tipo,
      stato: input.stato,
      dataCutoff: input.dataCutoff ?? null,
      dataAcquisto: input.dataAcquisto ?? null,
      nominaleDichiarato: input.nominaleDichiarato ?? 0,
      prezzoOfferto: input.prezzoOfferto ?? null,
      prezzoPagato: input.prezzoPagato ?? null,
      speseAcquisto: input.speseAcquisto ?? 0,
      recuperoAtteso: input.recuperoAtteso ?? null,
      note: input.note?.trim() || null,
      createdById: user.id || null,
    },
  });
  return mapRecord(created as unknown as Record<string, unknown>);
}

export async function updatePortafoglio(
  user: SessionUser,
  id: string,
  input: PortafoglioWriteInput
): Promise<PortafoglioRecord> {
  if (isManutenzione(user)) throw new Error("Operazione non consentita");
  const existing = await getPortafoglio(user, id);
  if (!existing) throw new Error("Portafoglio non trovato");
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome obbligatorio");
  if (usesNeon()) {
    const tid = await requireTenantUuid(user);
    await neonQuery(
      `UPDATE "Portafogli" SET
         "Nome"=$3, "Codice"=$4, "Venditore"=$5, "Servicer"=$6, "Tipo"=$7, "Stato"=$8,
         "DataCutoff"=$9, "DataAcquisto"=$10, "NominaleDichiarato"=$11,
         "PrezzoOfferto"=$12, "PrezzoPagato"=$13, "SpeseAcquisto"=$14,
         "RecuperoAtteso"=$15, "Note"=$16, "UpdatedAt"=now()
       WHERE "Id"=$1::uuid AND "TenantId"=$2::uuid`,
      [
        id,
        tid,
        nome,
        input.codice?.trim() || null,
        input.venditore?.trim() || null,
        input.servicer?.trim() || null,
        input.tipo,
        input.stato,
        input.dataCutoff ?? null,
        input.dataAcquisto ?? null,
        input.nominaleDichiarato ?? 0,
        input.prezzoOfferto ?? null,
        input.prezzoPagato ?? null,
        input.speseAcquisto ?? 0,
        input.recuperoAtteso ?? null,
        input.note?.trim() || null,
      ]
    );
    const updated = await getPortafoglio(user, id);
    if (!updated) throw new Error("Aggiornamento fallito");
    return updated;
  }

  const updated = await prisma.portafoglio.update({
    where: { id },
    data: {
      nome,
      codice: input.codice?.trim() || null,
      venditore: input.venditore?.trim() || null,
      servicer: input.servicer?.trim() || null,
      tipo: input.tipo,
      stato: input.stato,
      dataCutoff: input.dataCutoff ?? null,
      dataAcquisto: input.dataAcquisto ?? null,
      nominaleDichiarato: input.nominaleDichiarato ?? 0,
      prezzoOfferto: input.prezzoOfferto ?? null,
      prezzoPagato: input.prezzoPagato ?? null,
      speseAcquisto: input.speseAcquisto ?? 0,
      recuperoAtteso: input.recuperoAtteso ?? null,
      note: input.note?.trim() || null,
    },
  });
  return mapRecord(updated as unknown as Record<string, unknown>);
}

export async function getPortafoglioKpi(
  user: SessionUser,
  id: string
): Promise<PortafoglioKpi> {
  const empty: PortafoglioKpi = {
    nPratiche: 0,
    residuo: 0,
    incassato: 0,
    nominalePratiche: 0,
    perStato: [],
  };
  if (isManutenzione(user)) return empty;
  const existing = await getPortafoglio(user, id);
  if (!existing) return empty;
  if (usesNeon()) {
    const tid = await requireTenantUuid(user);
    const agg = await neonQuery(
      `SELECT
         COUNT(*)::int AS n,
         COALESCE(SUM(p."Residuo"),0)::float AS residuo,
         COALESCE(SUM(COALESCE(p."ImportoTotale", p."Residuo")),0)::float AS nominale
       FROM "Pratiche" p
       WHERE p."TenantId" = $1::uuid AND p."PortafoglioId" = $2::uuid`,
      [tid, id]
    );
    const inc = await neonQuery(
      `SELECT COALESCE(SUM(i."Importo"),0)::float AS incassato
       FROM "Incassi" i
       INNER JOIN "Pratiche" p ON p."Id" = i."PraticaId" AND p."TenantId" = i."TenantId"
       WHERE p."TenantId" = $1::uuid AND p."PortafoglioId" = $2::uuid`,
      [tid, id]
    );
    const stati = await neonQuery(
      `SELECT p."Stato" AS stato, COUNT(*)::int AS c
       FROM "Pratiche" p
       WHERE p."TenantId" = $1::uuid AND p."PortafoglioId" = $2::uuid
       GROUP BY p."Stato"`,
      [tid, id]
    );
    const a = (agg[0] || {}) as Record<string, number>;
    return {
      nPratiche: asNum(a.n),
      residuo: asNum(a.residuo),
      nominalePratiche: asNum(a.nominale),
      incassato: asNum((inc[0] as { incassato?: number } | undefined)?.incassato),
      perStato: stati.map((r) => ({
        stato: String((r as { stato?: string }).stato || ""),
        count: asNum((r as { c?: number }).c),
      })),
    };
  }

  const pratiche = await prisma.pratica.findMany({
    where: { tenantId: tenantIdOrThrow(user), portafoglioId: id },
    select: {
      stato: true,
      residuo: true,
      capitale: true,
      interessi: true,
      spese: true,
      incassi: { select: { importo: true } },
    },
  });
  const perStato = new Map<string, number>();
  let residuo = 0;
  let incassato = 0;
  let nominale = 0;
  for (const p of pratiche) {
    residuo += asNum(p.residuo);
    nominale += asNum(p.capitale) + asNum(p.interessi) + asNum(p.spese);
    incassato += p.incassi.reduce((s, i) => s + asNum(i.importo), 0);
    perStato.set(p.stato, (perStato.get(p.stato) || 0) + 1);
  }
  return {
    nPratiche: pratiche.length,
    residuo,
    incassato,
    nominalePratiche: nominale,
    perStato: [...perStato.entries()].map(([stato, count]) => ({ stato, count })),
  };
}

export async function listPratichePortafoglio(
  user: SessionUser,
  id: string
): Promise<PortafoglioPraticaRow[]> {
  if (isManutenzione(user)) return [];
  const existing = await getPortafoglio(user, id);
  if (!existing) return [];
  if (usesNeon()) {
    const tid = await requireTenantUuid(user);
    const rows = await neonQuery(
      `SELECT p."Id", p."Numero", p."Stato", p."Residuo", p."TotIncassato",
         COALESCE(d."Cognome",'') AS "Cognome", COALESCE(d."Nome",'') AS "Nome"
       FROM "Pratiche" p
       LEFT JOIN "Debitori" d ON d."Id" = p."DebitoreId" AND d."TenantId" = p."TenantId"
       WHERE p."TenantId" = $1::uuid AND p."PortafoglioId" = $2::uuid
       ORDER BY p."UpdatedAt" DESC
       LIMIT 200`,
      [tid, id]
    );
    return rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.Id),
        numero: String(row.Numero ?? ""),
        stato: String(row.Stato ?? ""),
        residuo: asNum(row.Residuo),
        totIncassato: asNum(row.TotIncassato),
        debitore: `${row.Cognome || ""} ${row.Nome || ""}`.trim(),
      };
    });
  }

  const rows = await prisma.pratica.findMany({
    where: { tenantId: tenantIdOrThrow(user), portafoglioId: id },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      numero: true,
      stato: true,
      residuo: true,
      debitore: { select: { nome: true, cognome: true } },
      incassi: { select: { importo: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    numero: r.numero,
    stato: r.stato,
    residuo: asNum(r.residuo),
    totIncassato: r.incassi.reduce((s, i) => s + asNum(i.importo), 0),
    debitore: `${r.debitore.cognome || ""} ${r.debitore.nome || ""}`.trim(),
  }));
}

export async function listImportBatchTenant(user: SessionUser): Promise<ImportBatchOption[]> {
  if (isManutenzione(user)) return [];
  if (usesNeon()) {
    await ensureNeonSchema();
    const tid = await requireTenantUuid(user);
    const rows = await neonQuery(
      `SELECT "Id", "Lotto", "Perimetro", "NPratiche", "CreatedAt"
       FROM "ImportBatch"
       WHERE "TenantId" = $1::uuid
       ORDER BY "CreatedAt" DESC
       LIMIT 40`,
      [tid]
    );
    return rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.Id),
        lotto: String(row.Lotto ?? ""),
        perimetro: String(row.Perimetro ?? ""),
        nPratiche: asNum(row.NPratiche),
        createdAt: asDate(row.CreatedAt) ?? new Date(),
      };
    });
  }

  const rows = await prisma.importBatch.findMany({
    where: { tenantId: tenantIdOrThrow(user) },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, lotto: true, perimetro: true, nPratiche: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    lotto: r.lotto,
    perimetro: r.perimetro,
    nPratiche: r.nPratiche,
    createdAt: r.createdAt,
  }));
}

export async function collegaImportAlPortafoglio(
  user: SessionUser,
  portafoglioId: string,
  importBatchId: string
): Promise<number> {
  if (isManutenzione(user)) throw new Error("Operazione non consentita");
  const book = await getPortafoglio(user, portafoglioId);
  if (!book) throw new Error("Portafoglio non trovato");
  const bid = String(importBatchId || "").trim();
  if (!bid) throw new Error("Dati non validi");
  if (usesNeon()) {
    if (!isUuid(bid) || !isUuid(portafoglioId)) throw new Error("Dati non validi");
    const tid = await requireTenantUuid(user);
    const own = await neonQuery(
      `SELECT "Id" FROM "ImportBatch" WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid LIMIT 1`,
      [bid, tid]
    );
    if (!own[0]) throw new Error("Lotto import non trovato in questa azienda");
    await neonQuery(
      `UPDATE "Pratiche"
       SET "PortafoglioId" = $1::uuid
       WHERE "TenantId" = $2::uuid AND "ImportBatchId" = $3::uuid`,
      [portafoglioId, tid, bid]
    );
    const counted = await neonQuery(
      `SELECT COUNT(*)::int AS c FROM "Pratiche"
       WHERE "TenantId" = $1::uuid AND "PortafoglioId" = $2::uuid AND "ImportBatchId" = $3::uuid`,
      [tid, portafoglioId, bid]
    );
    return asNum((counted[0] as { c?: number } | undefined)?.c);
  }

  const tid = tenantIdOrThrow(user);
  const own = await prisma.importBatch.findFirst({
    where: { id: bid, tenantId: tid },
    select: { id: true },
  });
  if (!own) throw new Error("Lotto import non trovato in questa azienda");
  const updated = await prisma.pratica.updateMany({
    where: { tenantId: tid, importBatchId: bid },
    data: { portafoglioId },
  });
  return updated.count;
}
