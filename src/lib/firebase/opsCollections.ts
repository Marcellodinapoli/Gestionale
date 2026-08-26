/** Mapping modelli Credixa → collection Firestore sotto credixa/{tenantId}/ */

export const OPS_MODEL_COLLECTION: Record<string, string> = {
  Tenant: "_meta",
  User: "users",
  Sede: "sedi",
  Postazione: "postazioni",
  Mandante: "mandanti",
  Debitore: "debitori",
  DebitoreRecapito: "debitoreRecapiti",
  Pratica: "pratiche",
  PraticaLock: "praticaLocks",
  Garante: "garanti",
  GaranteRecapito: "garanteRecapiti",
  Fattura: "fatture",
  Incasso: "incassi",
  Attivita: "attivita",
  Provvigione: "provvigioni",
  Documento: "documenti",
  PianoRata: "pianiRata",
  MessaggioAgenda: "messaggiAgenda",
  ImpegnoAgenda: "impegniAgenda",
  MessaggioInterno: "messaggiInterni",
  ConfigurazioneSistema: "configurazione",
  RegistrazioneChiamata: "registrazioni",
  AuditLog: "auditLogs",
  PasswordHistory: "passwordHistory",
  ImportBatch: "importBatch",
};

export const PRISMA_DELEGATE_TO_MODEL: Record<string, string> = {
  tenant: "Tenant",
  user: "User",
  sede: "Sede",
  postazione: "Postazione",
  mandante: "Mandante",
  debitore: "Debitore",
  debitoreRecapito: "DebitoreRecapito",
  pratica: "Pratica",
  praticaLock: "PraticaLock",
  garante: "Garante",
  garanteRecapito: "GaranteRecapito",
  fattura: "Fattura",
  incasso: "Incasso",
  attivita: "Attivita",
  provvigione: "Provvigione",
  documento: "Documento",
  pianoRata: "PianoRata",
  messaggioAgenda: "MessaggioAgenda",
  impegnoAgenda: "ImpegnoAgenda",
  messaggioInterno: "MessaggioInterno",
  configurazioneSistema: "ConfigurazioneSistema",
  registrazioneChiamata: "RegistrazioneChiamata",
  auditLog: "AuditLog",
  passwordHistory: "PasswordHistory",
  importBatch: "ImportBatch",
};

/** Relazioni usate in include/where nested */
export const MODEL_RELATIONS: Record<
  string,
  Record<string, { model: string; local: string; foreign: string; many?: boolean }>
> = {
  User: {
    tenant: { model: "Tenant", local: "tenantId", foreign: "id" },
    postazione: { model: "Postazione", local: "postazioneId", foreign: "id" },
    sede: { model: "Sede", local: "sedeId", foreign: "id" },
    supervisor: { model: "User", local: "supervisorId", foreign: "id" },
    operators: { model: "User", local: "id", foreign: "supervisorId", many: true },
    passwordHistory: {
      model: "PasswordHistory",
      local: "id",
      foreign: "userId",
      many: true,
    },
  },
  PasswordHistory: {
    user: { model: "User", local: "userId", foreign: "id" },
  },
  Pratica: {
    tenant: { model: "Tenant", local: "tenantId", foreign: "id" },
    debitore: { model: "Debitore", local: "debitoreId", foreign: "id" },
    mandante: { model: "Mandante", local: "mandanteId", foreign: "id" },
    assegnatario: { model: "User", local: "assegnatarioId", foreign: "id" },
    operatoreTitolare: { model: "User", local: "operatoreTitolareId", foreign: "id" },
    attivita: { model: "Attivita", local: "id", foreign: "praticaId", many: true },
    incassi: { model: "Incasso", local: "id", foreign: "praticaId", many: true },
    fatture: { model: "Fattura", local: "id", foreign: "praticaId", many: true },
    garanti: { model: "Garante", local: "id", foreign: "praticaId", many: true },
    rate: { model: "PianoRata", local: "id", foreign: "praticaId", many: true },
    documenti: { model: "Documento", local: "id", foreign: "praticaId", many: true },
    importBatch: { model: "ImportBatch", local: "importBatchId", foreign: "id" },
  },
  ImportBatch: {
    pratiche: { model: "Pratica", local: "id", foreign: "importBatchId", many: true },
  },
  Debitore: {
    recapiti: { model: "DebitoreRecapito", local: "id", foreign: "debitoreId", many: true },
  },
  Garante: {
    recapiti: { model: "GaranteRecapito", local: "id", foreign: "garanteId", many: true },
  },
  Attivita: {
    user: { model: "User", local: "userId", foreign: "id" },
    pratica: { model: "Pratica", local: "praticaId", foreign: "id" },
  },
  Incasso: {
    user: { model: "User", local: "userId", foreign: "id" },
    pratica: { model: "Pratica", local: "praticaId", foreign: "id" },
    provvigione: { model: "Provvigione", local: "id", foreign: "incassoId" },
  },
  Provvigione: {
    operatore: { model: "User", local: "operatoreId", foreign: "id" },
    pratica: { model: "Pratica", local: "praticaId", foreign: "id" },
    incasso: { model: "Incasso", local: "incassoId", foreign: "id" },
  },
  Postazione: {
    sedeRef: { model: "Sede", local: "sedeId", foreign: "id" },
    occupanti: { model: "User", local: "id", foreign: "postazioneId", many: true },
  },
  MessaggioInterno: {
    fromUser: { model: "User", local: "fromUserId", foreign: "id" },
    toUser: { model: "User", local: "toUserId", foreign: "id" },
    pratica: { model: "Pratica", local: "praticaId", foreign: "id" },
  },
  MessaggioAgenda: {
    user: { model: "User", local: "userId", foreign: "id" },
    pratica: { model: "Pratica", local: "praticaId", foreign: "id" },
  },
  ImpegnoAgenda: {
    user: { model: "User", local: "userId", foreign: "id" },
  },
  PraticaLock: {
    user: { model: "User", local: "userId", foreign: "id" },
  },
  RegistrazioneChiamata: {
    operatore: { model: "User", local: "operatoreId", foreign: "id" },
    pratica: { model: "Pratica", local: "praticaId", foreign: "id" },
  },
  AuditLog: {
    user: { model: "User", local: "userId", foreign: "id" },
  },
  Mandante: {
    pratiche: { model: "Pratica", local: "id", foreign: "mandanteId", many: true },
  },
  Sede: {
    postazioni: { model: "Postazione", local: "id", foreign: "sedeId", many: true },
    users: { model: "User", local: "id", foreign: "sedeId", many: true },
  },
  Tenant: {},
};

export function collectionForOpsModel(model: string) {
  return OPS_MODEL_COLLECTION[model] ?? null;
}
