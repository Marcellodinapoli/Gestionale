"use client";

import { useState } from "react";
import { Monitor, Phone, Mail, MapPin, User, PhoneCall } from "lucide-react";
import { selezionaPostazioneAction } from "@/actions/postazione";

type PostazioneItem = {
  id: string;
  nome: string;
  interno: string | null;
  email: string | null;
  numeroFisso: string | null;
  sede: string | null;
  /** Occupata da un altro operatore (non selezionabile). */
  occupante: string | null;
  /** Occupata solo dall’utente corrente → selezionabile, badge “Tu”. */
  tua?: boolean;
};

export function SelezionaPostazioneForm({
  postazioni,
  showPostazioneFissa = false,
}: {
  postazioni: PostazioneItem[];
  showPostazioneFissa?: boolean;
}) {
  const selezionabili = postazioni.filter((p) => !p.occupante || p.tua);
  const [selected, setSelected] = useState<string | null>(null);
  const [postazioneFissa, setPostazioneFissa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!selected) return;
    const scelta = postazioni.find((p) => p.id === selected);
    if (!scelta || (scelta.occupante && !scelta.tua)) {
      setError("Questa postazione è già occupata");
      setSelected(null);
      return;
    }
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set("postazioneId", selected);
    if (showPostazioneFissa && postazioneFissa) {
      fd.set("postazioneFissa", "on");
    }
    const result = await selezionaPostazioneAction(fd);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {postazioni.map((p) => {
          const bloccata = Boolean(p.occupante) && !p.tua;
          const isSelected = selected === p.id && !bloccata;
          return (
            <button
              key={p.id}
              type="button"
              disabled={bloccata || loading}
              onClick={() => {
                if (bloccata) return;
                setSelected(p.id);
                setError(null);
              }}
              aria-disabled={bloccata}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                bloccata
                  ? "cursor-not-allowed border-[var(--line)] bg-[#f1f5f9] opacity-70"
                  : isSelected
                    ? "border-[var(--accent)]/50 bg-[var(--accent)]/[0.06] shadow-[inset_3px_0_0_0_var(--accent)]"
                    : p.tua
                      ? "border-emerald-200 bg-emerald-50/60 hover:border-emerald-300"
                      : "border-[var(--line)] bg-white hover:border-[#c5d0db] hover:bg-[#f8fafc]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Monitor
                  className={`h-5 w-5 shrink-0 ${
                    bloccata
                      ? "text-slate-400"
                      : isSelected
                        ? "text-[var(--accent)]"
                        : p.tua
                          ? "text-emerald-600"
                          : "text-[var(--muted)]"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold ${
                      bloccata ? "text-slate-500" : "text-[var(--navy)]"
                    }`}
                  >
                    {p.nome}
                    {bloccata ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-slate-400">
                        Occupata
                      </span>
                    ) : null}
                    {p.tua ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-emerald-700">
                        Tua
                      </span>
                    ) : null}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--muted)]">
                    {p.interno ? (
                      <span className="flex items-center gap-0.5">
                        <Phone className="h-2.5 w-2.5" /> int. {p.interno}
                      </span>
                    ) : null}
                    {p.numeroFisso ? (
                      <span className="flex items-center gap-0.5">
                        <PhoneCall className="h-2.5 w-2.5" /> {p.numeroFisso}
                      </span>
                    ) : null}
                    {p.email ? (
                      <span className="flex items-center gap-0.5">
                        <Mail className="h-2.5 w-2.5" /> {p.email}
                      </span>
                    ) : null}
                    {p.sede ? (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" /> {p.sede}
                      </span>
                    ) : null}
                  </div>
                </div>
                {p.tua ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-800">
                    <User className="h-2.5 w-2.5" /> Tu
                  </span>
                ) : p.occupante ? (
                  <span className="flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                    <User className="h-2.5 w-2.5" /> {p.occupante}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {!selezionabili.length ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Tutte le postazioni sono occupate. Attendi che qualcuno esca oppure
          chiedi all&apos;amministratore.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>
      ) : null}

      {showPostazioneFissa ? (
        <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--line)] bg-[#f8fafc] px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={postazioneFissa}
            onChange={(e) => setPostazioneFissa(e.target.checked)}
            disabled={loading}
            className="mt-0.5 h-4 w-4 rounded border-[var(--line)] text-[var(--navy)]"
          />
          <span>
            <span className="font-semibold text-[var(--navy)]">Usa sempre questa postazione</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              Non ti verrà più chiesto di sceglierla al login. Potrai cambiarla dalla sezione
              Account.
            </span>
          </span>
        </label>
      ) : null}

      <button
        onClick={handleSubmit}
        disabled={!selected || loading || !selezionabili.length}
        className="mt-5 h-10 w-full rounded-lg bg-[var(--navy)] text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "Caricamento..." : "Conferma postazione"}
      </button>
    </div>
  );
}
