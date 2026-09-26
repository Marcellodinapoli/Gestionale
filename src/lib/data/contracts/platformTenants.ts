/**
 * Contratti platform per gestione tenant Credixa (Back Office).
 * ragioneSociale API ↔ Tenants.Nome (nessuna colonna RagioneSociale).
 */

import type { ModuleId, VerticalProfile } from "@/lib/platform/modules";

export const TENANT_STATUSES = [
  "IN_CONFIGURAZIONE",
  "ATTIVA",
  "SOSPESA",
] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const STATI_PAGAMENTO = [
  "NON_IMPOSTATO",
  "IN_REGOLA",
  "IN_RITARDO",
  "SOSPESO",
] as const;

export type StatoPagamento = (typeof STATI_PAGAMENTO)[number];

export function isTenantStatus(v: string): v is TenantStatus {
  return (TENANT_STATUSES as readonly string[]).includes(v);
}

export function isStatoPagamento(v: string): v is StatoPagamento {
  return (STATI_PAGAMENTO as readonly string[]).includes(v);
}

/** Active sincronizzato: solo ATTIVA → true. */
export function activeFromStatus(status: TenantStatus): boolean {
  return status === "ATTIVA";
}

export type TenantAnagrafica = {
  partitaIva: string | null;
  codiceFiscale: string | null;
  emailAziendale: string | null;
  telefono: string | null;
  indirizzo: string | null;
  cap: string | null;
  comune: string | null;
  provincia: string | null;
  referenteNome: string | null;
  referenteCognome: string | null;
  referenteEmail: string | null;
  referenteTelefono: string | null;
};

export type TenantAbbonamento = {
  piano: string | null;
  dataInizio: string | null;
  dataScadenza: string | null;
  statoPagamento: StatoPagamento | null;
};

export type TenantModulesDto = {
  verticalProfile: VerticalProfile;
  enabledModules: ModuleId[];
  /** Pacchetti commerciali Back Office (derivati / inviabili). */
  enabledPackages?: string[];
  packageCatalog?: Array<{ id: string; label: string; description: string }>;
};

export type TenantPlatformDto = {
  id: string;
  slug: string;
  ragioneSociale: string;
  status: TenantStatus;
  active: boolean;
  anagrafica: TenantAnagrafica;
  abbonamento: TenantAbbonamento;
  perfMonitoringEnabled: boolean;
  suspensionReason: string | null;
  createdAt: string;
  modules?: TenantModulesDto;
};

export type CreateTenantPlatformInput = {
  ragioneSociale: string;
  slug?: string;
  status?: TenantStatus;
  anagrafica?: Partial<TenantAnagrafica>;
  abbonamento?: Partial<TenantAbbonamento>;
  perfMonitoringEnabled?: boolean;
  /** Se presente, scrive subito platform.modules / platform.vertical */
  modules?: {
    enabledModules?: string[];
    /** Alternativa a enabledModules: pacchetti commerciali Back Office. */
    enabledPackages?: string[];
    verticalProfile?: VerticalProfile;
  };
};

export type UpdateTenantPlatformInput = {
  ragioneSociale?: string;
  slug?: string;
  anagrafica?: Partial<TenantAnagrafica>;
  perfMonitoringEnabled?: boolean;
};

export type UpdateAbbonamentoInput = Partial<TenantAbbonamento>;

export type TenantListFilter = {
  status?: TenantStatus;
  q?: string;
  take?: number;
  skip?: number;
};

export type TenantInviteRecord = {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  expiresAt: string;
  usedAt: string | null;
  createdByPlatformAdmin: string;
  createdAt: string;
};

export type TenantInviteLookup = TenantInviteRecord & {
  valid: boolean;
  reason?: "USED" | "EXPIRED" | "NOT_FOUND";
  /** Anagrafica tenant (join) — utile in preview pubblica. */
  ragioneSociale?: string;
  slug?: string;
};

export type CreateInviteResult = TenantInviteRecord & {
  /** Token in chiaro — solo nella response di creazione, mai persistito. */
  token: string;
  /** Link pubblico `/attiva-account?token=…` (token inclusa). */
  activationUrl: string;
  /** true se l'email è stata inviata con successo. */
  emailSent: boolean;
  /** Motivo mancato invio (config assente o errore provider). */
  emailError?: string;
  ragioneSociale?: string;
  slug?: string;
};
