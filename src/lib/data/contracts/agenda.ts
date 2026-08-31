import type { HomeScopeFilter } from "./dashboard";

export type AgendaScopeContext = {
  tenantSlug: string;
  tenantId: string;
  role: string;
  userId: string;
  memberIds?: string[];
  scope: HomeScopeFilter;
};

export type AgendaPraticaVoce = {
  id: string;
  numero: string;
  memoAt: string;
  tipoContatto?: string | null;
  esitoContatto?: string | null;
  debitore: { nome: string; cognome: string };
  assegnatario?: { name: string } | null;
  mandante?: { codice: string };
  telefono?: string | null;
};

export type AgendaImpegnoVoce = {
  id: string;
  userId: string;
  titolo: string;
  nota: string | null;
  memoAt: string;
  completato: boolean;
  userName?: string;
};

export type AgendaCalendarioBundle = {
  pratiche: AgendaPraticaVoce[];
  impegni: AgendaImpegnoVoce[];
};

export type MemoAlertsRawBundle = AgendaCalendarioBundle & {
  intern: Array<Record<string, unknown>>;
};

export interface AgendaRepository {
  loadCalendario(ctx: AgendaScopeContext, impegniUserId: string): Promise<AgendaCalendarioBundle>;
  loadGiorno(
    ctx: AgendaScopeContext,
    impegniUserId: string,
    dayStart: string,
    dayEnd: string
  ): Promise<AgendaCalendarioBundle>;
  loadMemoAlertsRaw(
    ctx: AgendaScopeContext,
    opts: {
      impegniUserId: string;
      canAgenda: boolean;
      memoAtGte: string;
      memoAtLte: string;
    }
  ): Promise<MemoAlertsRawBundle>;
  listMessaggiAgendaScoped(ctx: AgendaScopeContext): Promise<Array<Record<string, unknown>>>;
}
