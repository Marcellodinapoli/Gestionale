import "server-only";
import { neonQuery } from "@/lib/neon/pool";
import { mapSqlRow } from "@/lib/data/mapSqlRow";
import { isUuid } from "@/lib/tenant";
import type {
  AssignPraticaInput,
  PraticaCreateInput,
  PraticaInclude,
  PraticaListFilter,
  PraticaListRequest,
  PraticaListResult,
  PraticaScope,
  PraticaUpdateInput,
  PraticheRepository,
  PraticaDto,
} from "@/lib/data/contracts/pratiche";

function coerceMoney(mapped: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    if (mapped[k] == null || mapped[k] === "") continue;
    if (typeof mapped[k] !== "number") mapped[k] = Number(mapped[k]);
  }
}

function mapPratica(row: Record<string, unknown>): PraticaDto {
  const p = mapSqlRow(row);
  if (row.DebitoreNome != null || row.DebitoreCognome != null) {
    p.debitore = {
      id: row.DebitoreId ?? p.debitoreId,
      nome: row.DebitoreNome ?? null,
      cognome: row.DebitoreCognome ?? null,
      telefono: row.DebitoreTelefono ?? null,
      cap: row.DebitoreCap ?? null,
      citta: row.DebitoreCitta ?? null,
      provincia: row.DebitoreProvincia ?? null,
      codiceFiscale: row.DebitoreCodiceFiscale ?? null,
      email: row.DebitoreEmail ?? null,
      indirizzo: row.DebitoreIndirizzo ?? null,
    };
  }
  if (row.MandanteCodice != null || row.MandanteRagioneSociale != null) {
    p.mandante = {
      id: row.MandanteId ?? p.mandanteId,
      codice: row.MandanteCodice ?? null,
      ragioneSociale: row.MandanteRagioneSociale ?? null,
      perimetri: row.MandantePerimetri ?? null,
    };
  }
  if (row.AssegnatarioName != null) {
    p.assegnatario = {
      id: row.AssegnatarioId ?? p.assegnatarioId,
      name: row.AssegnatarioName,
    };
  }
  // Relazioni vuote di default — le page le assumono sempre presenti
  if (!Array.isArray(p.incassi)) p.incassi = [];
  if (!Array.isArray(p.garanti)) p.garanti = [];
  if (!Array.isArray(p.rate)) p.rate = [];
  if (!Array.isArray(p.attivita)) p.attivita = [];
  if (!Array.isArray(p.fatture)) p.fatture = [];
  if (!Array.isArray(p.documenti)) p.documenti = [];
  for (const k of [
    "createdAt",
    "updatedAt",
    "dataAffido",
    "scadenza",
    "memoAt",
    "promessaAt",
    "ultimaLavorazioneAt",
    "codiceScaricoAt",
    "codiceScaricoBkAt",
  ] as const) {
    if (typeof p[k] === "string") p[k] = new Date(String(p[k]));
  }
  coerceMoney(p, [
    "capitale",
    "interessi",
    "spese",
    "totIncassato",
    "residuo",
    "importoTotale",
    "nettoDaPagare",
    "promessaImporto",
    "speseRecupero",
    "speseGiudiziali",
    "rataImporto",
    "rateArretrate",
    "numeroRateScadute",
  ]);
  if (p.totIncassato == null || Number.isNaN(Number(p.totIncassato))) p.totIncassato = 0;
  return p;
}

function mapChild(row: Record<string, unknown>) {
  const mapped = mapSqlRow(row);
  for (const k of Object.keys(mapped)) {
    if (typeof mapped[k] === "string" && /(At|Data|Scadenza)$/.test(k)) {
      const d = new Date(String(mapped[k]));
      if (!Number.isNaN(d.getTime())) mapped[k] = d;
    }
  }
  coerceMoney(mapped, [
    "importo",
    "capitale",
    "interessi",
    "spese",
    "speseRec",
    "baseImporto",
    "percentuale",
  ]);
  return mapped;
}

async function resolveTenantUuid(tenantId: string, slug?: string): Promise<string | null> {
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

async function queryInclude<T>(label: string, run: () => Promise<T[]>, fallback: T[] = []): Promise<T[]> {
  try {
    return await run();
  } catch (e) {
    console.error(`Neon pratica include ${label} fallita`, e);
    return fallback;
  }
}

function needsRelations(include?: PraticaInclude[]) {
  if (!include?.length) return false;
  return include.some((k) =>
    [
      "rate",
      "incassi",
      "incassiUser",
      "garanti",
      "garantiRecapiti",
      "attivita",
      "attivitaUser",
      "fatture",
      "documenti",
      "debitoreRecapiti",
      "importBatch",
    ].includes(k)
  );
}

async function attachIncludes(items: PraticaDto[], include?: PraticaInclude[]) {
  if (!items.length || !needsRelations(include)) return items;
  const ids = items.map((p) => String(p.id));
  const want = new Set(include || []);

  const byPratica = <T extends Record<string, unknown>>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const pid = String(row.praticaId ?? "");
      if (!pid) continue;
      const list = map.get(pid) || [];
      list.push(row);
      map.set(pid, list);
    }
    return map;
  };

  let rateBy: Map<string, Record<string, unknown>[]> | undefined;
  let incBy: Map<string, Record<string, unknown>[]> | undefined;
  let garBy: Map<string, Record<string, unknown>[]> | undefined;
  let attBy: Map<string, Record<string, unknown>[]> | undefined;
  let fatBy: Map<string, Record<string, unknown>[]> | undefined;
  let docBy: Map<string, Record<string, unknown>[]> | undefined;

  if (want.has("rate")) {
    const rows = await queryInclude("PianoRate", () =>
      neonQuery(
        `SELECT * FROM "PianoRate" WHERE "PraticaId" = ANY($1::uuid[]) ORDER BY "NumeroRata"`,
        [ids]
      )
    );
    rateBy = byPratica(rows.map((r) => mapChild(r as Record<string, unknown>)));
  }
  if (want.has("incassi") || want.has("incassiUser")) {
    const rows = await queryInclude("Incassi", () =>
      neonQuery(
        `SELECT i.*, u."Name" AS "UserName"
       FROM "Incassi" i
       LEFT JOIN "Users" u ON u."Id" = i."UserId"
       WHERE i."PraticaId" = ANY($1::uuid[])
       ORDER BY i."Data" DESC`,
        [ids]
      )
    );
    incBy = byPratica(
      rows.map((r) => {
        const raw = r as Record<string, unknown>;
        const mapped = mapChild(raw);
        const name = raw.UserName ?? raw.userName;
        return {
          ...mapped,
          user: name ? { name: String(name) } : { name: "Operatore" },
        };
      })
    );
  }
  if (want.has("garanti") || want.has("garantiRecapiti")) {
    const rows = await queryInclude("Garanti", () =>
      neonQuery(
        `SELECT * FROM "Garanti" WHERE "PraticaId" = ANY($1::uuid[]) ORDER BY "Ordine"`,
        [ids]
      )
    );
    const mapped = rows.map((r) => mapChild(r as Record<string, unknown>));
    if (want.has("garantiRecapiti") && mapped.length) {
      const gIds = mapped.map((g) => String(g.id));
      const recs = await neonQuery(
        `SELECT * FROM "GaranteRecapiti" WHERE "GaranteId" = ANY($1::uuid[]) ORDER BY "Ordine"`,
        [gIds]
      );
      const recByG = new Map<string, Record<string, unknown>[]>();
      for (const rec of recs) {
        const m = mapChild(rec as Record<string, unknown>);
        const gid = String(m.garanteId ?? "");
        const list = recByG.get(gid) || [];
        list.push(m);
        recByG.set(gid, list);
      }
      for (const g of mapped) {
        g.recapiti = recByG.get(String(g.id)) || [];
      }
    }
    garBy = byPratica(mapped);
  }
  if (want.has("attivita") || want.has("attivitaUser")) {
    const rows = await queryInclude("Attivita", () =>
      neonQuery(
        `SELECT a.*, u."Name" AS "UserName"
       FROM "Attivita" a
       LEFT JOIN "Users" u ON u."Id" = a."UserId"
       WHERE a."PraticaId" = ANY($1::uuid[])
       ORDER BY a."CreatedAt" DESC`,
        [ids]
      )
    );
    attBy = byPratica(
      rows.map((r) => {
        const raw = r as Record<string, unknown>;
        const mapped = mapChild(raw);
        const name = raw.UserName ?? raw.userName;
        return {
          ...mapped,
          user: name ? { name: String(name) } : { name: "Operatore" },
        };
      })
    );
  }
  if (want.has("fatture")) {
    const rows = await queryInclude("Fatture", () =>
      neonQuery(
        `SELECT * FROM "Fatture" WHERE "PraticaId" = ANY($1::uuid[]) ORDER BY "DataFattura"`,
        [ids]
      )
    );
    fatBy = byPratica(rows.map((r) => mapChild(r as Record<string, unknown>)));
  }
  if (want.has("documenti")) {
    const rows = await neonQuery(
      `SELECT * FROM "Documenti" WHERE "PraticaId" = ANY($1::uuid[])
       ORDER BY "CreatedAt" DESC LIMIT 500`,
      [ids]
    );
    docBy = byPratica(rows.map((r) => mapChild(r as Record<string, unknown>)));
  }

  if (want.has("debitoreRecapiti")) {
    const debitoreIds = [
      ...new Set(items.map((p) => String(p.debitoreId || (p.debitore as { id?: string })?.id || "")).filter(Boolean)),
    ];
    if (debitoreIds.length) {
      const rows = await neonQuery(
        `SELECT * FROM "DebitoreRecapiti" WHERE "DebitoreId" = ANY($1::uuid[]) ORDER BY "Tipo", "Ordine"`,
        [debitoreIds]
      );
      const byDeb = new Map<string, Record<string, unknown>[]>();
      for (const r of rows) {
        const m = mapChild(r as Record<string, unknown>);
        const did = String(m.debitoreId ?? "");
        const list = byDeb.get(did) || [];
        list.push(m);
        byDeb.set(did, list);
      }
      for (const p of items) {
        const did = String(p.debitoreId || (p.debitore as { id?: string })?.id || "");
        if (!did) continue;
        p.debitore = {
          ...(p.debitore as object),
          id: did,
          recapiti: byDeb.get(did) || [],
        };
      }
    }
  }

  if (want.has("importBatch")) {
    const batchIds = [
      ...new Set(items.map((p) => (p.importBatchId ? String(p.importBatchId) : "")).filter(Boolean)),
    ];
    if (batchIds.length) {
      const rows = await neonQuery(
        `SELECT "Id", "Perimetro", "Lotto", "AffidoIl" FROM "ImportBatch" WHERE "Id" = ANY($1::uuid[])`,
        [batchIds]
      );
      const byId = new Map(
        rows.map((r) => {
          const m = mapChild(r as Record<string, unknown>);
          return [String(m.id), m];
        })
      );
      for (const p of items) {
        if (p.importBatchId) p.importBatch = byId.get(String(p.importBatchId)) ?? null;
      }
    }
  }

  for (const p of items) {
    const id = String(p.id);
    if (rateBy) p.rate = rateBy.get(id) || [];
    if (incBy) p.incassi = incBy.get(id) || [];
    if (garBy) p.garanti = garBy.get(id) || [];
    if (attBy) p.attivita = attBy.get(id) || [];
    if (fatBy) p.fatture = fatBy.get(id) || [];
    if (docBy) p.documenti = docBy.get(id) || [];
  }
  return items;
}

function scopeSql(scope: PraticaScope, startIdx: number): { sql: string; params: unknown[]; next: number } {
  const params: unknown[] = [];
  let i = startIdx;
  let sql = "";
  if (scope.role === "OPERATOR") {
    sql = ` AND (p."AssegnatarioId" = $${i}::uuid OR p."OperatoreTitolareId" = $${i}::uuid)`;
    params.push(scope.userId);
    i += 1;
  } else if (scope.role === "SUPERVISOR" && scope.memberIds?.length) {
    sql = ` AND (p."AssegnatarioId" = ANY($${i}::uuid[]) OR p."OperatoreTitolareId" = ANY($${i}::uuid[]))`;
    params.push(scope.memberIds);
    i += 1;
  }
  return { sql, params, next: i };
}

function filterSql(
  filter: PraticaListFilter | undefined,
  startIdx: number
): { sql: string; params: unknown[]; next: number } {
  if (!filter) return { sql: "", params: [], next: startIdx };
  const parts: string[] = [];
  const params: unknown[] = [];
  let i = startIdx;
  if (filter.ids?.length || filter.idsIn?.length) {
    const ids = filter.ids ?? filter.idsIn ?? [];
    parts.push(`p."Id" = ANY($${i++}::uuid[])`);
    params.push(ids);
  }
  if (filter.stato) {
    parts.push(`p."Stato" = $${i++}`);
    params.push(filter.stato);
  }
  if (filter.stati?.length) {
    parts.push(`p."Stato" = ANY($${i++}::text[])`);
    params.push(filter.stati);
  }
  if (filter.notStati?.length) {
    parts.push(`p."Stato" <> ALL($${i++}::text[])`);
    params.push(filter.notStati);
  }
  if (filter.mandanteId) {
    parts.push(`p."MandanteId" = $${i++}::uuid`);
    params.push(filter.mandanteId);
  }
  if (filter.mandanteIds?.length) {
    parts.push(`p."MandanteId" = ANY($${i++}::uuid[])`);
    params.push(filter.mandanteIds);
  }
  if (filter.assegnatarioId) {
    parts.push(`p."AssegnatarioId" = $${i++}::uuid`);
    params.push(filter.assegnatarioId);
  }
  if (filter.hasAssegnatario === false) {
    parts.push(`p."AssegnatarioId" IS NULL`);
  }
  if (filter.hasAssegnatario === true) {
    parts.push(`p."AssegnatarioId" IS NOT NULL`);
  }
  if (filter.q?.trim()) {
    parts.push(
      `(p."Numero" ILIKE $${i} OR d."Cognome" ILIKE $${i} OR d."Nome" ILIKE $${i} OR d."CodiceFiscale" ILIKE $${i} OR p."NumeroMandante" ILIKE $${i})`
    );
    params.push(`%${filter.q.trim()}%`);
    i += 1;
  }
  if (filter.codScarico) {
    parts.push(`p."CodiceScarico" = $${i++}`);
    params.push(filter.codScarico);
  }
  if (filter.codiciFiscaliIn?.length) {
    parts.push(`(
      EXISTS (
        SELECT 1 FROM "Debitori" dx
        WHERE dx."Id" = p."DebitoreId"
          AND dx."CodiceFiscale" = ANY($${i}::text[])
      )
      OR EXISTS (
        SELECT 1 FROM "Garanti" gx
        WHERE gx."PraticaId" = p."Id"
          AND gx."CodiceFiscale" = ANY($${i}::text[])
      )
    )`);
    params.push(filter.codiciFiscaliIn);
    i += 1;
  }
  if (filter.cfPivaContains?.trim()) {
    const t = `%${filter.cfPivaContains.trim()}%`;
    parts.push(`(
      d."CodiceFiscale" ILIKE $${i}
      OR EXISTS (
        SELECT 1 FROM "Garanti" gx
        WHERE gx."PraticaId" = p."Id" AND gx."CodiceFiscale" ILIKE $${i}
      )
    )`);
    params.push(t);
    i += 1;
  }
  if (filter.excludeIds?.length) {
    parts.push(`p."Id" <> ALL($${i++}::uuid[])`);
    params.push(filter.excludeIds);
  }
  if (filter.assegnatarioIdsIn?.length) {
    parts.push(`p."AssegnatarioId" = ANY($${i++}::uuid[])`);
    params.push(filter.assegnatarioIdsIn);
  }
  if (filter.numeroMandante) {
    parts.push(`p."NumeroMandante" = $${i++}`);
    params.push(filter.numeroMandante);
  }
  if (filter.numeroMandantiIn?.length) {
    parts.push(`p."NumeroMandante" = ANY($${i++}::text[])`);
    params.push(filter.numeroMandantiIn);
  }
  return {
    sql: parts.length ? ` AND ${parts.join(" AND ")}` : "",
    params,
    next: i,
  };
}

const LIST_SELECT = `
  p.*,
  d."Nome" AS "DebitoreNome", d."Cognome" AS "DebitoreCognome",
  d."Telefono" AS "DebitoreTelefono", d."Cap" AS "DebitoreCap",
  d."Citta" AS "DebitoreCitta", d."Provincia" AS "DebitoreProvincia",
  d."CodiceFiscale" AS "DebitoreCodiceFiscale", d."Email" AS "DebitoreEmail",
  d."Indirizzo" AS "DebitoreIndirizzo",
  m."Codice" AS "MandanteCodice", m."RagioneSociale" AS "MandanteRagioneSociale",
  m."PerimetriJson" AS "MandantePerimetri",
  a."Name" AS "AssegnatarioName"
`;

export class NeonPraticheRepository implements PraticheRepository {
  constructor(private _tenantSlug: string) {}

  async getById(
    _tenantSlug: string,
    tenantId: string,
    id: string,
    include?: PraticaInclude[]
  ): Promise<PraticaDto | null> {
    if (!isUuid(id)) return null;
    const tid = await resolveTenantUuid(tenantId, _tenantSlug || this._tenantSlug);
    if (!tid) return null;
    const rows = await neonQuery(
      `SELECT ${LIST_SELECT}
       FROM "Pratiche" p
       LEFT JOIN "Debitori" d ON d."Id" = p."DebitoreId"
       LEFT JOIN "Mandanti" m ON m."Id" = p."MandanteId"
       LEFT JOIN "Users" a ON a."Id" = p."AssegnatarioId"
       WHERE p."Id" = $1::uuid AND p."TenantId" = $2::uuid
       LIMIT 1`,
      [id, tid]
    );
    if (!rows[0]) return null;
    const [item] = await attachIncludes(
      [mapPratica(rows[0] as Record<string, unknown>)],
      include
    );
    return item ?? null;
  }

  async list(req: PraticaListRequest): Promise<PraticaListResult> {
    const tid = await resolveTenantUuid(req.scope.tenantId, req.tenantSlug || this._tenantSlug);
    if (!tid) {
      return { items: [], total: 0, page: 1, pageSize: req.pageSize ?? req.take ?? 50 };
    }
    const page = Math.max(1, req.page ?? 1);
    const pageSize = Math.min(10_000, Math.max(1, req.pageSize ?? req.take ?? 50));
    const skip = req.skip ?? (page - 1) * pageSize;
    const scope = scopeSql({ ...req.scope, tenantId: tid }, 2);
    const filt = filterSql(req.filter, scope.next);
    const where = `p."TenantId" = $1::uuid${scope.sql}${filt.sql}`;
    const params = [tid, ...scope.params, ...filt.params];
    const countRows = await neonQuery(
      `SELECT COUNT(*)::int AS c
       FROM "Pratiche" p
       LEFT JOIN "Debitori" d ON d."Id" = p."DebitoreId"
       WHERE ${where}`,
      params
    );
    const total = Number((countRows[0] as { c: number })?.c ?? 0);
    const sortField = req.sort?.field === "numero" ? `"Numero"` : `"UpdatedAt"`;
    const sortDir = req.sort?.dir === "asc" ? "ASC" : "DESC";
    const items = await neonQuery(
      `SELECT ${LIST_SELECT}
       FROM "Pratiche" p
       LEFT JOIN "Debitori" d ON d."Id" = p."DebitoreId"
       LEFT JOIN "Mandanti" m ON m."Id" = p."MandanteId"
       LEFT JOIN "Users" a ON a."Id" = p."AssegnatarioId"
       WHERE ${where}
       ORDER BY p.${sortField} ${sortDir} NULLS LAST
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, skip]
    );
    const mapped = items.map((r) => mapPratica(r as Record<string, unknown>));
    await attachIncludes(mapped, req.include);
    return {
      items: mapped,
      total,
      page,
      pageSize,
    };
  }

  async count(
    req: Omit<PraticaListRequest, "page" | "pageSize" | "skip" | "take" | "sort" | "include">
  ) {
    const scope = scopeSql(req.scope, 2);
    const filt = filterSql(req.filter, scope.next);
    const where = `p."TenantId" = $1::uuid${scope.sql}${filt.sql}`;
    const params = [req.scope.tenantId, ...scope.params, ...filt.params];
    const rows = await neonQuery(
      `SELECT COUNT(*)::int AS c
       FROM "Pratiche" p
       LEFT JOIN "Debitori" d ON d."Id" = p."DebitoreId"
       WHERE ${where}`,
      params
    );
    return Number((rows[0] as { c: number })?.c ?? 0);
  }

  async groupByNumeroMandante(tenantSlug: string, scope: PraticaScope, filter?: PraticaListFilter) {
    const list = await this.list({
      tenantSlug,
      scope,
      filter,
      take: 10_000,
      pageSize: 10_000,
    });
    const set = new Set<string | null>();
    for (const item of list.items) {
      set.add(item.numeroMandante != null ? String(item.numeroMandante) : null);
    }
    return [...set].map((numeroMandante) => ({ numeroMandante }));
  }

  async idsAffidoTemporaneo(_tenantSlug: string, tenantId: string) {
    const rows = await neonQuery(
      `SELECT "Id" FROM "Pratiche"
       WHERE "TenantId" = $1::uuid
         AND "AssegnatarioId" IS NOT NULL
         AND "OperatoreTitolareId" IS NOT NULL
         AND "AssegnatarioId" <> "OperatoreTitolareId"`,
      [tenantId]
    );
    return rows.map((r) => String((r as { Id: string }).Id));
  }

  async idsImportoTotale(
    _tenantSlug: string,
    tenantId: string,
    da?: number,
    a?: number
  ) {
    const parts = [`"TenantId" = $1::uuid`];
    const params: unknown[] = [tenantId];
    let i = 2;
    if (da != null) {
      parts.push(`"ImportoTotale" >= $${i++}`);
      params.push(da);
    }
    if (a != null) {
      parts.push(`"ImportoTotale" <= $${i++}`);
      params.push(a);
    }
    const rows = await neonQuery(
      `SELECT "Id" FROM "Pratiche" WHERE ${parts.join(" AND ")}`,
      params
    );
    return rows.map((r) => String((r as { Id: string }).Id));
  }

  async idsTotIncassato(
    _tenantSlug: string,
    tenantId: string,
    da?: number,
    a?: number
  ) {
    const parts = [`"TenantId" = $1::uuid`];
    const params: unknown[] = [tenantId];
    let i = 2;
    if (da != null) {
      parts.push(`"TotIncassato" >= $${i++}`);
      params.push(da);
    }
    if (a != null) {
      parts.push(`"TotIncassato" <= $${i++}`);
      params.push(a);
    }
    const rows = await neonQuery(
      `SELECT "Id" FROM "Pratiche" WHERE ${parts.join(" AND ")}`,
      params
    );
    return rows.map((r) => String((r as { Id: string }).Id));
  }

  async nextNumero(_tenantSlug: string, tenantId: string) {
    const rows = await neonQuery(
      `SELECT "Numero" FROM "Pratiche" WHERE "TenantId" = $1::uuid ORDER BY "CreatedAt" DESC LIMIT 1`,
      [tenantId]
    );
    const last = String((rows[0] as { Numero?: string })?.Numero || "0");
    const n = Number.parseInt(last.replace(/\D/g, ""), 10);
    return String(Number.isFinite(n) ? n + 1 : 1).padStart(6, "0");
  }

  async create(_tenantSlug: string, data: PraticaCreateInput): Promise<PraticaDto> {
    const id = crypto.randomUUID();
    await neonQuery(
      `INSERT INTO "Pratiche" (
         "Id","TenantId","Numero","MandanteId","DebitoreId","Stato",
         "Capitale","Interessi","Spese","TotIncassato","Residuo","NumeroRateScadute",
         "SpeseRecupero","SpeseGiudiziali","CreatedAt","UpdatedAt"
       ) VALUES (
         $1::uuid,$2::uuid,$3,$4::uuid,$5::uuid,$6,
         $7,$8,$9,0,$7+$8+$9,0,
         0,0,NOW(),NOW()
       )`,
      [
        id,
        data.tenantId,
        data.numero,
        data.mandanteId,
        data.debitoreId,
        data.stato || "NUOVA",
        data.capitale ?? 0,
        data.interessi ?? 0,
        data.spese ?? 0,
      ]
    );
    const row = await this.getById(_tenantSlug, data.tenantId, id);
    if (!row) throw new Error("Creazione pratica Neon fallita");
    return row;
  }

  async update(
    tenantSlug: string,
    tenantId: string,
    id: string,
    data: PraticaUpdateInput
  ): Promise<PraticaDto> {
    const map: Record<string, string> = {
      stato: "Stato",
      esitoContatto: "EsitoContatto",
      assegnatarioId: "AssegnatarioId",
      operatoreTitolareId: "OperatoreTitolareId",
      codiceScarico: "CodiceScarico",
      note: "Note",
      residuo: "Residuo",
      memoAt: "MemoAt",
      promessaAt: "PromessaAt",
      promessaImporto: "PromessaImporto",
      ultimaLavorazioneAt: "UltimaLavorazioneAt",
    };
    const sets: string[] = [`"UpdatedAt" = NOW()`];
    const params: unknown[] = [];
    let i = 1;
    for (const [k, col] of Object.entries(map)) {
      if ((data as Record<string, unknown>)[k] === undefined) continue;
      const val = (data as Record<string, unknown>)[k];
      if (val == null) sets.push(`"${col}" = NULL`);
      else if (col.endsWith("Id") || col === "AssegnatarioId" || col === "OperatoreTitolareId") {
        sets.push(`"${col}" = $${i++}::uuid`);
        params.push(val);
      } else if (col.endsWith("At")) {
        sets.push(`"${col}" = $${i++}::timestamptz`);
        params.push(val instanceof Date ? val.toISOString() : val);
      } else {
        sets.push(`"${col}" = $${i++}`);
        params.push(val);
      }
    }
    params.push(id, tenantId);
    await neonQuery(
      `UPDATE "Pratiche" SET ${sets.join(", ")}
       WHERE "Id" = $${i++}::uuid AND "TenantId" = $${i}::uuid`,
      params
    );
    const row = await this.getById(tenantSlug, tenantId, id);
    if (!row) throw new Error("Pratica non trovata");
    return row;
  }

  async delete(_tenantSlug: string, tenantId: string, id: string) {
    await neonQuery(
      `DELETE FROM "Pratiche" WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid`,
      [id, tenantId]
    );
  }

  async assign(
    tenantSlug: string,
    tenantId: string,
    id: string,
    input: AssignPraticaInput
  ) {
    if (input.tipo === "unassign") {
      await this.update(tenantSlug, tenantId, id, { assegnatarioId: null });
      return;
    }
    await this.update(tenantSlug, tenantId, id, {
      assegnatarioId: input.assegnatarioId ?? null,
      operatoreTitolareId: input.titolareId ?? input.assegnatarioId ?? null,
    });
  }

  async updateStato(
    tenantSlug: string,
    tenantId: string,
    id: string,
    stato: string,
    promessaAt?: Date | null
  ) {
    await this.update(tenantSlug, tenantId, id, {
      stato,
      ...(promessaAt !== undefined ? { promessaAt } : {}),
    });
  }

  async canAccess(
    _tenantSlug: string,
    scope: PraticaScope,
    praticaId: string,
    _linkedIds?: string[]
  ) {
    const scopePart = scopeSql(scope, 3);
    const rows = await neonQuery(
      `SELECT 1 AS ok FROM "Pratiche" p
       WHERE p."Id" = $1::uuid AND p."TenantId" = $2::uuid${scopePart.sql}
       LIMIT 1`,
      [praticaId, scope.tenantId, ...scopePart.params]
    );
    return rows.length > 0;
  }
}

export function createNeonPraticheRepository(tenantSlug: string) {
  return new NeonPraticheRepository(tenantSlug);
}
