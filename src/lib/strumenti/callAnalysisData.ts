import { practiceStateLabel } from "@/lib/strumenti/callAnalysisConfig";

export type CallAnalysisFormState = {
  creditType: string;
  creditor: string;
  debtorAge: number;
  employmentStatus: string;
  guarantorSituation: string;
  practiceStateKey: string;
  consultantNotes: string;
  monitoraggio: {
    unpaidInstallments?: number;
    installmentAmount?: string;
    paidInstallments?: string;
    totalInstallments?: string;
    remainingDebt?: string;
    lastPaymentDate?: string;
    insolvencyHistory?: string;
    defaultManagement?: string;
  };
  recupero: {
    assignmentNumber?: string;
    remainingDebt?: string;
    lastPaymentDate?: string;
    recoveredAmount?: string;
    recoveryHistory?: string;
  };
  piano: {
    agreementAmount?: string;
    plannedInstallments?: string;
    paidInstallments?: string;
    unpaidInstallments?: string;
    paymentMethod?: string;
  };
  saldo: {
    originalAmount?: string;
    agreedAmount?: string;
    paidAmount?: string;
    remainingAmount?: string;
    paymentMethod?: string;
  };
};

function line(label: string, value?: string | number | null) {
  const v = value == null ? "" : String(value).trim();
  if (!v) return [];
  return [`- ${label}: ${v}`];
}

export function callAnalysisToJson(form: CallAnalysisFormState) {
  return {
    creditType: form.creditType,
    creditor: form.creditor,
    debtorAge: form.debtorAge,
    employmentStatus: form.employmentStatus,
    guarantorSituation: form.guarantorSituation,
    practiceStateKey: form.practiceStateKey,
    practiceStateLabel: practiceStateLabel(form.practiceStateKey),
    monitoraggio: form.monitoraggio,
    recupero: form.recupero,
    piano: form.piano,
    saldo: form.saldo,
    consultantNotes: form.consultantNotes.trim() || undefined,
  };
}

export function callAnalysisToText(form: CallAnalysisFormState) {
  const lines = [
    "ANALISI STRATEGICA PRE-CONTATTO",
    "",
    "SEZIONE FISSA",
    ...line("Tipologia credito", form.creditType),
    ...line("Creditore", form.creditor),
    ...line("Età debitore", form.debtorAge),
    ...line("Situazione lavorativa", form.employmentStatus),
    ...line("Garante", form.guarantorSituation),
    "",
    "STATO DELLA PRATICA",
    ...line("Stato", practiceStateLabel(form.practiceStateKey)),
  ];

  if (form.practiceStateKey === "monitoraggio_originator") {
    const m = form.monitoraggio;
    lines.push(
      ...line("Numero rate insolute", m.unpaidInstallments),
      ...line("Importo rata", m.installmentAmount),
      ...line("Rate pagate", m.paidInstallments),
      ...line("Rate totali", m.totalInstallments),
      ...line("Debito residuo", m.remainingDebt),
      ...line("Ultimo pagamento", m.lastPaymentDate),
      ...line("Storico insolvenza", m.insolvencyHistory),
      ...line("Gestione morosità", m.defaultManagement)
    );
  }

  if (form.practiceStateKey === "recupero_ceduto") {
    const r = form.recupero;
    lines.push(
      ...line("Numero cessione", r.assignmentNumber),
      ...line("Debito residuo", r.remainingDebt),
      ...line("Ultimo pagamento", r.lastPaymentDate),
      ...line("Importo già recuperato", r.recoveredAmount),
      ...line("Storico recupero", r.recoveryHistory)
    );
  }

  if (form.practiceStateKey === "piano_rientro") {
    const p = form.piano;
    lines.push(
      ...line("Importo accordo", p.agreementAmount),
      ...line("Rate previste", p.plannedInstallments),
      ...line("Rate pagate", p.paidInstallments),
      ...line("Rate insolute", p.unpaidInstallments),
      ...line("Modalità pagamento", p.paymentMethod)
    );
  }

  if (form.practiceStateKey === "saldo_stralcio") {
    const s = form.saldo;
    lines.push(
      ...line("Importo originario", s.originalAmount),
      ...line("Importo concordato", s.agreedAmount),
      ...line("Importo pagato", s.paidAmount),
      ...line("Importo residuo", s.remainingAmount),
      ...line("Modalità pagamento", s.paymentMethod)
    );
  }

  if (form.consultantNotes.trim()) {
    lines.push("", "NOTE CONSULENTE", form.consultantNotes.trim());
  }

  return lines.join("\n").trim();
}
