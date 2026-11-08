import "server-only";
import type { CreditCalcConnection } from "./types";
import { isConnectorProvider } from "@/lib/data/factory";
import { usersDb } from "@/lib/usersRepo";
import { praticaDb, type PraticaDbContext } from "@/lib/praticheRepo";
import { attivitaDb } from "@/lib/attivitaRepo";
import { writeAudit } from "@/lib/domain";

function dbCtx(c: CreditCalcConnection): PraticaDbContext {
  return {
    tenantId: c.tenantId,
    tenantSlug: c.tenantSlug,
    skipRoleScope: true,
  };
}

function assertOperationalNotConnector() {
  if (isConnectorProvider()) {
    throw Object.assign(
      new Error(
        "CredixaApp legge i dati sul database operativo (Neon). Il Connettore non è usato per le pratiche in affido."
      ),
      { status: 503 }
    );
  }
}

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString();
}

function serializeValue(v: unknown): unknown {
  if (v == null) return v;
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(serializeValue);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = serializeValue(val);
    }
    return out;
  }
  return v;
}

function mapRows(rows: unknown): Record<string, unknown>[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => serializeValue(r) as Record<string, unknown>);
}

async function assertCreditCalcUser(c: CreditCalcConnection) {
  assertOperationalNotConnector();
  const ctx = dbCtx(c);
  const user = await usersDb(ctx).findUnique({
    where: { id: c.gestionaleUserId },
    select: {
      id: true,
      tenantId: true,
      email: true,
      name: true,
      role: true,
      active: true,
      consulenteEsterno: true,
      creditCalcEnabled: true,
    },
  });
  if (!user || user.tenantId !== c.tenantId || !user.active) {
    throw httpError("Utente non trovato o non attivo", 403);
  }
  if (!user.consulenteEsterno || !user.creditCalcEnabled) {
    throw httpError(
      "Accesso CreditCalc non autorizzato. Contattare amministrazione.",
      403
    );
  }
  return user;
}

async function assertPraticaAffidata(
  c: CreditCalcConnection,
  praticaId: string
) {
  const ctx = dbCtx(c);
  const p = await praticaDb(ctx).findUnique({
    where: { id: praticaId },
    select: { id: true, assegnatarioId: true },
  });
  if (!p || p.assegnatarioId !== c.gestionaleUserId) {
    throw httpError("Pratica non in affido a questo consulente", 403);
  }
}

export async function creditCalcSessionProfile(c: CreditCalcConnection) {
  const user = await assertCreditCalcUser(c);
  return {
    profile: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      consulenteEsterno: true,
      creditCalcEnabled: true,
      capabilities: {
        openPratiche: true,
        addNote: true,
        setCodiceScarico: true,
      },
    },
  };
}

export async function creditCalcListPratiche(
  c: CreditCalcConnection,
  opts?: { take?: number; skip?: number }
) {
  await assertCreditCalcUser(c);
  const ctx = dbCtx(c);
  const take = Math.min(Math.max(opts?.take ?? 50, 1), 200);
  const skip = Math.max(opts?.skip ?? 0, 0);
  const where = {
    tenantId: c.tenantId,
    assegnatarioId: c.gestionaleUserId,
  };

  const [total, rows] = await Promise.all([
    praticaDb(ctx).count({ where }),
    praticaDb(ctx).findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take,
      skip,
      include: {
        debitore: { select: { cognome: true, nome: true } },
        mandante: { select: { codice: true, ragioneSociale: true } },
      },
    }),
  ]);

  type Row = (typeof rows)[number];
  return {
    total,
    items: rows.map((p: Row) => ({
      id: p.id,
      numero: p.numero,
      stato: p.stato,
      codiceScarico: p.codiceScarico,
      residuo: p.residuo != null ? Number(p.residuo) : null,
      numeroMandante: p.numeroMandante,
      updatedAt: toIso(p.updatedAt),
      debitore: `${p.debitore?.cognome || ""} ${p.debitore?.nome || ""}`.trim(),
      mandanteCodice: p.mandante?.codice ?? null,
      mandanteNome: p.mandante?.ragioneSociale ?? null,
    })),
  };
}

export async function creditCalcPraticaDetail(
  c: CreditCalcConnection,
  praticaId: string
) {
  await assertCreditCalcUser(c);
  await assertPraticaAffidata(c, praticaId);
  const ctx = dbCtx(c);

  const pratica = await praticaDb(ctx).findUnique({
    where: { id: praticaId },
    include: {
      debitore: { include: { recapiti: true } },
      mandante: true,
      garanti: { include: { recapiti: true } },
      rate: true,
      incassi: true,
      fatture: true,
      documenti: true,
    },
  });

  if (!pratica) throw httpError("Pratica non trovata", 404);

  const noteRows = await attivitaDb(ctx).findMany({
    where: {
      praticaId,
      tipo: "NOTA",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { name: true } } },
  });

  const debitore = pratica.debitore as
    | {
        cognome?: string | null;
        nome?: string | null;
        codiceFiscale?: string | null;
        telefono?: string | null;
        email?: string | null;
        indirizzo?: string | null;
        cap?: string | null;
        citta?: string | null;
        provincia?: string | null;
        recapiti?: unknown[];
      }
    | null
    | undefined;

  const garanti = (pratica.garanti as Array<Record<string, unknown>> | undefined) ?? [];
  const garanteRecapiti: Record<string, unknown>[] = [];
  for (const g of garanti) {
    const gid = String(g.id ?? "");
    const recs = (g.recapiti as unknown[] | undefined) ?? [];
    for (const r of recs) {
      const row = serializeValue(r) as Record<string, unknown>;
      garanteRecapiti.push({ ...row, garanteId: gid, GaranteId: gid });
    }
  }

  const praticaRaw = serializeValue(pratica) as Record<string, unknown>;
  if (debitore) {
    praticaRaw.DebitoreCognome = debitore.cognome ?? null;
    praticaRaw.DebitoreNome = debitore.nome ?? null;
    praticaRaw.DebitoreCodiceFiscale = debitore.codiceFiscale ?? null;
    praticaRaw.DebitoreTelefono = debitore.telefono ?? null;
    praticaRaw.DebitoreEmail = debitore.email ?? null;
    praticaRaw.DebitoreIndirizzo = debitore.indirizzo ?? null;
    praticaRaw.DebitoreCap = debitore.cap ?? null;
    praticaRaw.DebitoreCitta = debitore.citta ?? null;
    praticaRaw.DebitoreProvincia = debitore.provincia ?? null;
  }
  const mand = pratica.mandante as
    | { codice?: string | null; ragioneSociale?: string | null }
    | null
    | undefined;
  if (mand) {
    praticaRaw.MandanteCodice = mand.codice ?? null;
    praticaRaw.MandanteRagioneSociale = mand.ragioneSociale ?? null;
  }

  return {
    pratica: praticaRaw,
    note: noteRows.map((a) => {
      const withUser = a as typeof a & { user?: { name?: string | null } };
      return {
        id: a.id,
        nota: a.nota,
        createdAt: toIso(a.createdAt),
        userName: withUser.user?.name ?? null,
        fissata: Boolean(a.fissata),
        importante: Boolean(a.importante),
      };
    }),
    debitoreRecapiti: mapRows(debitore?.recapiti),
    garanti: mapRows(garanti),
    garanteRecapiti,
    rate: mapRows(pratica.rate),
    incassi: mapRows(pratica.incassi),
    fatture: mapRows(pratica.fatture),
    documenti: mapRows(pratica.documenti),
  };
}

export async function creditCalcLavorazione(
  c: CreditCalcConnection,
  praticaId: string,
  input: { nota?: string | null; codiceScarico?: string | null }
) {
  await assertCreditCalcUser(c);
  await assertPraticaAffidata(c, praticaId);
  const ctx = dbCtx(c);

  const nota = String(input.nota || "").trim();
  const codiceScarico =
    String(input.codiceScarico || "").trim().toUpperCase() || null;

  if (!nota && !codiceScarico) {
    throw httpError("Inserire una nota e/o un codice scarico", 400);
  }

  const now = new Date();

  if (nota) {
    await attivitaDb(ctx).create({
      data: {
        praticaId,
        userId: c.gestionaleUserId,
        tipo: "NOTA",
        nota,
      },
    });
  }

  const update: Record<string, unknown> = {
    updatedAt: now,
    ultimaLavorazioneAt: now,
  };
  if (codiceScarico) {
    update.codiceScarico = codiceScarico;
    update.codiceScaricoAt = now;
  }

  const pratica = await praticaDb(ctx).update({
    where: { id: praticaId },
    data: update,
  });

  await writeAudit({
    userId: c.gestionaleUserId,
    tenantId: c.tenantId,
    tenantSlug: c.tenantSlug,
    action: codiceScarico ? "scarico_update" : "nota",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: [codiceScarico, nota ? nota.slice(0, 200) : null]
      .filter(Boolean)
      .join(" · "),
  });

  return { ok: true, pratica: serializeValue(pratica) };
}
