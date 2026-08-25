"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Check, X, Power } from "lucide-react";
import { aggiornaSedeAction, toggleSedeAction } from "@/actions/sedi";

type SedeRow = {
  id: string;
  nome: string;
  active: boolean;
  nPostazioni: number;
  nUtenti: number;
};

export function SediTable({ sedi }: { sedi: SedeRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");

  if (!sedi.length) {
    return (
      <p className="py-6 text-center text-sm text-[var(--muted)]">
        Nessuna sede configurata.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-[var(--muted)]">
          <tr>
            <th className="py-2">Sede</th>
            <th>Postazioni</th>
            <th>Utenti</th>
            <th>Stato</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sedi.map((s) => (
            <tr key={s.id} className="border-t border-[var(--line)]">
              <td className="py-2">
                {editingId === s.id ? (
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="h-8 w-full max-w-xs rounded border border-[var(--line)] px-2 text-xs"
                  />
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <MapPin className="h-3.5 w-3.5 text-[var(--muted)]" />
                    {s.nome}
                  </span>
                )}
              </td>
              <td>{s.nPostazioni}</td>
              <td>{s.nUtenti}</td>
              <td>
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
              <td className="text-right">
                <div className="flex justify-end gap-1">
                  {editingId === s.id ? (
                    <>
                      <button
                        type="button"
                        className="rounded p-1.5 hover:bg-emerald-50"
                        title="Salva"
                        onClick={async () => {
                          const fd = new FormData();
                          fd.set("id", s.id);
                          fd.set("nome", nome);
                          await aggiornaSedeAction(fd);
                          setEditingId(null);
                          router.refresh();
                        }}
                      >
                        <Check className="h-4 w-4 text-emerald-700" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1.5 hover:bg-slate-100"
                        onClick={() => setEditingId(null)}
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
                          setEditingId(s.id);
                          setNome(s.nome);
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
