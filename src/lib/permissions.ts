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
  postazioneFissa?: boolean;
  interno?: string | null;
  prefissoChiamata?: string | null;
  postazioneEmail?: string | null;
  postazioneNome?: string | null;
  sedeId?: string | null;
  sedeNome?: string | null;
  formazioneOnly?: boolean;
};

export { isFormazioneOnly } from "@/lib/formazioneOnlyAccess";

const FORMAZIONE_ONLY_PERMISSIONS: Permission[] = ["formazione:view"];

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

/** Tutti tranne admin (e formazione-only) devono avere una postazione. */
export function requiresPostazione(
  user: { role: Role; formazioneOnly?: boolean } | null | undefined
) {
  if (!user) return false;
  if (user.formazioneOnly) return false;
  return user.role !== "ADMIN";
}

/** Solo l'operatore deve avere l'interno configurato prima di chiamare. */
export function richiedeInternoPerChiamata(role: Role) {
  return role === "OPERATOR";
}

/** Back office e amministrazione possono fissare la postazione e saltare la selezione al login. */
export function canImpostarePostazioneFissa(role: Role) {
  return role === "BACK_OFFICE" || role === "AMMINISTRAZIONE";
}

/** True se l'utente deve ancora passare dalla schermata di selezione postazione. */
export function mustChoosePostazioneAlLogin(
  user: {
    role: Role;
    formazioneOnly?: boolean;
    postazioneId?: string | null;
    postazioneFissa?: boolean;
  } | null | undefined
) {
  if (!user || !requiresPostazione(user)) return false;
  if (user.postazioneFissa && user.postazioneId) return false;
  return !user.postazioneId;
}

/** Ruoli assegnabili in creazione account, in base al creatore. */
export function ruoliCreabiliDa(creatorRole: Role): Role[] {
  if (creatorRole === "ADMIN") {
    return ["OPERATOR", "BACK_OFFICE", "SUPERVISOR", "AMMINISTRAZIONE"];
  }
  if (creatorRole === "AMMINISTRAZIONE") {
    return ["OPERATOR", "BACK_OFFICE", "SUPERVISOR", "AMMINISTRAZIONE"];
  }
  if (creatorRole === "BACK_OFFICE") {
    return ["OPERATOR"];
  }
  return [];
}

/** Ricavi e incassi totali dell'azienda (dashboard globale): solo amministratore azienda. */
export function canViewRicaviIncassiAzienda(user: { role: Role } | null | undefined) {
  if (!user || isManutenzione(user)) return false;
  return user.role === "ADMIN";
}

/** Alias: solo Admin vede ricavi/fatturati delle altre sedi (e totali azienda). */
export function canViewRendimentoAltreSedi(user: { role: Role } | null | undefined) {
  return canViewRicaviIncassiAzienda(user);
}

/** CRUD sedi (e gestione cross-sede): Admin e Amministrazione. */
export function canManageSedi(user: { role: Role } | null | undefined) {
  if (!user || isManutenzione(user)) return false;
  return user.role === "ADMIN" || user.role === "AMMINISTRAZIONE";
}

/** Creazione e modifica perimetri/commesse nella scheda mandante. */
export function canManageMandantePerimetri(user: { role: Role } | null | undefined) {
  if (!user || isManutenzione(user)) return false;
  return user.role === "ADMIN" || user.role === "AMMINISTRAZIONE";
}

export function can(
  user: { role: Role; formazioneOnly?: boolean } | null | undefined,
  permission: Permission
) {
  if (!user) return false;
  if (isManutenzione(user)) return true;
  if (user.formazioneOnly) {
    return FORMAZIONE_ONLY_PERMISSIONS.includes(permission);
  }
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
