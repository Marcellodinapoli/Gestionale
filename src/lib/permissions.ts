export type Role =
  | "ADMIN"
  | "AMMINISTRAZIONE"
  | "SUPERVISOR"
  | "BACK_OFFICE"
  | "OPERATOR"
  | "MANUTENZIONE";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  supervisorId: string | null;
  tenantId: string;
  tenantSlug?: string | null;
  tenantNome?: string | null;
  postazioneId?: string | null;
  interno?: string | null;
  prefissoChiamata?: string | null;
  postazioneEmail?: string | null;
  postazioneNome?: string | null;
};

export type Permission =
  | "users:manage"
  | "mandanti:manage"
  | "mandanti:delete"
  | "pratiche:create"
  | "pratiche:assign"
  | "pratiche:delete"
  | "pratiche:update:amounts"
  | "pratiche:update:stato"
  | "pratiche:work"
  | "incassi:create"
  | "import:run"
  | "report:view"
  | "statistiche:view"
  | "provigioni:view"
  | "audit:view"
  | "agenda:view"
  | "telephony:manage"
  | "operatori:manage"
  | "pratiche:nota-massiva"
  | "lavorazione:view"
  | "formazione:view";

const MAP: Record<Permission, Role[]> = {
  "users:manage": ["ADMIN"],
  "mandanti:manage": ["ADMIN", "BACK_OFFICE", "AMMINISTRAZIONE"],
  "mandanti:delete": ["ADMIN"],
  "pratiche:create": ["ADMIN", "BACK_OFFICE"],
  "pratiche:assign": ["ADMIN", "SUPERVISOR", "BACK_OFFICE"],
  "pratiche:delete": ["ADMIN"],
  "pratiche:update:amounts": ["ADMIN", "BACK_OFFICE", "AMMINISTRAZIONE"],
  "pratiche:update:stato": ["ADMIN", "SUPERVISOR", "BACK_OFFICE"],
  "pratiche:work": ["ADMIN", "SUPERVISOR", "OPERATOR"],
  "pratiche:nota-massiva": ["ADMIN", "SUPERVISOR", "BACK_OFFICE", "AMMINISTRAZIONE"],
  "incassi:create": ["ADMIN", "BACK_OFFICE", "AMMINISTRAZIONE"],
  "import:run": ["ADMIN", "BACK_OFFICE"],
  "report:view": ["ADMIN", "SUPERVISOR", "BACK_OFFICE"],
  "statistiche:view": ["ADMIN", "OPERATOR", "SUPERVISOR", "AMMINISTRAZIONE"],
  "provigioni:view": ["ADMIN", "SUPERVISOR", "OPERATOR", "AMMINISTRAZIONE"],
  "audit:view": ["ADMIN", "AMMINISTRAZIONE"],
  "agenda:view": ["ADMIN", "SUPERVISOR", "OPERATOR", "BACK_OFFICE", "AMMINISTRAZIONE"],
  "telephony:manage": ["ADMIN"],
  "operatori:manage": ["ADMIN", "AMMINISTRAZIONE"],
  "lavorazione:view": ["ADMIN", "SUPERVISOR", "BACK_OFFICE", "OPERATOR"],
  "formazione:view": ["ADMIN", "SUPERVISOR", "BACK_OFFICE", "OPERATOR"],
};

export function isManutenzione(user: { role: string } | null | undefined) {
  return user?.role === "MANUTENZIONE";
}

/** Ruoli che devono scegliere una postazione al login. */
export function requiresPostazione(user: { role: Role } | null | undefined) {
  if (!user) return false;
  return !["ADMIN", "AMMINISTRAZIONE"].includes(user.role);
}

/** Ricavi e incassi totali dell'azienda (dashboard globale): solo amministratore azienda. */
export function canViewRicaviIncassiAzienda(user: { role: Role } | null | undefined) {
  if (!user || isManutenzione(user)) return false;
  return user.role === "ADMIN";
}

/** Creazione e modifica perimetri/commesse nella scheda mandante. */
export function canManageMandantePerimetri(user: { role: Role } | null | undefined) {
  if (!user || isManutenzione(user)) return false;
  return user.role === "ADMIN" || user.role === "AMMINISTRAZIONE";
}

export function can(user: { role: Role } | null | undefined, permission: Permission) {
  if (!user) return false;
  if (isManutenzione(user)) return true;
  return MAP[permission].includes(user.role);
}

export function assertCan(user: { role: Role } | null | undefined, permission: Permission) {
  if (!can(user, permission)) {
    throw new Error("Operazione non consentita per il tuo ruolo");
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  SUPERVISOR: "Supervisor",
  BACK_OFFICE: "Back office",
  OPERATOR: "Operatore",
  AMMINISTRAZIONE: "Amministrazione",
  MANUTENZIONE: "Manutenzione",
};

export const STATO_LABELS: Record<string, string> = {
  NUOVA: "Nuova",
  AFFIDATA: "Affidata",
  IN_LAVORAZIONE: "In lavorazione",
  PROMESSA: "Promessa",
  PIANO: "Piano di rientro",
  INCASSO: "Incassata",
  INESIGIBILE: "Inesigibile",
  RESA: "Resa mandante",
};
