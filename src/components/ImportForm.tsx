"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { PerimetroListItem } from "@/lib/mandantePerimetri";
import { importIncassiCsvAction } from "@/actions/core";
import { importPraticheCsvChunked } from "@/lib/importPraticheClient";

export type MandanteImportOption = {
  id: string;
  codice: string;
  ragioneSociale: string;
  perimetri: PerimetroListItem[];
};

export type LottoEsistenteOption = {
  id: string;
  mandanteId: string;
  perimetro: string;
  lotto: string;
  affidoIl: string;
  scadenzaMandato?: string | null;
  nPratiche: number;
};

function todayInputValue() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type ImportPraticheSummary = {
  isIntegrazione: boolean;
  lotto: string;
  mandanteCodice: string;
  perimetro: string;
  created: number;
  updated: number;
  skipped: number;
  totale?: number;
};

function formatImportPraticheFeedback(summary: ImportPraticheSummary) {
  const righe: string[] = [];
  if (summary.isIntegrazione) {
    if (summary.created > 0) {
      righe.push(`${summary.created} pratiche nuove aggiunte`);
    }
    if (summary.updated > 0) {
      righe.push(`${summary.updated} righe CSV aggiornate su pratiche esistenti`);
    }
    if (summary.totale != null) {
      righe.push(`${summary.totale} pratiche totali nel lotto`);
    }
  } else {
    righe.push(`${summary.created} pratiche importate`);
    if (summary.totale != null) {
      righe.push(`${summary.totale} pratiche totali nel lotto`);
    }
  }
  if (summary.skipped > 0) {
    righe.push(`${summary.skipped} righe saltate (nome mancante o riga vuota)`);
  }
  return righe;
}

export function ImportForm({
  kind,
  buttonLabel = "Importa",
  mandanti,
  lottiEsistenti = [],
  prefill = null,
  onClose,
}: {
  kind: "pratiche" | "incassi";
  buttonLabel?: string;
  mandanti: MandanteImportOption[];
  /** Solo pratiche: lotti già importati (per integrazione). */
  lottiEsistenti?: LottoEsistenteOption[];
  prefill?: {
    mandanteId: string;
    perimetro: string;
    lotto: string;
    affidoIl: string;
    scadenzaMandato?: string | null;
  } | null;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"ok" | "error" | null>(null);
  const [importSummary, setImportSummary] = useState<ImportPraticheSummary | null>(null);
  const [mandanteId, setMandanteId] = useState(prefill?.mandanteId ?? "");
  const [perimetro, setPerimetro] = useState(prefill?.perimetro ?? "");
  const [lotto, setLotto] = useState(prefill?.lotto ?? "");
  const [affidoIl, setAffidoIl] = useState(
    prefill?.affidoIl ?? todayInputValue()
  );
  const [scadenzaMandato, setScadenzaMandato] = useState(
    prefill?.scadenzaMandato ?? ""
  );
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressDetail, setProgressDetail] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const formTopRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!prefill) return;
    setMandanteId(prefill.mandanteId);
    setPerimetro(prefill.perimetro);
    setLotto(prefill.lotto);
    setAffidoIl(prefill.affidoIl);
    setScadenzaMandato(prefill.scadenzaMandato ?? "");
    setMessage(null);
    setMessageKind(null);
    setImportSummary(null);
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [
    prefill?.mandanteId,
    prefill?.perimetro,
    prefill?.lotto,
    prefill?.affidoIl,
    prefill?.scadenzaMandato,
  ]);

  const mandante = useMemo(
    () => mandanti.find((m) => m.id === mandanteId) ?? null,
    [mandanti, mandanteId]
  );
  const perimetri = mandante?.perimetri ?? [];
  const perimetroSelezionato = useMemo(
    () =>
      perimetri.find(
        (p) =>
          p.nomeMandante === perimetro ||
          p.descrizione === perimetro ||
          p.nomeInterno === perimetro
      ) ?? null,
    [perimetri, perimetro]
  );

  const lottoMatch = useMemo(() => {
    if (kind !== "pratiche" || !mandanteId || !perimetro || !lotto) return null;
    return (
      lottiEsistenti.find(
        (b) =>
          b.mandanteId === mandanteId &&
          b.perimetro === perimetro &&
          b.lotto === lotto
      ) ?? null
    );
  }, [kind, mandanteId, perimetro, lotto, lottiEsistenti]);

  useEffect(() => {
    if (!pending || kind === "pratiche") return;
    setProgress(4);
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        const step = p < 40 ? 6 : p < 70 ? 3 : 1.2;
        return Math.min(90, Math.round((p + step) * 10) / 10);
      });
    }, 280);
    return () => window.clearInterval(id);
  }, [pending, kind]);

  function clearFile() {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setMessageKind(null);
    setImportSummary(null);

    if (!file) {
      setMessage("Seleziona un file CSV da importare");
      fileRef.current?.focus();
      return;
    }

    setPending(true);
    setProgress(2);
    setProgressDetail("");
    try {
      if (kind === "pratiche") {
        const csvText = await file.text();
        const result = await importPraticheCsvChunked({
          mandanteId,
          perimetro,
          lotto,
          affidoIl,
          scadenzaMandato,
          fileName: file.name,
          csvText,
          onProgress: (pct, detail) => {
            setProgress(pct);
            setProgressDetail(detail);
          },
        });
        setProgress(100);
        if ("error" in result) {
          setMessageKind("error");
          setMessage(result.error);
          setImportSummary(null);
        } else {
          setMessageKind("ok");
          setMessage(result.ok);
          setImportSummary(result.importSummary);
          clearFile();
          router.replace("/import", { scroll: false });
          router.refresh();
        }
      } else {
        const fd = new FormData(e.currentTarget);
        fd.set("file", file);
        const result = await importIncassiCsvAction(fd);
        setProgress(100);
        if (result?.error) {
          setMessageKind("error");
          setMessage(result.error);
          setImportSummary(null);
        }
        if (result?.ok) {
          setMessageKind("ok");
          setMessage(result.ok);
          setImportSummary(null);
          clearFile();
          router.refresh();
        }
      }
      await new Promise((r) => setTimeout(r, 350));
    } catch {
      setMessageKind("error");
      setImportSummary(null);
      setMessage(
        "Errore imprevisto durante l'import. Riprova; se il problema persiste contatta l'assistenza."
      );
    } finally {
      setPending(false);
      setProgress(0);
      setProgressDetail("");
    }
  }

  function onAnnulla() {
    if (pending) return;
    setMessage(null);
    setMessageKind(null);
    setImportSummary(null);
    setMandanteId("");
    setPerimetro("");
    setLotto("");
    setAffidoIl(todayInputValue());
    setScadenzaMandato("");
    clearFile();
    setProgress(0);
    setProgressDetail("");
    if (kind === "pratiche" && prefill) {
      router.replace("/import", { scroll: false });
    }
    onClose?.();
  }

  const fieldCls =
    "h-9 w-full rounded-lg border border-[var(--line)] bg-white px-2 text-sm";

  const submitLabel = pending
    ? "Import in corso…"
    : lottoMatch
      ? `Integra / aggiorna lotto (${lottoMatch.nPratiche} già presenti)`
      : buttonLabel;

  return (
    <form
      ref={formTopRef}
      id={kind === "pratiche" ? "import-pratiche" : undefined}
      onSubmit={onSubmit}
      className="space-y-3 text-sm"
    >
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-[var(--muted)]">Mandante</span>
        <select
          name="mandanteId"
          required
          value={mandanteId}
          disabled={pending}
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

      <div className="space-y-2">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[var(--muted)]">Perimetro</span>
          {perimetri.length > 0 ? (
            <select
              name="perimetro"
              required
              value={perimetro}
              disabled={!mandanteId || pending}
              onChange={(e) => {
                setPerimetro(e.target.value);
              }}
              className={fieldCls}
            >
              <option value="">Seleziona perimetro…</option>
              {perimetri.map((p) => (
                <option key={p.id} value={p.nomeMandante}>
                  {p.nomeInterno
                    ? `${p.nomeInterno} — ${p.descrizione || p.nomeMandante}`
                    : p.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              name="perimetro"
              required
              value={perimetro}
              disabled={!mandanteId || pending}
              onChange={(e) => {
                setPerimetro(e.target.value);
              }}
              placeholder={
                mandanteId
                  ? "Descrizione perimetro / commessa"
                  : "Prima seleziona la mandante"
              }
              className={fieldCls}
            />
          )}
        </label>
        {mandanteId && perimetri.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--line)] bg-[#f5f7fa] px-2.5 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Acronimo perimetro
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-[var(--navy)]">
                {perimetroSelezionato?.nomeInterno || "—"}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[#f5f7fa] px-2.5 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Descrizione perimetro
              </p>
              <p className="mt-0.5 text-sm text-[var(--navy)]">
                {perimetroSelezionato?.descrizione ||
                  perimetroSelezionato?.nomeMandante ||
                  "—"}
              </p>
            </div>
          </div>
        ) : null}
        {mandanteId && perimetri.length === 0 ? (
          <p className="text-[11px] text-amber-800">
            Nessun perimetro in anagrafica mandante: indica la descrizione qui sopra,
            oppure configura acronimo e descrizione in Mandanti.
          </p>
        ) : null}
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-semibold text-[var(--muted)]">Lotto</span>
        <input
          name="lotto"
          required
          inputMode="numeric"
          pattern="[0-9]+"
          value={lotto}
          disabled={pending}
          onChange={(e) => setLotto(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="es. 112608"
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
          disabled={pending}
          onChange={(e) => setAffidoIl(e.target.value)}
          className={fieldCls}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-semibold text-[var(--muted)]">Scadenza</span>
        <input
          type="date"
          name="scadenzaMandato"
          required={kind === "pratiche"}
          value={scadenzaMandato}
          disabled={pending}
          onChange={(e) => setScadenzaMandato(e.target.value)}
          className={fieldCls}
        />
      </label>

      {kind === "pratiche" ? (
        <div className="rounded-lg border border-[var(--line)] bg-[#f5f7fa] px-3 py-2.5 text-xs leading-relaxed text-[var(--navy)]">
          <p className="font-semibold">Integrazione su lotto già caricato</p>
          <p className="mt-1 text-[var(--muted)]">
            Se mandante, perimetro e lotto coincidono con un import precedente, le righe già
            presenti vengono <strong className="text-[var(--navy)]">aggiornate</strong> (anagrafica
            e dati contabili) senza duplicare; le righe nuove vengono aggiunte. Note, codici
            scarico, affidi e lavorazione restano invariati.
          </p>
          <p className="mt-2 text-[var(--muted)]">
            Se il CSV contiene la colonna <span className="font-mono text-[11px]">lotto</span>,
            i valori devono coincidere con il lotto indicato sopra (es.{" "}
            <span className="font-mono text-[11px]">1426001</span>).
          </p>
          <p className="mt-2 text-[var(--muted)]">
            <strong className="text-[var(--navy)]">Suggerimento:</strong> per riconoscere le
            pratiche già presenti includi nel CSV almeno uno tra{" "}
            <span className="font-mono text-[11px]">contratto</span>,{" "}
            <span className="font-mono text-[11px]">commessa</span> o{" "}
            <span className="font-mono text-[11px]">cf</span>. Senza questi campi una riga può
            essere trattata come nuova pratica.
          </p>
        </div>
      ) : null}

      {lottoMatch ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Questo lotto è già presente ({lottoMatch.nPratiche} pratiche): il prossimo caricamento
          sarà un&apos;<strong>integrazione</strong>, non un nuovo import.
        </p>
      ) : null}

      <div className="space-y-1">
        <span className="text-xs font-semibold text-[var(--muted)]">File CSV</span>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          disabled={pending}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setMessage(null);
            setMessageKind(null);
            setImportSummary(null);
          }}
        />
        <div
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-5 text-center ${
            file
              ? "border-[var(--navy)] bg-[#f0f4f8]"
              : "border-[var(--line)] bg-white"
          }`}
        >
          {file ? (
            <>
              <p className="text-sm font-medium text-[var(--navy)]">{file.name}</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy)] hover:bg-slate-50 disabled:opacity-60"
                >
                  Cambia file…
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={clearFile}
                  className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                >
                  Rimuovi file
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-1 disabled:opacity-60"
            >
              <span className="rounded-md bg-[var(--navy)] px-3 py-1.5 text-xs font-semibold text-white">
                Scegli file…
              </span>
              <span className="text-xs text-[var(--muted)]">
                Clicca qui per selezionare il file CSV da importare
              </span>
            </button>
          )}
        </div>
      </div>

      {pending || progress > 0 ? (
        <div className="space-y-1.5" aria-live="polite">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--navy)]">
            <span>
              {pending
                ? progressDetail || "Caricamento in corso…"
                : progressDetail || "Completato"}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#dce4ec]">
            <div
              className="h-full rounded-full bg-[var(--navy)] transition-[width] duration-200 ease-out"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-[var(--navy)] px-4 text-white disabled:opacity-60"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onAnnulla}
          className="h-10 rounded-lg border border-[var(--line)] bg-white px-4 font-medium text-[var(--navy)] hover:bg-slate-50 disabled:opacity-60"
        >
          Annulla
        </button>
      </div>
      {message ? (
        <div
          className={`rounded-lg border px-3 py-2.5 text-sm ${
            messageKind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
          role="status"
        >
          <p className="font-semibold">{message}</p>
          {importSummary ? (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs sm:text-sm">
              {formatImportPraticheFeedback(importSummary).map((riga) => (
                <li key={riga}>{riga}</li>
              ))}
              <li>
                Mandante {importSummary.mandanteCodice} · perimetro {importSummary.perimetro} ·
                lotto {importSummary.lotto}
              </li>
              {importSummary.isIntegrazione ? (
                <li>Note e codici scarico sulle pratiche esistenti non sono stati modificati.</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
