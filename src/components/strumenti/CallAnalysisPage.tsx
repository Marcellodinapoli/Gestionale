"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Brain, Calculator, Loader2, Sparkles } from "lucide-react";
import { CalcolatricePopup } from "@/components/pratica/CalcolatricePopup";
import { useFormazione } from "@/components/formazione/FormazioneProvider";
import {
  StrumentiCardHeader,
  StrumentiPanelCard,
} from "@/components/strumenti/StrumentiCardLayout";
import { callFormazioneFunction } from "@/lib/formazione/callable";
import {
  ASSIGNMENT_OPTIONS,
  CREDIT_TYPES,
  DEFAULT_MGMT_OPTIONS,
  EMPLOYMENT_STATUSES,
  GUARANTOR_OPTIONS,
  INSOLVENCY_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PRACTICE_STATES,
  RECOVERY_HISTORY_OPTIONS,
  UNPAID_INSTALLMENTS,
} from "@/lib/strumenti/callAnalysisConfig";
import {
  callAnalysisToJson,
  callAnalysisToText,
  type CallAnalysisFormState,
} from "@/lib/strumenti/callAnalysisData";
import { loadCallAnalysisPrompt } from "@/lib/strumenti/settingsPrompts";

const inputCls =
  "mt-1 h-10 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm shadow-sm focus:border-[var(--navy)] focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/15";
const labelCls = "text-sm font-medium text-[var(--navy)]";

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="mt-5 mb-3 border-b border-[var(--line)] pb-2 first:mt-0">
      <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--navy)]">{children}</h3>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelCls}>
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function emptyForm(): CallAnalysisFormState {
  return {
    creditType: CREDIT_TYPES[0],
    creditor: "",
    debtorAge: 40,
    employmentStatus: EMPLOYMENT_STATUSES[0],
    guarantorSituation: GUARANTOR_OPTIONS[0],
    practiceStateKey: "",
    consultantNotes: "",
    monitoraggio: {},
    recupero: {},
    piano: {},
    saldo: {},
  };
}

export function CallAnalysisPage() {
  const { db, functions } = useFormazione();
  const [form, setForm] = useState<CallAnalysisFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);

  // Precarica il prompt in cache senza bloccare la UI
  useEffect(() => {
    if (!db) return;
    void loadCallAnalysisPrompt(db);
  }, [db]);

  function patch(partial: Partial<CallAnalysisFormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!functions || !db) return;

    if (!form.creditor.trim()) {
      setError("Inserisci il creditore.");
      return;
    }
    if (!form.practiceStateKey) {
      setError("Seleziona lo stato della pratica.");
      return;
    }
    if (form.debtorAge < 18 || form.debtorAge > 110) {
      setError("Età debitore non valida.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const prompt = await loadCallAnalysisPrompt(db);
      const practiceData = callAnalysisToJson(form);
      const practiceText = callAnalysisToText(form);
      const data = await callFormazioneFunction<{ analysis?: string }>(
        functions,
        "callAnalysis",
        { prompt, practiceData, practiceText }
      );
      setResult(String(data.analysis ?? "").trim() || null);
    } catch {
      setError("Impossibile ottenere l'analisi. Riprova tra poco.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-md">
        <StrumentiCardHeader title="Analisi strategica pre-contatto" icon={Sparkles}>
          <p className="text-sm leading-relaxed text-black/75">
            Compila solo dati oggettivi in meno di un minuto. L&apos;AI analizza la pratica e
            suggerisce la strategia telefonica.
          </p>
          <p className="rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-[13px] leading-snug text-amber-900">
            Le risposte hanno scopo operativo e non sostituiscono il giudizio del consulente.
          </p>
        </StrumentiCardHeader>

        <form onSubmit={(e) => void submit(e)} className="bg-[#f8fafc] px-4 py-4 sm:px-6 sm:py-5">
        <SectionTitle>Dati pratica</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipologia credito" required>
            <select
              value={form.creditType}
              onChange={(e) => patch({ creditType: e.target.value })}
              className={inputCls}
            >
              {CREDIT_TYPES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Creditore" required>
            <input
              value={form.creditor}
              onChange={(e) => patch({ creditor: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Età debitore" required>
            <input
              type="number"
              min={18}
              max={110}
              value={form.debtorAge}
              onChange={(e) => patch({ debtorAge: Number(e.target.value) || 0 })}
              className={inputCls}
            />
          </Field>
          <Field label="Situazione lavorativa" required>
            <select
              value={form.employmentStatus}
              onChange={(e) => patch({ employmentStatus: e.target.value })}
              className={inputCls}
            >
              {EMPLOYMENT_STATUSES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Garante" required>
            <select
              value={form.guarantorSituation}
              onChange={(e) => patch({ guarantorSituation: e.target.value })}
              className={inputCls}
            >
              {GUARANTOR_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stato della pratica" required>
            <select
              value={form.practiceStateKey}
              onChange={(e) => patch({ practiceStateKey: e.target.value })}
              className={inputCls}
            >
              <option value="">Seleziona…</option>
              {PRACTICE_STATES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {form.practiceStateKey === "monitoraggio_originator" ? (
          <>
            <SectionTitle>Monitoraggio Originator</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Numero rate insolute">
                <select
                  value={form.monitoraggio.unpaidInstallments ?? ""}
                  onChange={(e) =>
                    patch({
                      monitoraggio: {
                        ...form.monitoraggio,
                        unpaidInstallments: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      },
                    })
                  }
                  className={inputCls}
                >
                  <option value="">—</option>
                  {UNPAID_INSTALLMENTS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Importo rata">
                <input
                  value={form.monitoraggio.installmentAmount ?? ""}
                  onChange={(e) =>
                    patch({
                      monitoraggio: { ...form.monitoraggio, installmentAmount: e.target.value },
                    })
                  }
                  placeholder="Es. 150,00 €"
                  className={inputCls}
                />
              </Field>
              <Field label="Rate pagate">
                <input
                  value={form.monitoraggio.paidInstallments ?? ""}
                  onChange={(e) =>
                    patch({
                      monitoraggio: { ...form.monitoraggio, paidInstallments: e.target.value },
                    })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Rate totali">
                <input
                  value={form.monitoraggio.totalInstallments ?? ""}
                  onChange={(e) =>
                    patch({
                      monitoraggio: { ...form.monitoraggio, totalInstallments: e.target.value },
                    })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Debito residuo">
                <input
                  value={form.monitoraggio.remainingDebt ?? ""}
                  onChange={(e) =>
                    patch({
                      monitoraggio: { ...form.monitoraggio, remainingDebt: e.target.value },
                    })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Ultimo pagamento">
                <input
                  type="date"
                  value={form.monitoraggio.lastPaymentDate ?? ""}
                  onChange={(e) =>
                    patch({
                      monitoraggio: { ...form.monitoraggio, lastPaymentDate: e.target.value },
                    })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Storico insolvenza">
                <select
                  value={form.monitoraggio.insolvencyHistory ?? ""}
                  onChange={(e) =>
                    patch({
                      monitoraggio: {
                        ...form.monitoraggio,
                        insolvencyHistory: e.target.value || undefined,
                      },
                    })
                  }
                  className={inputCls}
                >
                  <option value="">—</option>
                  {INSOLVENCY_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Gestione morosità">
                <select
                  value={form.monitoraggio.defaultManagement ?? ""}
                  onChange={(e) =>
                    patch({
                      monitoraggio: {
                        ...form.monitoraggio,
                        defaultManagement: e.target.value || undefined,
                      },
                    })
                  }
                  className={inputCls}
                >
                  <option value="">—</option>
                  {DEFAULT_MGMT_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        ) : null}

        {form.practiceStateKey === "recupero_ceduto" ? (
          <>
            <SectionTitle>Recupero credito ceduto</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Numero cessione">
                <select
                  value={form.recupero.assignmentNumber ?? ""}
                  onChange={(e) =>
                    patch({
                      recupero: {
                        ...form.recupero,
                        assignmentNumber: e.target.value || undefined,
                      },
                    })
                  }
                  className={inputCls}
                >
                  <option value="">—</option>
                  {ASSIGNMENT_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Debito residuo">
                <input
                  value={form.recupero.remainingDebt ?? ""}
                  onChange={(e) =>
                    patch({
                      recupero: { ...form.recupero, remainingDebt: e.target.value },
                    })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Ultimo pagamento">
                <input
                  type="date"
                  value={form.recupero.lastPaymentDate ?? ""}
                  onChange={(e) =>
                    patch({
                      recupero: { ...form.recupero, lastPaymentDate: e.target.value },
                    })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Importo già recuperato">
                <input
                  value={form.recupero.recoveredAmount ?? ""}
                  onChange={(e) =>
                    patch({
                      recupero: { ...form.recupero, recoveredAmount: e.target.value },
                    })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Storico recupero">
                <select
                  value={form.recupero.recoveryHistory ?? ""}
                  onChange={(e) =>
                    patch({
                      recupero: {
                        ...form.recupero,
                        recoveryHistory: e.target.value || undefined,
                      },
                    })
                  }
                  className={inputCls}
                >
                  <option value="">—</option>
                  {RECOVERY_HISTORY_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        ) : null}

        {form.practiceStateKey === "piano_rientro" ? (
          <>
            <SectionTitle>Piano di rientro</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Importo accordo">
                <input
                  value={form.piano.agreementAmount ?? ""}
                  onChange={(e) =>
                    patch({ piano: { ...form.piano, agreementAmount: e.target.value } })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Rate previste">
                <input
                  value={form.piano.plannedInstallments ?? ""}
                  onChange={(e) =>
                    patch({ piano: { ...form.piano, plannedInstallments: e.target.value } })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Rate pagate">
                <input
                  value={form.piano.paidInstallments ?? ""}
                  onChange={(e) =>
                    patch({ piano: { ...form.piano, paidInstallments: e.target.value } })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Rate insolute">
                <input
                  value={form.piano.unpaidInstallments ?? ""}
                  onChange={(e) =>
                    patch({ piano: { ...form.piano, unpaidInstallments: e.target.value } })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Modalità pagamento">
                <select
                  value={form.piano.paymentMethod ?? ""}
                  onChange={(e) =>
                    patch({
                      piano: { ...form.piano, paymentMethod: e.target.value || undefined },
                    })
                  }
                  className={inputCls}
                >
                  <option value="">—</option>
                  {PAYMENT_METHOD_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        ) : null}

        {form.practiceStateKey === "saldo_stralcio" ? (
          <>
            <SectionTitle>Saldo e stralcio</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Importo originario">
                <input
                  value={form.saldo.originalAmount ?? ""}
                  onChange={(e) =>
                    patch({ saldo: { ...form.saldo, originalAmount: e.target.value } })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Importo concordato">
                <input
                  value={form.saldo.agreedAmount ?? ""}
                  onChange={(e) =>
                    patch({ saldo: { ...form.saldo, agreedAmount: e.target.value } })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Importo pagato">
                <input
                  value={form.saldo.paidAmount ?? ""}
                  onChange={(e) =>
                    patch({ saldo: { ...form.saldo, paidAmount: e.target.value } })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Importo residuo">
                <input
                  value={form.saldo.remainingAmount ?? ""}
                  onChange={(e) =>
                    patch({ saldo: { ...form.saldo, remainingAmount: e.target.value } })
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Modalità pagamento">
                <select
                  value={form.saldo.paymentMethod ?? ""}
                  onChange={(e) =>
                    patch({
                      saldo: { ...form.saldo, paymentMethod: e.target.value || undefined },
                    })
                  }
                  className={inputCls}
                >
                  <option value="">—</option>
                  {PAYMENT_METHOD_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        ) : null}

        <SectionTitle>Note</SectionTitle>
        <Field label="Note del consulente">
          <textarea
            rows={4}
            value={form.consultantNotes}
            onChange={(e) => patch({ consultantNotes: e.target.value })}
            placeholder="Informazioni raccolte, comportamento, criticità, famiglia, disponibilità economica…"
            className={`${inputCls} min-h-[96px] py-2`}
          />
        </Field>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 overflow-hidden rounded-xl border-2 border-[var(--navy)]/15 bg-[#eef4f8]">
          <div className="border-b border-[var(--line)] bg-[#e8eef4] px-4 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--navy)]">
              Avvia analisi
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 py-4">
            <button
              type="button"
              onClick={() => setCalcOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-[var(--navy)] shadow-sm hover:bg-[#fafbfc]"
              title="Calcolatrice"
            >
              <Calculator className="h-5 w-5" />
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--navy-2)] disabled:opacity-60 sm:flex-none sm:px-6"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analisi in corso…
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  Analizza con AI
                </>
              )}
            </button>
          </div>
        </div>

        {result ? (
          <StrumentiPanelCard title="Analisi AI" className="mt-6">
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-black/87">{result}</div>
          </StrumentiPanelCard>
        ) : null}
        </form>
      </div>

      {calcOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCalcOpen(false)}
        >
          <div
            className="rounded-xl border border-[var(--line)] bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CalcolatricePopup />
          </div>
        </div>
      ) : null}
    </>
  );
}
