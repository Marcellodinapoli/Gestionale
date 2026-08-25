"use client";

import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { useRouter } from "next/navigation";
import {
  affidoEquoMassivoAction,
  assignPraticheMassiveAction,
} from "@/actions/assignPratica";
import { TipoAffidoSelect } from "@/components/affidi/TipoAffidoSelect";
import {
  dividePraticheEquamente,
  parseCodiciOperatoriInput,
  riepilogoDivisioneEqua,
  selezioneConsenteRipristina,
  selezioneRichiedeTitolare,
  validaAffidoSelezione,
  parseTipoAffido,
  type StatoAffidoPratica,
  type TipoAffido,
} from "@/lib/affido";
import { operatorSigla } from "@/lib/noteFormat";

export type OperatoreAffido = {
  id: string;
  name: string;
  acronimo?: string | null;
};

function codiceOp(o: OperatoreAffido) {
  return (o.acronimo?.trim() || operatorSigla(o.name)).toUpperCase();
}

export function useSelezionePratiche(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allRef = useRef<HTMLInputElement>(null);
  const allChecked = ids.length > 0 && selected.size === ids.length;
  const someChecked = selected.size > 0 && !allChecked;
  const idKey = ids.join("\0");

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someChecked;
  }, [someChecked]);

  useEffect(() => {
    const valid = new Set(idKey ? idKey.split("\0") : []);
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [idKey]);

  function toggleAll() {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(idKey ? idKey.split("\0") : []));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return { selected, allRef, allChecked, toggleAll, toggleOne };
}

function SelectOperatore({
  name,
  operatori,
  required,
  disabled,
  label,
  excludeId,
}: {
  name: string;
  operatori: OperatoreAffido[];
  required?: boolean;
  disabled?: boolean;
  label: string;
  excludeId?: string;
}) {
  const opts = excludeId ? operatori.filter((o) => o.id !== excludeId) : operatori;
  return (
    <select
      name={name}
      required={required}
      disabled={disabled}
      className="h-9 min-w-[160px] rounded-lg border border-[var(--line)] px-2 text-sm disabled:opacity-50"
    >
      <option value="">{label}</option>
      {opts.map((o) => (
        <option key={o.id} value={o.id}>
          {codiceOp(o)} · {o.name}
        </option>
      ))}
    </select>
  );
}

function AffidoSingoloPanel({
  selectedIds,
  praticheStato,
  operatori,
  emptyHint,
  submitLabel,
  showRipristina,
  hideTipoAffido,
}: {
  selectedIds: string[];
  praticheStato: Record<string, StatoAffidoPratica>;
  operatori: OperatoreAffido[];
  emptyHint: string;
  submitLabel: string;
  showRipristina?: boolean;
  hideTipoAffido?: boolean;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoAffido>("definitivo");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const ripristina = !hideTipoAffido && tipo === "ripristina";
  const richiedeTitolare = selezioneRichiedeTitolare(selectedIds, praticheStato, tipo);
  const consenteRipristina =
    (showRipristina ?? false) && selezioneConsenteRipristina(selectedIds, praticheStato);

  async function invia(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedIds.length) return;
    const fd = new FormData(e.currentTarget);
    const assegnatarioId = ripristina
      ? null
      : String(fd.get("assegnatarioId") || "") || null;
    const titolareId = String(fd.get("titolareId") || "") || null;
    const effectiveTipo: TipoAffido = hideTipoAffido ? "definitivo" : tipo;
    const err = validaAffidoSelezione(
      selectedIds,
      praticheStato,
      effectiveTipo,
      assegnatarioId,
      titolareId
    );
    if (err) {
      setError(err);
      return;
    }
    setPending(true);
    setError(null);
    try {
      for (const id of selectedIds) fd.append("praticaId", id);
      fd.set("tipoAffido", effectiveTipo);
      await assignPraticheMassiveAction(fd);
      router.refresh();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Errore affido");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={invia} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--muted)]">
          {selectedIds.length
            ? `${selectedIds.length} ${selectedIds.length === 1 ? "pratica selezionata" : "pratiche selezionate"}`
            : emptyHint}
        </span>
        {hideTipoAffido ? null : (
          <TipoAffidoSelect
            showRipristina={consenteRipristina}
            onChange={(v) => {
              setTipo(parseTipoAffido(v));
              setError(null);
            }}
          />
        )}
        {!ripristina ? (
          <>
            {richiedeTitolare ? (
              <SelectOperatore
                name="titolareId"
                operatori={operatori}
                required
                disabled={!selectedIds.length || pending}
                label="Titolare…"
              />
            ) : null}
            <SelectOperatore
              name="assegnatarioId"
              operatori={operatori}
              required
              disabled={!selectedIds.length || pending}
              label="Operatore…"
            />
          </>
        ) : null}
        <button
          type="submit"
          disabled={!selectedIds.length || pending}
          className="rounded-lg bg-[var(--navy)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? "Affido in corso…" : submitLabel}
        </button>
      </div>
      {richiedeTitolare && tipo === "temporaneo" ? (
        <p className="text-xs text-[var(--muted)]">
          Per le pratiche non ancora affidate indica il titolare (affido definitivo) e l&apos;operatore
          temporaneo.
        </p>
      ) : null}
      {error ? <p className="text-xs font-semibold text-[var(--danger)]">{error}</p> : null}
    </form>
  );
}

function AffidoEquoPanel({
  selectedIds,
  praticheStato,
  operatori,
  hideTipoAffido,
}: {
  selectedIds: string[];
  praticheStato: Record<string, StatoAffidoPratica>;
  operatori: OperatoreAffido[];
  hideTipoAffido?: boolean;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoAffido>("definitivo");
  const [titolareId, setTitolareId] = useState("");
  const [codiciRaw, setCodiciRaw] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"edit" | "confirm">("edit");

  const disponibili = useMemo(
    () =>
      operatori.map((o) => ({
        id: o.id,
        name: o.name,
        codice: codiceOp(o),
      })),
    [operatori]
  );

  const byCodice = useMemo(() => {
    const m = new Map<string, (typeof disponibili)[number]>();
    for (const o of disponibili) m.set(o.codice, o);
    return m;
  }, [disponibili]);

  const codici = parseCodiciOperatoriInput(codiciRaw);
  const missing = codici.filter((c) => !byCodice.has(c));
  const risolti = codici
    .map((c) => byCodice.get(c))
    .filter((o): o is (typeof disponibili)[number] => Boolean(o));
  const unici = [...new Map(risolti.map((o) => [o.id, o])).values()];

  const buckets =
    selectedIds.length && unici.length
      ? dividePraticheEquamente(
          selectedIds,
          unici.map((o) => o.id)
        )
      : [];
  const riepilogo = riepilogoDivisioneEqua(buckets, unici);
  const richiedeTitolare = selezioneRichiedeTitolare(selectedIds, praticheStato, tipo);

  function fillAll() {
    setCodiciRaw(disponibili.map((o) => o.codice).join(", "));
    setStep("edit");
    setError(null);
  }

  async function conferma() {
    if (!selectedIds.length || !unici.length || missing.length) return;
    if (tipo === "temporaneo" && richiedeTitolare && !titolareId) {
      setError("Indica il titolare per l'affido temporaneo");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const fd = new FormData();
      for (const id of selectedIds) fd.append("praticaId", id);
      fd.set("tipoAffido", hideTipoAffido ? "definitivo" : tipo);
      if (titolareId) fd.set("titolareId", titolareId);
      fd.set("codiciOperatori", unici.map((o) => o.codice).join(","));
      fd.set("conferma", "1");
      await affidoEquoMassivoAction(fd);
      setStep("edit");
      setCodiciRaw("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[#f8fafc] p-3">
      <div className="flex flex-wrap items-end gap-2">
        {hideTipoAffido ? null : (
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[var(--muted)]">Tipo</span>
            <TipoAffidoSelect
              showRipristina={false}
              onChange={(v) => {
                setTipo(v);
                setStep("edit");
              }}
            />
          </label>
        )}
        {richiedeTitolare && !hideTipoAffido && tipo === "temporaneo" ? (
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[var(--muted)]">Titolare</span>
            <select
              value={titolareId}
              onChange={(e) => {
                setTitolareId(e.target.value);
                setStep("edit");
                setError(null);
              }}
              className="h-9 min-w-[160px] rounded-lg border border-[var(--line)] bg-white px-2 text-sm"
            >
              <option value="">Titolare…</option>
              {operatori.map((o) => (
                <option key={o.id} value={o.id}>
                  {codiceOp(o)} · {o.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="min-w-[220px] flex-1 text-xs">
          <span className="mb-1 block font-semibold text-[var(--muted)]">
            Codici operatori (separati da virgola)
          </span>
          <input
            value={codiciRaw}
            onChange={(e) => {
              setCodiciRaw(e.target.value.toUpperCase());
              setStep("edit");
              setError(null);
            }}
            placeholder="es. OO, OL, SS"
            disabled={!selectedIds.length}
            className="h-9 w-full rounded-lg border border-[var(--line)] bg-white px-2 font-mono text-sm uppercase disabled:opacity-50"
          />
        </label>
        <button
          type="button"
          onClick={fillAll}
          disabled={!disponibili.length || !selectedIds.length}
          className="h-9 rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-medium hover:bg-[#eef4f8] disabled:opacity-50"
        >
          Tutti i codici
        </button>
        {step === "edit" ? (
          <button
            type="button"
            disabled={
              !selectedIds.length ||
              unici.length < 1 ||
              missing.length > 0 ||
              !codici.length
            }
            onClick={() => setStep("confirm")}
            className="h-9 rounded-lg bg-[var(--navy)] px-3 text-sm text-white disabled:opacity-50"
          >
            Anteprima divisione
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-[10px] text-[var(--muted)]">
        Codici disponibili:{" "}
        {disponibili.length
          ? disponibili.map((o) => `${o.codice} (${o.name})`).join(" · ")
          : "nessun operatore nel gruppo"}
        {unici.length > 1 ? (
          <>
            {" "}
            · Le pratiche in eccesso vanno all&apos;ultimo codice inserito
          </>
        ) : null}
      </p>

      {missing.length ? (
        <p className="mt-2 text-xs font-semibold text-[var(--danger)]">
          Codici non trovati: {missing.join(", ")}
        </p>
      ) : null}

      {step === "confirm" && riepilogo.length ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">
            Confermi la divisione di {selectedIds.length} pratiche (
            {hideTipoAffido ? "definitivo" : tipo})?
          </p>
          <ul className="mt-2 space-y-0.5 text-sm text-amber-950">
            {riepilogo.map((r) => (
              <li key={r.operatoreId}>
                <span className="font-mono font-bold">{r.codice}</span> · {r.name}:{" "}
                <strong>{r.count}</strong>{" "}
                {r.count === 1 ? "pratica" : "pratiche"}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={conferma}
              className="h-9 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Affido in corso…" : "Conferma affido equo"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setStep("edit")}
              className="h-9 rounded-lg border border-[var(--line)] bg-white px-4 text-sm disabled:opacity-50"
            >
              Annulla
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}

export function buildPraticheStato(
  pratiche: Array<{
    id: string;
    assegnatarioId?: string | null;
    operatoreTitolareId?: string | null;
  }>
): Record<string, StatoAffidoPratica> {
  return Object.fromEntries(
    pratiche.map((p) => [
      p.id,
      {
        assegnatarioId: p.assegnatarioId ?? null,
        operatoreTitolareId: p.operatoreTitolareId ?? null,
      },
    ])
  );
}

export function AffidoMassivoForm({
  selectedIds,
  praticheStato,
  operatori,
  emptyHint = "Seleziona le pratiche da affidare",
  submitLabel = "Affida selezionate",
  showRipristina,
  hideTipoAffido,
  allowEquo = true,
}: {
  selectedIds: string[];
  praticheStato: Record<string, StatoAffidoPratica>;
  operatori: OperatoreAffido[];
  emptyHint?: string;
  submitLabel?: string;
  showRipristina?: boolean;
  hideTipoAffido?: boolean;
  allowEquo?: boolean;
}) {
  const [modo, setModo] = useState<"singolo" | "equo">("singolo");

  return (
    <div className="mb-3 space-y-2">
      {allowEquo && operatori.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setModo("singolo")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              modo === "singolo"
                ? "bg-[var(--navy)] text-white"
                : "border border-[var(--line)] bg-white text-[var(--navy)] hover:bg-[#eef4f8]"
            }`}
          >
            A un operatore
          </button>
          <button
            type="button"
            onClick={() => setModo("equo")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              modo === "equo"
                ? "bg-[var(--navy)] text-white"
                : "border border-[var(--line)] bg-white text-[var(--navy)] hover:bg-[#eef4f8]"
            }`}
          >
            Dividi in parti uguali
          </button>
        </div>
      ) : null}

      {modo === "equo" && allowEquo ? (
        <AffidoEquoPanel
          selectedIds={selectedIds}
          praticheStato={praticheStato}
          operatori={operatori}
          hideTipoAffido={hideTipoAffido}
        />
      ) : (
        <AffidoSingoloPanel
          selectedIds={selectedIds}
          praticheStato={praticheStato}
          operatori={operatori}
          emptyHint={emptyHint}
          submitLabel={submitLabel}
          showRipristina={showRipristina}
          hideTipoAffido={hideTipoAffido}
        />
      )}
    </div>
  );
}

export function CheckboxSelezione({
  checked,
  onChange,
  label,
  inputRef,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      title={label}
      className="h-4 w-4 accent-[var(--navy)]"
    />
  );
}
