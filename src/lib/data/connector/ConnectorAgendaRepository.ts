import "server-only";
import { connectorFetch } from "./ConnectorClient";
import type {
  AgendaCalendarioBundle,
  AgendaRepository,
  AgendaScopeContext,
  MemoAlertsRawBundle,
} from "../contracts/agenda";

export class ConnectorAgendaRepository implements AgendaRepository {
  constructor(private tenantSlug: string) {}

  private base(slug?: string) {
    return `/api/v1/tenants/${encodeURIComponent(slug ?? this.tenantSlug)}/agenda`;
  }

  private body(ctx: AgendaScopeContext, extra: Record<string, unknown> = {}) {
    return {
      role: ctx.role,
      userId: ctx.userId,
      memberIds: ctx.memberIds,
      scope: ctx.scope,
      ...extra,
    };
  }

  async loadCalendario(ctx: AgendaScopeContext, impegniUserId: string): Promise<AgendaCalendarioBundle> {
    return connectorFetch<AgendaCalendarioBundle>(`${this.base(ctx.tenantSlug)}/calendario`, {
      method: "POST",
      body: this.body(ctx, { impegniUserId }),
    });
  }

  async loadGiorno(
    ctx: AgendaScopeContext,
    impegniUserId: string,
    dayStart: string,
    dayEnd: string
  ): Promise<AgendaCalendarioBundle> {
    return connectorFetch<AgendaCalendarioBundle>(`${this.base(ctx.tenantSlug)}/giorno`, {
      method: "POST",
      body: this.body(ctx, { impegniUserId, dayStart, dayEnd }),
    });
  }

  async loadMemoAlertsRaw(
    ctx: AgendaScopeContext,
    opts: {
      impegniUserId: string;
      canAgenda: boolean;
      memoAtGte: string;
      memoAtLte: string;
    }
  ): Promise<MemoAlertsRawBundle> {
    return connectorFetch<MemoAlertsRawBundle>(`${this.base(ctx.tenantSlug)}/memo-alerts`, {
      method: "POST",
      body: this.body(ctx, opts),
    });
  }

  async listMessaggiAgendaScoped(ctx: AgendaScopeContext) {
    const data = await connectorFetch<{ items: Array<Record<string, unknown>> }>(
      `${this.base(ctx.tenantSlug)}/messaggi-agenda`,
      { method: "POST", body: this.body(ctx) }
    );
    return data.items;
  }
}

export function createConnectorAgendaRepository(tenantSlug: string) {
  return new ConnectorAgendaRepository(tenantSlug);
}
