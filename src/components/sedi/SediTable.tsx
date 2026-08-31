"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Check, X, Power } from "lucide-react";
import { aggiornaSedeAction, toggleSedeAction } from "@/actions/sedi";

type SedeRow = {
  id: string;
  nome: string;
  indirizzo?: string | null;
  citta?: string | null;
  cap?: string | null;
  provincia?: string | null;
  telefono?: string | null;
  email?: string | null;
  note?: string | null;
  active: boolean;
  nPostazioni: number;
  nUtenti: number;
};

const inputCls =
  "h-8 w-full rounded border border-[var(--line)] px-2 text-xs";

export function SediTable({ sedi }: { sedi: SedeRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<SedeRow>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!sedi.length) {
    return (
      <p className="py-6 text-center text-sm text-[var(--muted)]">
        Nessuna sede configurata.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      {saveError ? (
        <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {saveError}
        </p>
      ) : null}
      <table className="w-full text-sm">
        <thead className="text-left text-[var(--muted)]">
          <tr>
            <th className="py-2">Sede</th>
            <th>Indirizzo</th>
            <th>Contatti</th>
            <th>Postazioni</th>
            <th>Utenti</th>
            <th>Stato</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sedi.map((s) => {
            const editing = editingId === s.id;
            const d = editing ? { ...s, ...draft } : s;
            const luogo = [d.indirizzo, [d.cap, d.citta].filter(Boolean).join(" "), d.provincia]
              .filter(Boolean)
              .join(" · ");
            const contatti = [d.telefono, d.email].filter(Boolean).join(" · ");

            return (
              <tr key={s.id} className="border-t border-[var(--line)] align-top">
                <td className="py-2">
                  {editing ? (
                    <div className="space-y-1 min-w-[140px]">
                      <input
                        value={d.nome || ""}
                        onChange={(e) => setDraft((p) => ({ ...p, nome: e.target.value }))}
                        className={inputCls}
                        placeholder="Nome"
                      />
                      <input
                        value={d.note || ""}
                        onChange={(e) => setDraft((p) => ({ ...p, note: e.target.value }))}
                        className={inputCls}
                        placeholder="Note"
                      />
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                      <span>
                        {s.nome}
                        {s.note ? (
                          <span className="mt-0.5 block text-[11px] font-normal text-[var(--muted)]">
                            {s.note}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  )}
                </td>
                <td className="py-2 text-xs text-[var(--navy)]">
                  {editing ? (
                    <div className="grid min-w-[200px] gap-1">
                      <input
                        value={d.indirizzo || ""}
                        onChange={(e) => setDraft((p) => ({ ...p, indirizzo: e.target.value }))}
                        className={inputCls}
                        placeholder="Indirizzo"
                      />
                      <div className="flex gap-1">
                        <input
                          value={d.cap || ""}
                          onChange={(e) => setDraft((p) => ({ ...p, cap: e.target.value }))}
                          className={inputCls}
                          placeholder="CAP"
                        />
                        <input
                          value={d.citta || ""}
                          onChange={(e) => setDraft((p) => ({ ...p, citta: e.target.value }))}
                          className={inputCls}
                          placeholder="Città"
                        />
                        <input
                          value={d.provincia || ""}
                          onChange={(e) => setDraft((p) => ({ ...p, provincia: e.target.value }))}
                          className={inputCls}
                          placeholder="PR"
                        />
                      </div>
                    </div>
                  ) : (
                    luogo || "—"
                  )}
                </td>
                <td className="py-2 text-xs">
                  {editing ? (
                    <div className="grid min-w-[140px] gap-1">
                      <input
                        value={d.telefono || ""}
                        onChange={(e) => setDraft((p) => ({ ...p, telefono: e.target.value }))}
                        className={inputCls}
                        placeholder="Telefono"
                      />
                      <input
                        value={d.email || ""}
                        onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
                        className={inputCls}
                        placeholder="Email"
                      />
                    </div>
                  ) : (
                    contatti || "—"
                  )}
                </td>
                <td className="py-2">{s.nPostazioni}</td>
                <td className="py-2">{s.nUtenti}</td>
                <td className="py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      s.active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {s.active ? "Attiva" : "Disattiva"}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <div className="flex justify-end gap-1">
                    {editing ? (
                      <>
                        <button
                          type="button"
                          className="rounded p-1.5 hover:bg-emerald-50"
                          title="Salva"
                          onClick={async () => {
                            setSaveError(null);
                            const fd = new FormData();
                            fd.set("id", s.id);
                            fd.set("nome", String(d.nome || "").trim());
                            fd.set("indirizzo", String(d.indirizzo || ""));
                            fd.set("citta", String(d.citta || ""));
                            fd.set("cap", String(d.cap || ""));
                            fd.set("provincia", String(d.provincia || ""));
                            fd.set("telefono", String(d.telefono || ""));
                            fd.set("email", String(d.email || ""));
                            fd.set("note", String(d.note || ""));
                            try {
                              await aggiornaSedeAction(fd);
                              setEditingId(null);
                              setDraft({});
                              router.refresh();
                            } catch (e) {
                              setSaveError(
                                e instanceof Error ? e.message : "Errore durante il salvataggio"
                              );
                            }
                          }}
                        >
                          <Check className="h-4 w-4 text-emerald-700" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1.5 hover:bg-slate-100"
                          onClick={() => {
                            setSaveError(null);
                            setEditingId(null);
                            setDraft({});
                          }}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="rounded p-1.5 hover:bg-slate-100"
                          title="Modifica"
                          onClick={() => {
                            setSaveError(null);
                            setEditingId(s.id);
                            setDraft({});
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1.5 hover:bg-slate-100"
                          title={s.active ? "Disattiva" : "Attiva"}
                          onClick={async () => {
                            const fd = new FormData();
                            fd.set("id", s.id);
                            await toggleSedeAction(fd);
                            router.refresh();
                          }}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
