import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { neonQuery } from "@/lib/neon/pool";
import { isNeonConfigured } from "@/lib/neon/client";
import { normalizeTenantSlug, isUuid } from "@/lib/tenant";
import {
  acceptInvite as acceptInviteCore,
  AcceptInviteError,
  hashInviteToken,
  type AcceptInviteResult,
} from "@/lib/neon/acceptInvite";
import {
  PLATFORM_CONFIG_CATEGORIA,
  PLATFORM_MODULES_KEY,
  PLATFORM_VERTICAL_KEY,
} from "@/lib/platform/tenantProfile";
import {
  parseEnabledModules,
  serializeEnabledModules,
  RECOVERY_DEFAULT_MODULES,
  VERTICAL_PROFILES,
  type ModuleId,
  type VerticalProfile,
} from "@/lib/platform/modules";
import {
  activeFromStatus,
  isStatoPagamento,
  isTenantStatus,
  type CreateInviteResult,
  type CreateTenantPlatformInput,
  type StatoPagamento,
  type TenantAbbonamento,
  type TenantAnagrafica,
  type TenantInviteLookup,
  type TenantListFilter,
  type TenantModulesDto,
  type TenantPlatformDto,
  type TenantStatus,
  type UpdateAbbonamentoInput,
  type UpdateTenantPlatformInput,
} from "@/lib/data/contracts/platformTenants";

export { AcceptInviteError, hashInviteToken };
export type { AcceptInviteResult };

const TENANT_COLUMNS = `
  "Id", "Slug", "Nome", "Active", "CreatedAt",
  "Status", "PartitaIva", "CodiceFiscale", "EmailAziendale", "Telefono",
  "Indirizzo", "Cap", "Comune", "Provincia",
  "ReferenteNome", "ReferenteCognome", "ReferenteEmail", "ReferenteTelefono",
  "Piano", "DataInizioAbbonamento", "DataScadenzaAbbonamento", "StatoPagamento",
  "PerfMonitoringEnabled", "SuspensionReason"
`;

function requireNeon() {
  if (!isNeonConfigured()) {
    throw new Error("NEON_DATABASE_URL non configurato");
  }
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function boolOr(v: unknown, fallback: boolean): boolean {
  if (v === true || v === false) return v;
  if (v === 1 || v === "1" || v === "true") return true;
  if (v === 0 || v === "0" || v === "false") return false;
  return fallback;
}

function dateIso(v: unknown): string | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseStatus(raw: unknown, active: boolean): TenantStatus {
  const s = String(raw || "").trim();
  if (isTenantStatus(s)) return s;
  return active ? "ATTIVA" : "SOSPESA";
}

function parsePagamento(raw: unknown): StatoPagamento | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  return isStatoPagamento(s) ? s : null;
}

function mapAnagrafica(row: Record<string, unknown>): TenantAnagrafica {
  return {
    partitaIva: strOrNull(row.PartitaIva ?? row.partitaIva),
    codiceFiscale: strOrNull(row.CodiceFiscale ?? row.codiceFiscale),
    emailAziendale: strOrNull(row.EmailAziendale ?? row.emailAziendale),
    telefono: strOrNull(row.Telefono ?? row.telefono),
    indirizzo: strOrNull(row.Indirizzo ?? row.indirizzo),
    cap: strOrNull(row.Cap ?? row.cap),
    comune: strOrNull(row.Comune ?? row.comune),
    provincia: strOrNull(row.Provincia ?? row.provincia),
    referenteNome: strOrNull(row.ReferenteNome ?? row.referenteNome),
    referenteCognome: strOrNull(row.ReferenteCognome ?? row.referenteCognome),
    referenteEmail: strOrNull(row.ReferenteEmail ?? row.referenteEmail),
    referenteTelefono: strOrNull(row.ReferenteTelefono ?? row.referenteTelefono),
  };
}

function mapAbbonamento(row: Record<string, unknown>): TenantAbbonamento {
  return {
    piano: strOrNull(row.Piano ?? row.piano),
    dataInizio: dateIso(row.DataInizioAbbonamento ?? row.dataInizioAbbonamento),
    dataScadenza: dateIso(
      row.DataScadenzaAbbonamento ?? row.dataScadenzaAbbonamento
    ),
    statoPagamento: parsePagamento(row.StatoPagamento ?? row.statoPagamento),
  };
}

function mapTenantRow(row: Record<string, unknown>): TenantPlatformDto {
  const active = boolOr(row.Active ?? row.active, true);
  const status = parseStatus(row.Status ?? row.status, active);
  return {
    id: String(row.Id ?? row.id),
    slug: String(row.Slug ?? row.slug),
    ragioneSociale: String(row.Nome ?? row.nome ?? ""),
    status,
    active: activeFromStatus(status),
    anagrafica: mapAnagrafica(row),
    abbonamento: mapAbbonamento(row),
    perfMonitoringEnabled: boolOr(
      row.PerfMonitoringEnabled ?? row.perfMonitoringEnabled,
      false
    ),
    suspensionReason: strOrNull(row.SuspensionReason ?? row.suspensionReason),
    createdAt: dateIso(row.CreatedAt ?? row.createdAt) || new Date(0).toISOString(),
  };
}

function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

function assertStatusActiveSync(status: TenantStatus, active: boolean) {
  const expected = activeFromStatus(status);
  if (active !== expected) {
    throw new Error(
      `Stato incoerente: Status=${status} richiede Active=${active} (atteso ${expected})`
    );
  }
}

function parseVertical(raw: string | null | undefined): VerticalProfile {
  const v = String(raw || "").trim().toUpperCase();
  if ((VERTICAL_PROFILES as readonly string[]).includes(v)) {
    return v as VerticalProfile;
  }
  return "RECUPERO_CREDITI";
}

async function loadModulesForTenant(tenantId: string): Promise<TenantModulesDto> {
  const rows = await neonQuery(
    `SELECT "Chiave", "Valore"
     FROM "ConfigurazioneSistema"
     WHERE "TenantId" = $1::uuid
       AND "Chiave" IN ($2, $3)`,
    [tenantId, PLATFORM_MODULES_KEY, PLATFORM_VERTICAL_KEY]
  ).catch(() => [] as Record<string, unknown>[]);

  const map = new Map<string, string>();
  for (const r of rows) {
    const row = r as Record<string, unknown>;
    const k = String(row.Chiave ?? row.chiave ?? "");
    const v = String(row.Valore ?? row.valore ?? "");
    if (k) map.set(k, v);
  }
  if (!map.has(PLATFORM_MODULES_KEY) && !map.has(PLATFORM_VERTICAL_KEY)) {
    return {
      verticalProfile: "RECUPERO_CREDITI",
      enabledModules: [...RECOVERY_DEFAULT_MODULES],
    };
  }
  return {
    verticalProfile: parseVertical(map.get(PLATFORM_VERTICAL_KEY)),
    enabledModules: parseEnabledModules(map.get(PLATFORM_MODULES_KEY)),
  };
}

async function upsertConfigChiave(
  tenantId: string,
  chiave: string,
  valore: string
): Promise<void> {
  const existing = await neonQuery(
    `SELECT "Id" FROM "ConfigurazioneSistema"
     WHERE "TenantId" = $1::uuid AND "Chiave" = $2 LIMIT 1`,
    [tenantId, chiave]
  );
  if (existing[0]) {
    await neonQuery(
      `UPDATE "ConfigurazioneSistema"
       SET "Valore" = $3, "Categoria" = $4, "UpdatedAt" = now()
       WHERE "TenantId" = $1::uuid AND "Chiave" = $2`,
      [tenantId, chiave, valore, PLATFORM_CONFIG_CATEGORIA]
    );
    return;
  }
  await neonQuery(
    `INSERT INTO "ConfigurazioneSistema"
       ("Id", "TenantId", "Chiave", "Valore", "Categoria", "UpdatedAt")
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, now())`,
    [randomUUID(), tenantId, chiave, valore, PLATFORM_CONFIG_CATEGORIA]
  );
}

function slugifyRagioneSociale(nome: string): string {
  const base = normalizeTenantSlug(nome);
  if (base.length >= 2) return base.slice(0, 50);
  return `azienda-${randomBytes(3).toString("hex")}`;
}

async function assertSlugAvailable(slug: string, excludeId?: string) {
  const rows = excludeId
    ? await neonQuery(
        `SELECT "Id" FROM "Tenants" WHERE lower("Slug") = lower($1) AND "Id" <> $2::uuid LIMIT 1`,
        [slug, excludeId]
      )
    : await neonQuery(
        `SELECT "Id" FROM "Tenants" WHERE lower("Slug") = lower($1) LIMIT 1`,
        [slug]
      );
  if (rows[0]) throw new Error(`Slug già in uso: ${slug}`);
}

export class NeonPlatformTenantsRepository {
  async create(input: CreateTenantPlatformInput): Promise<TenantPlatformDto> {
    requireNeon();
    const ragione = String(input.ragioneSociale || "").trim();
    if (!ragione) throw new Error("Ragione sociale obbligatoria");
    const slug = normalizeTenantSlug(input.slug || slugifyRagioneSociale(ragione));
    if (!slug) throw new Error("Slug non valido");
    await assertSlugAvailable(slug);

    const status: TenantStatus = input.status && isTenantStatus(input.status)
      ? input.status
      : "IN_CONFIGURAZIONE";
    const active = activeFromStatus(status);
    assertStatusActiveSync(status, active);

    const a = input.anagrafica || {};
    const b = input.abbonamento || {};
    const id = randomUUID();

    await neonQuery(
      `INSERT INTO "Tenants" (
        "Id", "Slug", "Nome", "Active", "CreatedAt", "Status",
        "PartitaIva", "CodiceFiscale", "EmailAziendale", "Telefono",
        "Indirizzo", "Cap", "Comune", "Provincia",
        "ReferenteNome", "ReferenteCognome", "ReferenteEmail", "ReferenteTelefono",
        "Piano", "DataInizioAbbonamento", "DataScadenzaAbbonamento", "StatoPagamento",
        "PerfMonitoringEnabled", "SuspensionReason"
      ) VALUES (
        $1::uuid, $2, $3, $4, now(), $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19::timestamptz, $20::timestamptz, $21,
        $22, NULL
      )`,
      [
        id,
        slug,
        ragione,
        active,
        status,
        strOrNull(a.partitaIva),
        strOrNull(a.codiceFiscale),
        strOrNull(a.emailAziendale),
        strOrNull(a.telefono),
        strOrNull(a.indirizzo),
        strOrNull(a.cap),
        strOrNull(a.comune),
        strOrNull(a.provincia),
        strOrNull(a.referenteNome),
        strOrNull(a.referenteCognome),
        strOrNull(a.referenteEmail),
        strOrNull(a.referenteTelefono),
        strOrNull(b.piano),
        b.dataInizio ? new Date(b.dataInizio).toISOString() : null,
        b.dataScadenza ? new Date(b.dataScadenza).toISOString() : null,
        b.statoPagamento && isStatoPagamento(b.statoPagamento)
          ? b.statoPagamento
          : null,
        Boolean(input.perfMonitoringEnabled),
      ]
    );

    if (input.modules?.enabledModules) {
      await this.updateModules(id, {
        enabledModules: input.modules.enabledModules as ModuleId[],
        verticalProfile: input.modules.verticalProfile,
      });
    }

    const created = await this.getById(id);
    if (!created) throw new Error("Tenant non creato");
    return created;
  }

  async getById(
    id: string,
    opts?: { includeModules?: boolean }
  ): Promise<TenantPlatformDto | null> {
    requireNeon();
    if (!isUuid(id)) return null;
    const rows = await neonQuery(
      `SELECT ${TENANT_COLUMNS} FROM "Tenants" WHERE "Id" = $1::uuid LIMIT 1`,
      [id]
    );
    if (!rows[0]) return null;
    const dto = mapTenantRow(rows[0] as Record<string, unknown>);
    if (opts?.includeModules) {
      dto.modules = await loadModulesForTenant(dto.id);
    }
    return dto;
  }

  async getBySlug(
    slug: string,
    opts?: { includeModules?: boolean }
  ): Promise<TenantPlatformDto | null> {
    requireNeon();
    const s = normalizeTenantSlug(slug);
    if (!s) return null;
    const rows = await neonQuery(
      `SELECT ${TENANT_COLUMNS} FROM "Tenants" WHERE lower("Slug") = lower($1) LIMIT 1`,
      [s]
    );
    if (!rows[0]) return null;
    const dto = mapTenantRow(rows[0] as Record<string, unknown>);
    if (opts?.includeModules) {
      dto.modules = await loadModulesForTenant(dto.id);
    }
    return dto;
  }

  async list(filter: TenantListFilter = {}): Promise<{
    items: TenantPlatformDto[];
    total: number;
  }> {
    requireNeon();
    const take = Math.min(Math.max(filter.take ?? 50, 1), 200);
    const skip = Math.max(filter.skip ?? 0, 0);
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filter.status && isTenantStatus(filter.status)) {
      params.push(filter.status);
      clauses.push(`"Status" = $${params.length}`);
    }
    if (filter.q?.trim()) {
      params.push(`%${filter.q.trim().toLowerCase()}%`);
      const i = params.length;
      clauses.push(
        `(lower("Nome") LIKE $${i} OR lower("Slug") LIKE $${i} OR lower(COALESCE("PartitaIva",'')) LIKE $${i})`
      );
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const countRows = await neonQuery(
      `SELECT COUNT(*)::int AS n FROM "Tenants" ${where}`,
      params
    );
    const total = Number(
      (countRows[0] as { n?: number; N?: number } | undefined)?.n ??
        (countRows[0] as { N?: number } | undefined)?.N ??
        0
    );

    params.push(take, skip);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;
    const rows = await neonQuery(
      `SELECT ${TENANT_COLUMNS} FROM "Tenants" ${where}
       ORDER BY "CreatedAt" DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );
    return {
      items: rows.map((r) => mapTenantRow(r as Record<string, unknown>)),
      total,
    };
  }

  async updateAnagrafica(
    id: string,
    input: UpdateTenantPlatformInput
  ): Promise<TenantPlatformDto> {
    requireNeon();
    const current = await this.getById(id);
    if (!current) throw new Error("Tenant non trovato");

    let slug = current.slug;
    if (input.slug != null) {
      slug = normalizeTenantSlug(input.slug);
      if (!slug) throw new Error("Slug non valido");
      await assertSlugAvailable(slug, id);
    }
    const nome =
      input.ragioneSociale != null
        ? String(input.ragioneSociale).trim()
        : current.ragioneSociale;
    if (!nome) throw new Error("Ragione sociale obbligatoria");

    const a = { ...current.anagrafica, ...(input.anagrafica || {}) };
    const perf =
      input.perfMonitoringEnabled != null
        ? Boolean(input.perfMonitoringEnabled)
        : current.perfMonitoringEnabled;

    await neonQuery(
      `UPDATE "Tenants" SET
        "Slug" = $2,
        "Nome" = $3,
        "PartitaIva" = $4,
        "CodiceFiscale" = $5,
        "EmailAziendale" = $6,
        "Telefono" = $7,
        "Indirizzo" = $8,
        "Cap" = $9,
        "Comune" = $10,
        "Provincia" = $11,
        "ReferenteNome" = $12,
        "ReferenteCognome" = $13,
        "ReferenteEmail" = $14,
        "ReferenteTelefono" = $15,
        "PerfMonitoringEnabled" = $16
       WHERE "Id" = $1::uuid`,
      [
        id,
        slug,
        nome,
        strOrNull(a.partitaIva),
        strOrNull(a.codiceFiscale),
        strOrNull(a.emailAziendale),
        strOrNull(a.telefono),
        strOrNull(a.indirizzo),
        strOrNull(a.cap),
        strOrNull(a.comune),
        strOrNull(a.provincia),
        strOrNull(a.referenteNome),
        strOrNull(a.referenteCognome),
        strOrNull(a.referenteEmail),
        strOrNull(a.referenteTelefono),
        perf,
      ]
    );

    const updated = await this.getById(id);
    if (!updated) throw new Error("Tenant non aggiornato");
    return updated;
  }

  async updateAbbonamento(
    id: string,
    input: UpdateAbbonamentoInput
  ): Promise<TenantPlatformDto> {
    requireNeon();
    const current = await this.getById(id);
    if (!current) throw new Error("Tenant non trovato");
    const next: TenantAbbonamento = {
      piano:
        input.piano !== undefined ? strOrNull(input.piano) : current.abbonamento.piano,
      dataInizio:
        input.dataInizio !== undefined
          ? input.dataInizio
            ? new Date(input.dataInizio).toISOString()
            : null
          : current.abbonamento.dataInizio,
      dataScadenza:
        input.dataScadenza !== undefined
          ? input.dataScadenza
            ? new Date(input.dataScadenza).toISOString()
            : null
          : current.abbonamento.dataScadenza,
      statoPagamento:
        input.statoPagamento !== undefined
          ? input.statoPagamento && isStatoPagamento(input.statoPagamento)
            ? input.statoPagamento
            : null
          : current.abbonamento.statoPagamento,
    };

    await neonQuery(
      `UPDATE "Tenants" SET
        "Piano" = $2,
        "DataInizioAbbonamento" = $3::timestamptz,
        "DataScadenzaAbbonamento" = $4::timestamptz,
        "StatoPagamento" = $5
       WHERE "Id" = $1::uuid`,
      [id, next.piano, next.dataInizio, next.dataScadenza, next.statoPagamento]
    );

    const updated = await this.getById(id);
    if (!updated) throw new Error("Tenant non aggiornato");
    return updated;
  }

  async updateStatus(id: string, status: TenantStatus): Promise<TenantPlatformDto> {
    requireNeon();
    if (!isTenantStatus(status)) throw new Error("Status non valido");
    const current = await this.getById(id);
    if (!current) throw new Error("Tenant non trovato");
    const active = activeFromStatus(status);
    assertStatusActiveSync(status, active);

    const clearReason = status === "ATTIVA" || status === "IN_CONFIGURAZIONE";
    await neonQuery(
      `UPDATE "Tenants" SET
        "Status" = $2,
        "Active" = $3,
        "SuspensionReason" = CASE WHEN $4::boolean THEN NULL ELSE "SuspensionReason" END
       WHERE "Id" = $1::uuid`,
      [id, status, active, clearReason]
    );

    const updated = await this.getById(id);
    if (!updated) throw new Error("Tenant non aggiornato");
    return updated;
  }

  async suspend(id: string, reason: string): Promise<TenantPlatformDto> {
    requireNeon();
    const current = await this.getById(id);
    if (!current) throw new Error("Tenant non trovato");
    const r = String(reason || "").trim();
    if (!r) throw new Error("Motivazione sospensione obbligatoria");

    await neonQuery(
      `UPDATE "Tenants" SET
        "Status" = 'SOSPESA',
        "Active" = false,
        "SuspensionReason" = $2
       WHERE "Id" = $1::uuid`,
      [id, r]
    );

    const updated = await this.getById(id);
    if (!updated) throw new Error("Tenant non aggiornato");
    return updated;
  }

  async activate(id: string): Promise<TenantPlatformDto> {
    return this.updateStatus(id, "ATTIVA");
  }

  async getModules(tenantId: string): Promise<TenantModulesDto> {
    requireNeon();
    const t = await this.getById(tenantId);
    if (!t) throw new Error("Tenant non trovato");
    return loadModulesForTenant(tenantId);
  }

  async updateModules(
    tenantId: string,
    input: { enabledModules: string[]; verticalProfile?: VerticalProfile }
  ): Promise<TenantModulesDto> {
    requireNeon();
    const t = await this.getById(tenantId);
    if (!t) throw new Error("Tenant non trovato");

    const serialized = serializeEnabledModules(input.enabledModules);
    await upsertConfigChiave(tenantId, PLATFORM_MODULES_KEY, serialized);

    if (input.verticalProfile) {
      const v = parseVertical(input.verticalProfile);
      await upsertConfigChiave(tenantId, PLATFORM_VERTICAL_KEY, v);
    }

    return loadModulesForTenant(tenantId);
  }

  async createInvite(input: {
    tenantId: string;
    email: string;
    role?: string;
    expiresInHours?: number;
    createdByPlatformAdmin: string;
  }): Promise<CreateInviteResult> {
    requireNeon();
    const tenant = await this.getById(input.tenantId);
    if (!tenant) throw new Error("Tenant non trovato");

    const email = String(input.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("Email non valida");

    const role = String(input.role || "ADMIN").trim().toUpperCase() || "ADMIN";
    if (role !== "ADMIN") {
      throw new Error("In questa fase l'invito supporta solo il ruolo ADMIN");
    }

    const hours = Math.min(Math.max(input.expiresInHours ?? 72, 1), 24 * 30);
    const expiresAt = new Date(Date.now() + hours * 3600_000);
    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const id = randomUUID();
    const admin = String(input.createdByPlatformAdmin || "platform").trim() || "platform";

    await neonQuery(
      `INSERT INTO "TenantInvites" (
        "Id", "TenantId", "Email", "Role", "TokenHash",
        "ExpiresAt", "UsedAt", "CreatedByPlatformAdmin", "CreatedAt"
      ) VALUES (
        $1::uuid, $2::uuid, $3, $4, $5,
        $6::timestamptz, NULL, $7, now()
      )`,
      [id, input.tenantId, email, role, tokenHash, expiresAt.toISOString(), admin]
    );

    return {
      id,
      tenantId: input.tenantId,
      email,
      role,
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
      createdByPlatformAdmin: admin,
      createdAt: new Date().toISOString(),
      token,
    };
  }

  async findInviteByTokenHash(tokenHash: string): Promise<TenantInviteLookup> {
    requireNeon();
    const hash = String(tokenHash || "").trim();
    if (!hash) {
      return {
        id: "",
        tenantId: "",
        email: "",
        role: "",
        expiresAt: "",
        usedAt: null,
        createdByPlatformAdmin: "",
        createdAt: "",
        valid: false,
        reason: "NOT_FOUND",
      };
    }

    const rows = await neonQuery(
      `SELECT "Id", "TenantId", "Email", "Role", "TokenHash",
              "ExpiresAt", "UsedAt", "CreatedByPlatformAdmin", "CreatedAt"
       FROM "TenantInvites"
       WHERE "TokenHash" = $1
       LIMIT 1`,
      [hash]
    );
    if (!rows[0]) {
      return {
        id: "",
        tenantId: "",
        email: "",
        role: "",
        expiresAt: "",
        usedAt: null,
        createdByPlatformAdmin: "",
        createdAt: "",
        valid: false,
        reason: "NOT_FOUND",
      };
    }
    const row = rows[0] as Record<string, unknown>;
    const base = {
      id: String(row.Id),
      tenantId: String(row.TenantId),
      email: String(row.Email),
      role: String(row.Role),
      expiresAt: dateIso(row.ExpiresAt) || "",
      usedAt: dateIso(row.UsedAt),
      createdByPlatformAdmin: String(row.CreatedByPlatformAdmin),
      createdAt: dateIso(row.CreatedAt) || "",
    };
    if (base.usedAt) return { ...base, valid: false, reason: "USED" };
    if (new Date(base.expiresAt).getTime() < Date.now()) {
      return { ...base, valid: false, reason: "EXPIRED" };
    }
    return { ...base, valid: true };
  }

  /** Verifica token in chiaro (hash lato server). */
  async verifyInviteToken(token: string): Promise<TenantInviteLookup> {
    return this.findInviteByTokenHash(hashInviteToken(String(token || "").trim()));
  }

  /**
   * Accetta invito monouso: consuma TokenHash in TX e crea User ADMIN.
   * Non cambia Status del tenant.
   */
  async acceptInvite(
    token: string,
    password: string,
    passwordConfirm: string
  ): Promise<AcceptInviteResult> {
    requireNeon();
    return acceptInviteCore(token, password, passwordConfirm);
  }
}

let singleton: NeonPlatformTenantsRepository | null = null;

export function getNeonPlatformTenantsRepository(): NeonPlatformTenantsRepository {
  if (!singleton) singleton = new NeonPlatformTenantsRepository();
  return singleton;
}
