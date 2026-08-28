"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Monitor } from "lucide-react";
import { updateAccountPostazioneAction } from "@/actions/postazione";

type PostazioneItem = {
  id: string;
  nome: string;
  interno: string | null;
  sede: string | null;
  occupante: string | null;
};

const inputCls =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm shadow-sm transition focus:border-[#1a4f7a] focus:outline-none focus:ring-2 focus:ring-[#1a4f7a]/15";

export function AccountPostazioneForm({
  postazioneId,
  postazioneFissa,
  showPostazioneFissa,
  postazioni,
}: {
  postazioneId: string | null;
  postazioneFissa: boolean;
  showPostazioneFissa: boolean;
  postazioni: PostazioneItem[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function salva(formData: FormData) {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      try {
        await updateAccountPostazioneAction(formData);
        setMsg("Postazione aggiornata");
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  return (
    <form action={salva} className="flex flex-1 flex-col space-y-4 text-sm">
      <label className="block">
        <span className="text-xs font-semibold uppercase text-[var(--muted)]">Postazione</span>
        <select
          name="postazioneId"
          defaultValue={postazioneId || ""}
          className={inputCls}
          required
        >
          <option value="" disabled>
            Seleziona postazione
          </option>
          {postazioni.map((p) => {
            const occupata = Boolean(p.occupante);
            const corrente = p.id === postazioneId;
            const disabled = occupata && !corrente;
            return (
              <option key={p.id} value={p.id} disabled={disabled}>
                {p.nome}
                {p.sede ? ` · ${p.sede}` : ""}
                {p.interno ? ` · int. ${p.interno}` : ""}
                {occupata && !corrente ? ` (occupata da ${p.occupante})` : ""}
              </option>
            );
          })}
        </select>
      </label>

      {showPostazioneFissa ? (
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--line)] bg-[#f8fafc] px-3 py-2.5">
          <input
            type="checkbox"
            name="postazioneFissa"
            defaultChecked={postazioneFissa}
            className="mt-0.5 h-4 w-4 rounded border-[var(--line)] text-[var(--navy)]"
          />
          <span>
            <span className="font-semibold text-[var(--navy)]">Usa sempre questa postazione</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              Al login non ti verrà più chiesto di sceglierla. Deseleziona per tornare alla scelta
              giornaliera.
            </span>
          </span>
        </label>
      ) : null}

      <p className="flex-1 rounded-lg bg-[#f8fafc] px-3 py-2 text-xs leading-relaxed text-[var(--muted)]">
        <Monitor className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
        La postazione determina interno e email associati alla tua sessione di lavoro.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a365d] disabled:opacity-50"
        >
          {pending ? "Salvo…" : "Salva postazione"}
        </button>
        {msg ? <span className="text-xs font-semibold text-emerald-600">{msg}</span> : null}
        {err ? <span className="text-xs font-semibold text-[var(--danger)]">{err}</span> : null}
      </div>
    </form>
  );
}
