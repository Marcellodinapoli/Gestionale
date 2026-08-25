"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignPraticaAction } from "@/actions/assignPratica";
import { TipoAffidoSelect } from "@/components/affidi/TipoAffidoSelect";
import {
  isAffidoTemporaneo,
  parseTipoAffido,
  selezioneRichiedeTitolare,
  validaAffidoPratica,
  type StatoAffidoPratica,
  type TipoAffido,
} from "@/lib/affido";

export function AffidaForm({
  praticaId,
  operatori,
  statoAffido,
  titolareName,
  submitLabel = "Affida",
}: {
  praticaId: string;
  operatori: Array<{ id: string; name: string }>;
  statoAffido: StatoAffidoPratica;
  titolareName?: string | null;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoAffido>("definitivo");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const ripristina = tipo === "ripristina";
  const temporaneo = isAffidoTemporaneo(statoAffido);
  const richiedeTitolare = selezioneRichiedeTitolare(
    [praticaId],
    { [praticaId]: statoAffido },
    tipo
  );

  async function invia(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const assegnatarioId = ripristina
      ? null
      : String(fd.get("assegnatarioId") || "") || null;
    const titolareId = String(fd.get("titolareId") || "") || null;
    const err = validaAffidoPratica(statoAffido, tipo, assegnatarioId, titolareId);
    if (err) {
      setError(err);
      return;
    }
    setPending(true);
    setError(null);
    try {
      fd.set("praticaId", praticaId);
      fd.set("tipoAffido", tipo);
      await assignPraticaAction(fd);
      router.refresh();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Errore affido");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={invia} className="flex flex-wrap items-center gap-2">
      <TipoAffidoSelect
        showRipristina={temporaneo}
        onChange={(v) => {
          setTipo(parseTipoAffido(v));
          setError(null);
        }}
      />
      {!ripristina ? (
        <>
          {richiedeTitolare ? (
            <select
              name="titolareId"
              required
              disabled={pending}
              className="h-9 min-w-[140px] rounded-lg border border-[var(--line)] px-2 text-sm"
            >
              <option value="">Titolare…</option>
              {operatori.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : null}
          <select
            name="assegnatarioId"
            required
            disabled={pending}
            className="h-9 min-w-[140px] flex-1 rounded-lg border border-[var(--line)] px-2 text-sm"
          >
            <option value="">Operatore…</option>
            {operatori.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--navy)] px-3 text-sm text-white disabled:opacity-50"
      >
        {pending ? "…" : ripristina ? "Ripristina" : submitLabel}
      </button>
      {temporaneo && titolareName ? (
        <span className="w-full text-xs text-[var(--muted)]">Titolare: {titolareName}</span>
      ) : null}
      {error ? <span className="w-full text-xs font-semibold text-[var(--danger)]">{error}</span> : null}
    </form>
  );
}
