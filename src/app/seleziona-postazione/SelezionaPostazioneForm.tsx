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
  occupante: string | null;
};

export function SelezionaPostazioneForm({
  postazioni,
}: {
  postazioni: PostazioneItem[];
}) {
  const libere = postazioni.filter((p) => !p.occupante);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!selected) return;
    const scelta = postazioni.find((p) => p.id === selected);
    if (!scelta || scelta.occupante) {
      setError("Questa postazione è già occupata");
      setSelected(null);
      return;
    }
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set("postazioneId", selected);
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
          const occupata = Boolean(p.occupante);
          const isSelected = selected === p.id && !occupata;
          return (
            <button
              key={p.id}
              type="button"
              disabled={occupata || loading}
              onClick={() => {
                if (occupata) return;
                setSelected(p.id);
                setError(null);
              }}
              aria-disabled={occupata}
              className={`w-full rounded-xl border p-3 text-left transition-all ${
                occupata
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-70"
                  : isSelected
                    ? "border-[var(--accent)] bg-blue-50 ring-2 ring-[var(--accent)]"
                    : "border-[var(--line)] bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Monitor
                  className={`h-5 w-5 shrink-0 ${
                    occupata
                      ? "text-slate-400"
                      : isSelected
                        ? "text-[var(--accent)]"
                        : "text-[var(--muted)]"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold ${
                      occupata ? "text-slate-500" : "text-[var(--navy)]"
                    }`}
                  >
                    {p.nome}
                    {occupata ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-slate-400">
                        Occupata
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
                {p.occupante ? (
                  <span className="flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                    <User className="h-2.5 w-2.5" /> {p.occupante}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {!libere.length ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Tutte le postazioni sono occupate. Attendi che qualcuno esca oppure
          chiedi all&apos;amministratore.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>
      ) : null}

      <button
        onClick={handleSubmit}
        disabled={!selected || loading || !libere.length}
        className="mt-5 h-10 w-full rounded-lg bg-[var(--navy)] text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {loading ? "Caricamento..." : "Conferma postazione"}
      </button>
    </div>
  );
}
