export const CREDIT_TYPES = [
  "Prestito personale",
  "Carta revolving",
  "Cessione del quinto",
  "Mutuo",
  "Leasing",
  "Finanziamento auto",
  "Finanziamento finalizzato",
  "Altro",
] as const;

export const EMPLOYMENT_STATUSES = [
  "Dipendente",
  "Autonomo",
  "Pensionato",
  "Disoccupato",
  "Non nota",
] as const;

export const GUARANTOR_OPTIONS = ["Nessuno", "Presente"] as const;

export const PRACTICE_STATES = [
  { key: "monitoraggio_originator", label: "Monitoraggio Originator" },
  { key: "recupero_ceduto", label: "Recupero credito ceduto" },
  { key: "piano_rientro", label: "Piano di rientro" },
  { key: "saldo_stralcio", label: "Saldo e stralcio" },
] as const;

export type PracticeStateKey = (typeof PRACTICE_STATES)[number]["key"];

export const UNPAID_INSTALLMENTS = [1, 2, 3, 4, 5, 6, 7] as const;

export const INSOLVENCY_OPTIONS = [
  "Primo episodio",
  "Insolvenze occasionali",
  "Insolvenze frequenti",
] as const;

export const DEFAULT_MGMT_OPTIONS = [
  "Paga rata e morosità",
  "Paga solo rata",
  "Non regolarizza",
] as const;

export const ASSIGNMENT_OPTIONS = ["Prima", "Seconda", "Terza o successive"] as const;

export const RECOVERY_HISTORY_OPTIONS = [
  "Collaborativo",
  "Saltuario",
  "Nessuna collaborazione",
] as const;

export const PAYMENT_METHOD_OPTIONS = ["Bonifico", "Bollettino", "Cambiali", "Altro"] as const;

export function practiceStateLabel(key: string | null | undefined) {
  return PRACTICE_STATES.find((s) => s.key === key)?.label ?? null;
}
