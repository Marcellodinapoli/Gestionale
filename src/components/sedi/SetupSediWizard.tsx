"use client";

import { useMemo, useState, useTransition } from "react";
import { MapPin, Building2 } from "lucide-react";
import { completaSetupSediAction } from "@/actions/sedi";

const MAX_SEDI = 15;

type SedeDraft = {
  nome: string;
  indirizzo: string;
  citta: string;
  cap: string;
  provincia: string;
  telefono: string;
  email: string;
  note: string;
};

function emptySede(i: number): SedeDraft {
  return {
    nome: i === 0 ? "Sede principale" : `Sede ${i + 1}`,
    indirizzo: "",
    citta: "",
    cap: "",
    provincia: "",
    telefono: "",
    email: "",
    note: "",
  };
}

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm text-[var(--navy)]";
const labelCls = "text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]";

export function SetupSediWizard({ tenantNome }: { tenantNome: string }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [quante, setQuante] = useState(1);
  const [sedi, setSedi] = useState<SedeDraft[]>([emptySede(0)]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const titoli = useMemo(
    () =>
      step === 1
        ? {
            title: "Quante sedi gestisci?",
            sub: `Configura le sedi di ${tenantNome}. Potrai modificarle in seguito da Gestione → Sedi.`,
          }
        : {
            title: "Dati delle sedi",
            sub: "Compila i dati di ogni sede. Il nome è obbligatorio.",
          },
    [step, tenantNome]
  );

  function vaiAiDati() {
    setError(null);
    const n = Math.min(MAX_SEDI, Math.max(1, Math.floor(quante) || 1));
    setQuante(n);
    setSedi((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(emptySede(next.length));
      return next.slice(0, n);
    });
    setStep(2);
  }

  function updateSede(i: number, patch: Partial<SedeDraft>) {
    setSedi((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function onSubmit() {
    setError(null);
    for (let i = 0; i < sedi.length; i++) {
      if (!sedi[i].nome.trim()) {
        setError(`Indica il nome della sede ${i + 1}`);
        return;
      }
    }
    const nomi = sedi.map((s) => s.nome.trim().toLowerCase());
    if (new Set(nomi).size !== nomi.length) {
      setError("I nomi delle sedi devono essere univoci");
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("count", String(sedi.length));
      sedi.forEach((s, i) => {
        fd.set(`sede_${i}_nome`, s.nome.trim());
        fd.set(`sede_${i}_indirizzo`, s.indirizzo.trim());
        fd.set(`sede_${i}_citta`, s.citta.trim());
        fd.set(`sede_${i}_cap`, s.cap.trim());
        fd.set(`sede_${i}_provincia`, s.provincia.trim());
        fd.set(`sede_${i}_telefono`, s.telefono.trim());
        fd.set(`sede_${i}_email`, s.email.trim());
        fd.set(`sede_${i}_note`, s.note.trim());
      });
      try {
        await completaSetupSediAction(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore salvataggio sedi");
      }
    });
  }

  return (
    <div className="w-full max-w-3xl rounded-2xl border border-[var(--line)] bg-white p-6 shadow-xl sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
        Primo accesso
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-[var(--navy)]">{titoli.title}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">{titoli.sub}</p>

      {step === 1 ? (
        <div className="mt-8 space-y-6">
          <label className="block">
            <span className={labelCls}>Numero sedi</span>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--line)] text-lg font-bold text-[var(--navy)] hover:bg-slate-50"
                onClick={() => setQuante((q) => Math.max(1, q - 1))}
                aria-label="Diminuisci"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={MAX_SEDI}
                value={quante}
                onChange={(e) =>
                  setQuante(Math.min(MAX_SEDI, Math.max(1, Number(e.target.value) || 1)))
                }
                className="h-12 w-24 rounded-lg border border-[var(--line)] text-center text-xl font-semibold text-[var(--navy)]"
              />
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--line)] text-lg font-bold text-[var(--navy)] hover:bg-slate-50"
                onClick={() => setQuante((q) => Math.min(MAX_SEDI, q + 1))}
                aria-label="Aumenta"
              >
                +
              </button>
              <span className="text-sm text-[var(--muted)]">da 1 a {MAX_SEDI}</span>
            </div>
          </label>
          <button
            type="button"
            onClick={vaiAiDati}
            className="h-11 w-full rounded-lg bg-[var(--navy)] text-sm font-semibold text-white hover:opacity-90"
          >
            Continua
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {sedi.map((s, i) => (
              <section
                key={i}
                className="rounded-xl border border-[var(--line)] bg-[#f7f9fc] p-4"
              >
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">
                  <Building2 className="h-4 w-4" />
                  Sede {i + 1}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className={labelCls}>Nome sede *</span>
                    <input
                      className={inputCls}
                      value={s.nome}
                      onChange={(e) => updateSede(i, { nome: e.target.value })}
                      required
                      placeholder="es. Roma, Milano…"
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className={labelCls}>Indirizzo</span>
                    <input
                      className={inputCls}
                      value={s.indirizzo}
                      onChange={(e) => updateSede(i, { indirizzo: e.target.value })}
                      placeholder="Via / Piazza"
                    />
                  </label>
                  <label>
                    <span className={labelCls}>Città</span>
                    <input
                      className={inputCls}
                      value={s.citta}
                      onChange={(e) => updateSede(i, { citta: e.target.value })}
                    />
                  </label>
                  <label>
                    <span className={labelCls}>CAP</span>
                    <input
                      className={inputCls}
                      value={s.cap}
                      onChange={(e) => updateSede(i, { cap: e.target.value })}
                      maxLength={10}
                    />
                  </label>
                  <label>
                    <span className={labelCls}>Provincia</span>
                    <input
                      className={inputCls}
                      value={s.provincia}
                      onChange={(e) => updateSede(i, { provincia: e.target.value })}
                      maxLength={4}
                      placeholder="RM"
                    />
                  </label>
                  <label>
                    <span className={labelCls}>Telefono</span>
                    <input
                      className={inputCls}
                      value={s.telefono}
                      onChange={(e) => updateSede(i, { telefono: e.target.value })}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className={labelCls}>Email</span>
                    <input
                      type="email"
                      className={inputCls}
                      value={s.email}
                      onChange={(e) => updateSede(i, { email: e.target.value })}
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className={labelCls}>Note</span>
                    <textarea
                      className="mt-1 min-h-[64px] w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                      value={s.note}
                      onChange={(e) => updateSede(i, { note: e.target.value })}
                      placeholder="Orari, riferimenti, indicazioni…"
                    />
                  </label>
                </div>
              </section>
            ))}
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={pending}
              className="h-11 flex-1 rounded-lg border border-[var(--line)] bg-white text-sm font-semibold text-[var(--navy)] hover:bg-slate-50 disabled:opacity-60"
            >
              Indietro
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={pending}
              className="inline-flex h-11 flex-[2] items-center justify-center gap-2 rounded-lg bg-[var(--navy)] text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              <MapPin className="h-4 w-4" />
              {pending ? "Salvataggio…" : `Salva ${sedi.length} sed${sedi.length === 1 ? "e" : "i"}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
