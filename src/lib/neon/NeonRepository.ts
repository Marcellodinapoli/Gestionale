import "server-only";
import { neonQuery } from "@/lib/neon/pool";
import type {
  PostazioneRecord,
  PostazioniRepository,
  TenantRecord,
  TenantsRepository,
  UserRecord,
  UserSessionRecord,
  UsersRepository,
  DataRepositories,
  PraticheRepository,
  PraticaSearchParams,
  PraticaSearchResult,
  PraticaRecord,
} from "@/lib/data/contracts/repositories";
import type {
  DashboardRepository,
  HomeKpiBundle,
  HomeKpiContext,
} from "@/lib/data/contracts/dashboard";

function mapTenant(row: Record<string, unknown>): TenantRecord {
  return {
    id: String(row.Id ?? row.id),
    slug: String(row.Slug ?? row.slug),
    nome: String(row.Nome ?? row.nome),
    active: Boolean(row.Active ?? row.active ?? true),
  };
}

function mapUser(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.Id ?? row.id),
    tenantId: String(row.TenantId ?? row.tenantId),
    email: String(row.Email ?? row.email),
    name: String(row.Name ?? row.name),
    passwordHash: row.PasswordHash != null ? String(row.PasswordHash) : undefined,
    role: String(row.Role ?? row.role),
    active: Boolean(row.Active ?? row.active ?? true),
    acronimo: row.Acronimo != null ? String(row.Acronimo) : null,
    formazioneOnly: Boolean(row.FormazioneOnly ?? row.formazioneOnly ?? false),
    interno: row.Interno != null ? String(row.Interno) : null,
    prefissoChiamata: row.PrefissoChiamata != null ? String(row.PrefissoChiamata) : null,
    supervisorId: row.SupervisorId != null ? String(row.SupervisorId) : null,
    gruppoNome: row.GruppoNome != null ? String(row.GruppoNome) : null,
    gruppoMandantiJson:
      row.GruppoMandantiJson != null ? String(row.GruppoMandantiJson) : null,
    postazioneId: row.PostazioneId != null ? String(row.PostazioneId) : null,
    postazioneFissa: Boolean(row.PostazioneFissa ?? row.postazioneFissa ?? false),
    sedeId: row.SedeId != null ? String(row.SedeId) : null,
    passwordChangedAt: row.PasswordChangedAt
      ? new Date(String(row.PasswordChangedAt))
      : null,
    lastLoginAt: row.LastLoginAt ? new Date(String(row.LastLoginAt)) : null,
  };
}

function mapSession(row: Record<string, unknown>): UserSessionRecord {
  return {
    ...mapUser(row),
    tenantSlug: String(row.TenantSlug ?? row.tenantSlug),
    tenantNome: String(row.TenantNome ?? row.tenantNome),
    tenantActive: Boolean(row.TenantActive ?? row.tenantActive ?? true),
    postazioneInterno:
      row.PostazioneInterno != null ? String(row.PostazioneInterno) : null,
    postazioneEmail:
      row.PostazioneEmail != null ? String(row.PostazioneEmail) : null,
    postazioneNome: row.PostazioneNome != null ? String(row.PostazioneNome) : null,
    sedeNome: row.SedeNome != null ? String(row.SedeNome) : null,
  };
}

function mapPratica(row: Record<string, unknown>): PraticaRecord {
  return {
    id: String(row.Id ?? row.id),
    tenantId: String(row.TenantId ?? row.tenantId),
    numero: String(row.Numero ?? row.numero),
    stato: String(row.Stato ?? row.stato),
    capitale: Number(row.Capitale ?? row.capitale),
    interessi: Number(row.Interessi ?? row.interessi),
    spese: Number(row.Spese ?? row.spese),
    importoTotale: Number(row.ImportoTotale ?? row.importoTotale),
    totIncassato: Number(row.TotIncassato ?? row.totIncassato ?? 0),
    residuo: Number(row.Residuo ?? row.residuo),
    mandanteId: String(row.MandanteId ?? row.mandanteId),
    debitoreId: String(row.DebitoreId ?? row.debitoreId),
    assegnatarioId:
      row.AssegnatarioId != null ? String(row.AssegnatarioId) : null,
    memoAt: row.MemoAt ? String(row.MemoAt) : null,
    updatedAt: String(row.UpdatedAt ?? row.updatedAt),
    debitoreNome: row.DebitoreNome ? String(row.DebitoreNome) : undefined,
    debitoreCognome: row.DebitoreCognome
      ? String(row.DebitoreCognome)
      : undefined,
    mandanteCodice: row.MandanteCodice
      ? String(row.MandanteCodice)
      : undefined,
  };
}

class NeonTenantsRepository implements TenantsRepository {
  async getBySlug(slug: string): Promise<TenantRecord | null> {
    const rows = await neonQuery(
      `SELECT "Id", "Slug", "Nome", "Active" FROM "Tenants" WHERE lower("Slug") = lower($1) LIMIT 1`,
      [slug]
    );
    return rows[0] ? mapTenant(rows[0] as Record<string, unknown>) : null;
  }

  async getById(id: string): Promise<TenantRecord | null> {
    const rows = await neonQuery(
      `SELECT "Id", "Slug", "Nome", "Active" FROM "Tenants" WHERE "Id" = $1::uuid LIMIT 1`,
      [id]
    );
    return rows[0] ? mapTenant(rows[0] as Record<string, unknown>) : null;
  }
}

class NeonUsersRepository implements UsersRepository {
  async findByEmail(tenantId: string, email: string): Promise<UserRecord | null> {
    const rows = await neonQuery(
      `SELECT "Id", "TenantId", "Email", "Name", "PasswordHash", "PasswordChangedAt",
              "Role", "Acronimo", "FormazioneOnly", "Interno", "PrefissoChiamata",
              "Active", "SupervisorId", "GruppoNome", "GruppoMandantiJson",
              "PostazioneId", "PostazioneFissa", "SedeId", "LastLoginAt"
       FROM "Users"
       WHERE "TenantId" = $1::uuid AND lower("Email") = lower($2)
       LIMIT 1`,
      [tenantId, email]
    );
    return rows[0] ? mapUser(rows[0] as Record<string, unknown>) : null;
  }

  async findById(tenantId: string, userId: string): Promise<UserRecord | null> {
    const rows = await neonQuery(
      `SELECT "Id", "TenantId", "Email", "Name", "PasswordHash", "PasswordChangedAt",
              "Role", "Acronimo", "FormazioneOnly", "Interno", "PrefissoChiamata",
              "Active", "SupervisorId", "GruppoNome", "GruppoMandantiJson",
              "PostazioneId", "PostazioneFissa", "SedeId", "LastLoginAt"
       FROM "Users"
       WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid
       LIMIT 1`,
      [userId, tenantId]
    );
    return rows[0] ? mapUser(rows[0] as Record<string, unknown>) : null;
  }

  async getSession(tenantId: string, userId: string): Promise<UserSessionRecord | null> {
    const rows = await neonQuery(
      `SELECT u."Id", u."TenantId", u."Email", u."Name", u."PasswordHash", u."PasswordChangedAt",
              u."Role", u."Acronimo", u."FormazioneOnly", u."Interno", u."PrefissoChiamata",
              u."Active", u."SupervisorId", u."GruppoNome", u."GruppoMandantiJson",
              u."PostazioneId", u."PostazioneFissa", u."SedeId", u."LastLoginAt",
              t."Slug" AS "TenantSlug", t."Nome" AS "TenantNome", t."Active" AS "TenantActive",
              p."Interno" AS "PostazioneInterno", p."Email" AS "PostazioneEmail",
              p."Nome" AS "PostazioneNome", s."Nome" AS "SedeNome"
       FROM "Users" u
       INNER JOIN "Tenants" t ON t."Id" = u."TenantId"
       LEFT JOIN "Postazioni" p ON p."Id" = u."PostazioneId" AND p."TenantId" = u."TenantId"
       LEFT JOIN "Sedi" s ON s."Id" = u."SedeId" AND s."TenantId" = u."TenantId"
       WHERE u."Id" = $1::uuid AND u."TenantId" = $2::uuid
       LIMIT 1`,
      [userId, tenantId]
    );
    return rows[0] ? mapSession(rows[0] as Record<string, unknown>) : null;
  }

  async updateLogin(
    userId: string,
    data: {
      lastLoginAt: Date | string;
      postazioneId?: string | null;
      postazioneFissa?: boolean;
    }
  ): Promise<void> {
    const sets = [`"LastLoginAt" = $2::timestamptz`];
    const params: unknown[] = [userId, new Date(data.lastLoginAt).toISOString()];
    let i = 3;
    if (data.postazioneId !== undefined) {
      sets.push(
        data.postazioneId == null
          ? `"PostazioneId" = NULL`
          : `"PostazioneId" = $${i++}::uuid`
      );
      if (data.postazioneId != null) params.push(data.postazioneId);
    }
    if (data.postazioneFissa !== undefined) {
      sets.push(`"PostazioneFissa" = $${i++}`);
      params.push(data.postazioneFissa);
    }
    await neonQuery(
      `UPDATE "Users" SET ${sets.join(", ")} WHERE "Id" = $1::uuid`,
      params
    );
  }

  async getAuditContext(
    userId: string
  ): Promise<{ tenantId: string; tenantSlug: string } | null> {
    const rows = await neonQuery(
      `SELECT u."TenantId", t."Slug" AS "TenantSlug"
       FROM "Users" u
       INNER JOIN "Tenants" t ON t."Id" = u."TenantId"
       WHERE u."Id" = $1::uuid
       LIMIT 1`,
      [userId]
    );
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      tenantId: String(row.TenantId),
      tenantSlug: String(row.TenantSlug),
    };
  }

  async listByTenant(tenantId: string): Promise<UserRecord[]> {
    const rows = await neonQuery(
      `SELECT "Id", "TenantId", "Email", "Name", "PasswordHash", "PasswordChangedAt",
              "Role", "Acronimo", "FormazioneOnly", "Interno", "PrefissoChiamata",
              "Active", "SupervisorId", "GruppoNome", "GruppoMandantiJson",
              "PostazioneId", "PostazioneFissa", "SedeId", "LastLoginAt"
       FROM "Users"
       WHERE "TenantId" = $1::uuid
       ORDER BY "Name"`,
      [tenantId]
    );
    return rows.map((r) => mapUser(r as Record<string, unknown>));
  }
}

class NeonPostazioniRepository implements PostazioniRepository {
  async findActive(
    tenantId: string,
    postazioneId: string
  ): Promise<PostazioneRecord | null> {
    const rows = await neonQuery(
      `SELECT "Id", "TenantId", "SedeId", "Nome", "Active"
       FROM "Postazioni"
       WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid AND "Active" = true
       LIMIT 1`,
      [postazioneId, tenantId]
    );
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: String(row.Id),
      tenantId: String(row.TenantId),
      nome: String(row.Nome),
      sedeId: row.SedeId != null ? String(row.SedeId) : null,
      active: Boolean(row.Active),
    };
  }
}

class NeonPraticheRepository implements PraticheRepository {
  async search(
    tenantId: string,
    params: PraticaSearchParams
  ): Promise<PraticaSearchResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
    const offset = (page - 1) * pageSize;
    const where: string[] = [`p."TenantId" = $1::uuid`];
    const args: unknown[] = [tenantId];
    let i = 2;
    if (params.stato) {
      where.push(`p."Stato" = $${i++}`);
      args.push(params.stato);
    }
    if (params.mandanteId) {
      where.push(`p."MandanteId" = $${i++}::uuid`);
      args.push(params.mandanteId);
    }
    if (params.assegnatarioId) {
      where.push(`p."AssegnatarioId" = $${i++}::uuid`);
      args.push(params.assegnatarioId);
    }
    if (params.q?.trim()) {
      where.push(
        `(p."Numero" ILIKE $${i} OR d."Cognome" ILIKE $${i} OR d."Nome" ILIKE $${i} OR d."CodiceFiscale" ILIKE $${i})`
      );
      args.push(`%${params.q.trim()}%`);
      i += 1;
    }
    const whereSql = where.join(" AND ");
    const countRows = await neonQuery(
      `SELECT COUNT(*)::int AS c
       FROM "Pratiche" p
       LEFT JOIN "Debitori" d ON d."Id" = p."DebitoreId"
       WHERE ${whereSql}`,
      args
    );
    const total = Number((countRows[0] as { c: number })?.c ?? 0);
    const limitIdx = i;
    const offsetIdx = i + 1;
    const items = await neonQuery(
      `SELECT p.*, d."Nome" AS "DebitoreNome", d."Cognome" AS "DebitoreCognome",
              m."Codice" AS "MandanteCodice"
       FROM "Pratiche" p
       LEFT JOIN "Debitori" d ON d."Id" = p."DebitoreId"
       LEFT JOIN "Mandanti" m ON m."Id" = p."MandanteId"
       WHERE ${whereSql}
       ORDER BY p."UpdatedAt" DESC NULLS LAST
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...args, pageSize, offset]
    );
    return {
      items: items.map((r) => mapPratica(r as Record<string, unknown>)),
      total,
      page,
      pageSize,
    };
  }

  async getById(tenantId: string, id: string): Promise<PraticaRecord | null> {
    const rows = await neonQuery(
      `SELECT p.*, d."Nome" AS "DebitoreNome", d."Cognome" AS "DebitoreCognome",
              m."Codice" AS "MandanteCodice"
       FROM "Pratiche" p
       LEFT JOIN "Debitori" d ON d."Id" = p."DebitoreId"
       LEFT JOIN "Mandanti" m ON m."Id" = p."MandanteId"
       WHERE p."Id" = $1::uuid AND p."TenantId" = $2::uuid
       LIMIT 1`,
      [id, tenantId]
    );
    return rows[0] ? mapPratica(rows[0] as Record<string, unknown>) : null;
  }
}

class NeonDashboardRepository implements DashboardRepository {
  async getHomeKpi(ctx: HomeKpiContext): Promise<HomeKpiBundle> {
    const t0 = Date.now();
    const tenantId = ctx.tenantId;
    let sqlQueries = 0;

    const praticheAgg = await neonQuery(
      `SELECT
         COUNT(*)::int AS totali,
         COUNT(*) FILTER (WHERE "Stato" = 'NUOVA')::int AS nuove,
         COUNT(*) FILTER (WHERE "Stato" = 'IN_LAVORAZIONE')::int AS in_lavorazione,
         COUNT(*) FILTER (
           WHERE "Scadenza" IS NOT NULL AND "Scadenza" < NOW()
             AND "Stato" NOT IN ('INCASSO','INESIGIBILE','RESA','CHIUSA')
         )::int AS scadute,
         COUNT(*) FILTER (
           WHERE "Scadenza" IS NOT NULL
             AND "Scadenza" >= CURRENT_DATE
             AND "Scadenza" < CURRENT_DATE + INTERVAL '7 days'
             AND "Stato" NOT IN ('INCASSO','INESIGIBILE','RESA','CHIUSA')
         )::int AS in_scadenza_7,
         COUNT(*) FILTER (
           WHERE "AssegnatarioId" IS NULL
             AND "Stato" NOT IN ('INCASSO','INESIGIBILE','RESA','CHIUSA')
         )::int AS non_assegnate
       FROM "Pratiche" WHERE "TenantId" = $1::uuid`,
      [tenantId]
    );
    sqlQueries += 1;

    const incassiOggiRows = await neonQuery(
      `SELECT COALESCE(SUM("Importo"),0)::float AS oggi
       FROM "Incassi"
       WHERE "TenantId" = $1::uuid
         AND ("Data" AT TIME ZONE 'Europe/Rome')::date = (NOW() AT TIME ZONE 'Europe/Rome')::date`,
      [tenantId]
    );
    sqlQueries += 1;

    const p = (praticheAgg[0] || {}) as Record<string, number>;
    const incassiOggi = Number((incassiOggiRows[0] as { oggi?: number })?.oggi ?? 0);

    let admin: HomeKpiBundle["admin"];
    let amministrazione: HomeKpiBundle["amministrazione"];

    if (ctx.includeAdmin || ctx.includeAmministrazione) {
      const sediRows = await neonQuery(
        `SELECT "Id", "Nome" FROM "Sedi" WHERE "TenantId" = $1::uuid ORDER BY "Nome"`,
        [tenantId]
      );
      sqlQueries += 1;
      const sediOpts = sediRows.map((r) => {
        const row = r as { Id: string; Nome: string };
        return { id: String(row.Id), nome: String(row.Nome) };
      });

      const opRows = await neonQuery(
        `SELECT COUNT(*)::int AS c FROM "Users"
         WHERE "TenantId" = $1::uuid AND "Active" = true
           AND "Role" IN ('OPERATOR','OPERATORE','SUPERVISOR')`,
        [tenantId]
      );
      sqlQueries += 1;
      const operatoriCount = Number((opRows[0] as { c: number })?.c ?? 0);

      const mandantiRows = await neonQuery(
        `SELECT "Id", "Codice", "RagioneSociale", "PerimetriJson"
         FROM "Mandanti" WHERE "TenantId" = $1::uuid ORDER BY "Codice"`,
        [tenantId]
      );
      sqlQueries += 1;

      const riepRows = await neonQuery(
        `SELECT m."Id", m."Codice", m."RagioneSociale",
           COUNT(p."Id")::int AS pratiche,
           COALESCE(SUM(p."ImportoTotale"), 0)::float AS affidato,
           COALESCE(SUM(p."Residuo"), 0)::float AS residuo,
           COALESCE(SUM(COALESCE(p."NettoDaPagare", p."Residuo")), 0)::float AS insoluto,
           COALESCE((
             SELECT SUM(i."Importo") FROM "Incassi" i
             INNER JOIN "Pratiche" px ON px."Id" = i."PraticaId"
             WHERE px."MandanteId" = m."Id" AND px."TenantId" = $1::uuid
           ), 0)::float AS incassato
         FROM "Mandanti" m
         LEFT JOIN "Pratiche" p ON p."MandanteId" = m."Id" AND p."TenantId" = $1::uuid
         WHERE m."TenantId" = $1::uuid
         GROUP BY m."Id", m."Codice", m."RagioneSociale"
         ORDER BY m."Codice"`,
        [tenantId]
      );
      sqlQueries += 1;

      const { parsePerimetriList, resolvePerimetroPratica } = await import(
        "@/lib/mandantePerimetri"
      );
      const { resolveProvvigionePercentualeLato, calcolaProvvigione } = await import(
        "@/lib/provvigioni"
      );
      const { isModoNonProvvigionabile } = await import("@/lib/incassoFattura");

      const perimetriByMandante = new Map(
        mandantiRows.map((r) => {
          const row = r as { Id: string; PerimetriJson: string | null };
          return [String(row.Id), row.PerimetriJson] as const;
        })
      );

      const ricavoRows = await neonQuery(
        `SELECT
           i."Importo" AS "Importo",
           i."Metodo" AS "Metodo",
           i."Modo" AS "Modo",
           p."MandanteId" AS "MandanteId",
           p."NumeroMandante" AS "NumeroMandante",
           p."CodiceScarico" AS "CodiceScarico"
         FROM "Incassi" i
         INNER JOIN "Pratiche" p ON p."Id" = i."PraticaId"
         WHERE i."TenantId" = $1::uuid`,
        [tenantId]
      );
      sqlQueries += 1;

      const ricavoByMandante = new Map<string, number>();
      for (const raw of ricavoRows) {
        const row = raw as Record<string, unknown>;
        if (isModoNonProvvigionabile(row.Modo != null ? String(row.Modo) : null)) continue;
        const mid = String(row.MandanteId || "");
        if (!mid) continue;
        const peri = resolvePerimetroPratica(
          perimetriByMandante.get(mid),
          row.NumeroMandante != null ? String(row.NumeroMandante) : null
        );
        if (!peri) continue;
        const metodo = row.Metodo != null ? String(row.Metodo) : "";
        const codice =
          row.CodiceScarico != null ? String(row.CodiceScarico).trim().toUpperCase() : "";
        const lato = peri.ricevuta;
        const configurata =
          lato.provvigioniMetodo[metodo] != null ||
          (codice && lato.provvigioniCodice?.[codice] != null) ||
          lato.provvigionePerc != null;
        if (!configurata) continue;
        const pct = resolveProvvigionePercentualeLato(lato, metodo, codice || null);
        const importo = Number(row.Importo) || 0;
        ricavoByMandante.set(
          mid,
          (ricavoByMandante.get(mid) || 0) + calcolaProvvigione(importo, pct).importo
        );
      }

      const mandantiRiepilogo = riepRows.map((r) => {
        const row = r as Record<string, unknown>;
        const id = String(row.Id);
        const affidato = Number(row.affidato ?? 0);
        const incassato = Number(row.incassato ?? 0);
        return {
          id,
          codice: String(row.Codice ?? ""),
          ragioneSociale: String(row.RagioneSociale ?? ""),
          pratiche: Number(row.pratiche ?? 0),
          affidato,
          residuo: Number(row.residuo ?? 0),
          insoluto: Number(row.insoluto ?? 0),
          incassato,
          ricavoLordo: Math.round((ricavoByMandante.get(id) || 0) * 100) / 100,
          percentuale: affidato > 0 ? (incassato / affidato) * 100 : 0,
        };
      });

      const mandantiAttivi = mandantiRows.map((r) => {
        const row = r as { Id: string; Codice: string };
        return { id: String(row.Id), codice: String(row.Codice) };
      });

      const mandantiFiltriUi = mandantiRows.map((r) => {
        const row = r as {
          Id: string;
          Codice: string;
          RagioneSociale: string;
          PerimetriJson: string | null;
        };
        return {
          id: String(row.Id),
          codice: String(row.Codice),
          ragioneSociale: String(row.RagioneSociale),
          perimetri: parsePerimetriList(row.PerimetriJson).map((p) => ({
            value: p.nomeMandante || p.id,
            label: p.label,
          })),
        };
      });

      // Tipologie mese corrente (Europe/Rome)
      const tipRows = await neonQuery(
        `SELECT
           COALESCE(NULLIF(TRIM(i."Metodo"), ''), 'altro') AS metodo,
           COUNT(*) FILTER (
             WHERE (i."Data" AT TIME ZONE 'Europe/Rome')::date
               >= date_trunc('month', NOW() AT TIME ZONE 'Europe/Rome')::date
           )::int AS mese_pezzi,
           COALESCE(SUM(i."Importo") FILTER (
             WHERE (i."Data" AT TIME ZONE 'Europe/Rome')::date
               >= date_trunc('month', NOW() AT TIME ZONE 'Europe/Rome')::date
           ), 0)::float AS mese_importo,
           COUNT(*)::int AS pezzi,
           COALESCE(SUM(i."Importo"), 0)::float AS importo
         FROM "Incassi" i
         WHERE i."TenantId" = $1::uuid
         GROUP BY 1
         ORDER BY importo DESC`,
        [tenantId]
      );
      sqlQueries += 1;

      const tipologieIncasso = tipRows.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          metodo: String(row.metodo ?? "altro"),
          pezzi: Number(row.pezzi ?? 0),
          importo: Number(row.importo ?? 0),
          meseImporto: Number(row.mese_importo ?? 0),
          mesePezzi: Number(row.mese_pezzi ?? 0),
        };
      });

      if (ctx.includeAdmin) {
        admin = {
          sediOpts,
          operatoriCount,
          mandantiRiepilogo,
          mandantiFiltriUi,
          tipologieIncasso,
          caricoGruppi: [],
          codiciScaricoRiepilogo: [],
          esitiContatto: [],
          nuove: Number(p.nuove ?? 0),
          inLavorazione: Number(p.in_lavorazione ?? 0),
          inScadenza7gg: Number(p.in_scadenza_7 ?? 0),
          nonAssegnate: Number(p.non_assegnate ?? 0),
          incassiPerMandanteMese: [],
          mandantiAttivi,
        };
      }

      if (ctx.includeAmministrazione) {
        amministrazione = {
          sediOpts,
          totPratiche: Number(p.totali ?? 0),
          provvigioniMeseSum: null,
          provvigioniDaLiquidareSum: null,
          mandantiCount: mandantiAttivi.length,
          operatoriCount,
          mostraRicavi: Boolean(ctx.mostraRicavi),
          sedeFiltro: ctx.sedeRicaviId ?? null,
        };
      }
    }

    return {
      shared: {
        totali: Number(p.totali ?? 0),
        scadute: Number(p.scadute ?? 0),
        incassiOggiSum: incassiOggi,
        inLavoroPerPerimetro: [],
        lavoratePerOperatore: [],
        praticheLavorateGruppo: [],
        praticheCambioCodice: [],
        codiciMandantePerimetro: [],
        daAffidareGruppo: [],
      },
      admin,
      amministrazione,
      meta: {
        queryMs: Date.now() - t0,
        sqlQueries,
        roundTrips: 1,
      },
    };
  }
}

export function createNeonRepositories(): DataRepositories {
  return {
    tenants: new NeonTenantsRepository(),
    users: new NeonUsersRepository(),
    postazioni: new NeonPostazioniRepository(),
    pratiche: new NeonPraticheRepository(),
    dashboard: new NeonDashboardRepository(),
  };
}
