"use client";

import { useMemo, useState } from "react";

export type MandanteImportOption = {
  id: string;
  codice: string;
  ragioneSociale: string;
  perimetri: Array<{ id: string; nome: string }>;
};

function todayInputValue() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ImportForm({
  action,
  buttonLabel = "Importa",
  mandanti,
}: {
  action: (formData: FormData) => Promise<{ error?: string; ok?: string } | void>;
  buttonLabel?: string;
  mandanti: MandanteImportOption[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [mandanteId, setMandanteId] = useState("");
  const [perimetro, setPerimetro] = useState("");
  const [lotto, setLotto] = useState("");
  const [affidoIl, setAffidoIl] = useState(todayInputValue);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const mandante = useMemo(
    () => mandanti.find((m) => m.id === mandanteId) ?? null,
    [mandanti, mandanteId]
  );
  const perimetri = mandante?.perimetri ?? [];

  async function onSubmit(formData: FormData) {
    setMessage(null);
    setPending(true);
    try {
      const result = await action(formData);
      if (result?.error) setMessage(result.error);
      if (result?.ok) setMessage(result.ok);
    } finally {
      setPending(false);
    }
  }

  const fieldCls =
    "h-9 w-full rounded-lg border border-[var(--line)] bg-white px-2 text-sm";

  return (
    <form action={onSubmit} className="space-y-3 text-sm">
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-[var(--muted)]">Mandante</span>
        <select
          name="mandanteId"
          required
          value={mandanteId}
          onChange={(e) => {
            setMandanteId(e.target.value);
            setPerimetro("");
          }}
          className={fieldCls}
        >
          <option value="">Seleziona mandante…</option>
          {mandanti.map((m) => (
            <option key={m.id} value={m.id}>
              {m.codice} — {m.ragioneSociale}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold text-[var(--muted)]">Perimetro</span>
        {perimetri.length > 0 ? (
          <select
            name="perimetro"
            required
            value={perimetro}
            disabled={!mandanteId}
            onChange={(e) => {
              const nome = e.target.value;
              setPerimetro(nome);
              if (!lotto.trim()) setLotto(nome);
            }}
            className={fieldCls}
          >
            <option value="">Seleziona perimetro…</option>
            {perimetri.map((p) => (
              <option key={p.id} value={p.nome}>
                {p.nome}
              </option>
            ))}
          </select>
        ) : (
          <input
            name="perimetro"
            required
            value={perimetro}
            disabled={!mandanteId}
            onChange={(e) => {
              const nome = e.target.value;
              setPerimetro(nome);
              if (!lotto.trim()) setLotto(nome);
            }}
            placeholder={
              mandanteId
                ? "Nome perimetro / commessa"
                : "Prima seleziona la mandante"
            }
            className={fieldCls}
          />
        )}
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold text-[var(--muted)]">Lotto</span>
        <input
          name="lotto"
          required
          value={lotto}
          onChange={(e) => setLotto(e.target.value)}
          placeholder="Codice lotto"
          className={fieldCls}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold text-[var(--muted)]">Affido il</span>
        <input
          type="date"
          name="affidoIl"
          required
          value={affidoIl}
          onChange={(e) => setAffidoIl(e.target.value)}
          className={fieldCls}
        />
      </label>

      <div className="space-y-1">
        <span className="text-xs font-semibold text-[var(--muted)]">File CSV</span>
        <label
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-5 text-center transition hover:border-[var(--navy)] hover:bg-[#f0f4f8] ${
            fileName
              ? "border-[var(--navy)] bg-[#f0f4f8]"
              : "border-[var(--line)] bg-white"
          }`}
        >
          <span className="rounded-md bg-[var(--navy)] px-3 py-1.5 text-xs font-semibold text-white">
            Scegli file…
          </span>
          <span className="text-xs text-[var(--muted)]">
            {fileName
              ? fileName
              : "Clicca qui per selezionare il file CSV da importare"}
          </span>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setFileName(f?.name ?? null);
            }}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-lg bg-[var(--navy)] px-4 text-white disabled:opacity-60"
      >
        {pending ? "Import in corso…" : buttonLabel}
      </button>
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}
