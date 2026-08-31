import "server-only";
import { connectorFetch } from "./ConnectorClient";
import type {
  AssignPraticaInput,
  PraticaCreateInput,
  PraticaListFilter,
  PraticaListRequest,
  PraticaScope,
  PraticaUpdateInput,
  PraticheRepository,
} from "../contracts/pratiche";

function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  if (!row || row.id) return row;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.charAt(0).toLowerCase() + k.slice(1)] = v;
  }
  return out;
}

function mapListItem(row: Record<string, unknown>) {
  const p = mapRow(row) as Record<string, unknown>;
  if (row.DebitoreNome != null || row.debitoreNome != null) {
    p.debitore = {
      nome: row.DebitoreNome ?? row.debitoreNome,
      cognome: row.DebitoreCognome ?? row.debitoreCognome,
      telefono: row.DebitoreTelefono ?? row.debitoreTelefono,
      cap: row.DebitoreCap ?? row.debitoreCap,
      citta: row.DebitoreCitta ?? row.debitoreCitta,
      provincia: row.DebitoreProvincia ?? row.debitoreProvincia,
      codiceFiscale: row.DebitoreCodiceFiscale ?? row.debitoreCodiceFiscale,
      email: row.DebitoreEmail ?? row.debitoreEmail,
      indirizzo: row.DebitoreIndirizzo ?? row.debitoreIndirizzo,
    };
  }
  if (row.MandanteCodice != null || row.mandanteCodice != null) {
    p.mandante = {
      codice: row.MandanteCodice ?? row.mandanteCodice,
      ragioneSociale: row.MandanteRagioneSociale ?? row.mandanteRagioneSociale,
    };
  }
  if (row.AssegnatarioName != null || row.assegnatarioName != null) {
    p.assegnatario = { name: row.AssegnatarioName ?? row.assegnatarioName };
  }
  if (Array.isArray(row.rate)) p.rate = (row.rate as Record<string, unknown>[]).map(mapRow);
  if (Array.isArray(row.incassi)) {
    p.incassi = (row.incassi as Record<string, unknown>[]).map((i) => ({
      ...mapRow(i),
      user: i.UserName ? { name: i.UserName } : undefined,
    }));
  }
  if (Array.isArray(row.garanti)) p.garanti = (row.garanti as Record<string, unknown>[]).map(mapRow);
  if (Array.isArray(row.attivita)) {
    p.attivita = (row.attivita as Record<string, unknown>[]).map((a) => ({
      ...mapRow(a),
      user: a.UserName ? { name: a.UserName } : undefined,
    }));
  }
  if (Array.isArray(row.fatture)) p.fatture = (row.fatture as Record<string, unknown>[]).map(mapRow);
  if (Array.isArray(row.documenti)) p.documenti = (row.documenti as Record<string, unknown>[]).map(mapRow);
  if (Array.isArray(row.debitoreRecapiti)) {
    p.debitore = {
      ...(p.debitore as object),
      recapiti: (row.debitoreRecapiti as Record<string, unknown>[]).map(mapRow),
    };
  }
  if (row.importBatch) p.importBatch = mapRow(row.importBatch as Record<string, unknown>);
  return p;
}

export class ConnectorPraticheRepository implements PraticheRepository {
  constructor(private tenantSlug: string) {}

  private base(tenantSlug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(tenantSlug ?? this.tenantSlug)}/pratiche`;
  }

  async getById(
    tenantSlug: string,
    _tenantId: string,
    id: string,
    include?: PraticaListRequest["include"]
  ) {
    const inc = include?.join(",") ?? "";
    const data = await connectorFetch<{ item: Record<string, unknown> | null }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}${inc ? `?include=${inc}` : ""}`
    );
    return data.item ? mapListItem(data.item) : null;
  }

  async list(req: PraticaListRequest) {
    const data = await connectorFetch<{
      items: Record<string, unknown>[];
      total: number;
      page: number;
      pageSize: number;
      queryMs?: number;
    }>(`${this.base(req.tenantSlug)}/list`, {
      method: "POST",
      body: {
        scope: req.scope,
        filter: req.filter,
        sort: req.sort,
        page: req.page,
        pageSize: req.pageSize,
        skip: req.skip,
        take: req.take,
        include: req.include,
      },
    });
    return {
      items: data.items.map(mapListItem),
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
      queryMs: data.queryMs,
    };
  }

  async count(req: Omit<PraticaListRequest, "page" | "pageSize" | "skip" | "take" | "sort" | "include">) {
    const data = await connectorFetch<{ total: number }>(`${this.base(req.tenantSlug)}/count`, {
      method: "POST",
      body: { scope: req.scope, filter: req.filter },
    });
    return data.total;
  }

  async groupByNumeroMandante(tenantSlug: string, scope: PraticaScope, filter?: PraticaListFilter) {
    const data = await connectorFetch<{ items: Array<{ numeroMandante: string | null }> }>(
      `${this.base(tenantSlug)}/group-by-lotti`,
      { method: "POST", body: { scope, filter } }
    );
    return data.items;
  }

  async idsAffidoTemporaneo(tenantSlug: string, _tenantId: string) {
    const data = await connectorFetch<{ ids: string[] }>(
      `${this.base(tenantSlug)}/ids-affido-temporaneo`,
      { method: "POST", body: {} }
    );
    return data.ids;
  }

  async idsImportoTotale(tenantSlug: string, _tenantId: string, da?: number, a?: number) {
    const data = await connectorFetch<{ ids: string[] }>(
      `${this.base(tenantSlug)}/ids-importo-totale`,
      { method: "POST", body: { da, a } }
    );
    return data.ids;
  }

  async idsTotIncassato(tenantSlug: string, _tenantId: string, da?: number, a?: number) {
    const data = await connectorFetch<{ ids: string[] }>(
      `${this.base(tenantSlug)}/ids-tot-incassato`,
      { method: "POST", body: { da, a } }
    );
    return data.ids;
  }

  async nextNumero(tenantSlug: string, _tenantId: string) {
    const data = await connectorFetch<{ numero: string }>(`${this.base(tenantSlug)}/next-numero`);
    return data.numero;
  }

  async create(tenantSlug: string, data: PraticaCreateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(`${this.base(tenantSlug)}/`, {
      method: "POST",
      body: data,
    });
    return mapListItem(res.item);
  }

  async update(tenantSlug: string, _tenantId: string, id: string, data: PraticaUpdateInput) {
    const res = await connectorFetch<{ item: Record<string, unknown> }>(
      `${this.base(tenantSlug)}/${encodeURIComponent(id)}`,
      { method: "PATCH", body: data }
    );
    return mapListItem(res.item);
  }

  async delete(tenantSlug: string, _tenantId: string, id: string) {
    await connectorFetch(`${this.base(tenantSlug)}/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async assign(tenantSlug: string, _tenantId: string, id: string, input: AssignPraticaInput) {
    await connectorFetch(`${this.base(tenantSlug)}/${encodeURIComponent(id)}/assign`, {
      method: "POST",
      body: input,
    });
  }

  async updateStato(
    tenantSlug: string,
    _tenantId: string,
    id: string,
    stato: string,
    promessaAt?: Date | null
  ) {
    await connectorFetch(`${this.base(tenantSlug)}/${encodeURIComponent(id)}/stato`, {
      method: "POST",
      body: { stato, promessaAt: promessaAt?.toISOString() ?? promessaAt },
    });
  }

  async canAccess(tenantSlug: string, scope: PraticaScope, praticaId: string, linkedIds?: string[]) {
    const data = await connectorFetch<{ ok: boolean }>(`${this.base(tenantSlug)}/can-access`, {
      method: "POST",
      body: { scope, praticaId, linkedIds },
    });
    return data.ok;
  }
}

export function createConnectorPraticheRepository(tenantSlug: string) {
  return new ConnectorPraticheRepository(tenantSlug);
}
