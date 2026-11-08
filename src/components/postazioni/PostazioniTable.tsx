"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Trash2, Power, Pencil, Check, X } from "lucide-react";
import {
  togglePostazioneAction,
  eliminaPostazioneAction,
  aggiornaPostazioneAction,
} from "@/actions/postazione";

type OccupanteRow = {
  id: string;
  name: string;
  tua?: boolean;
};

type PostazioneRow = {
  id: string;
  nome: string;
  interno: string | null;
  email: string | null;
  numeroFisso: string | null;
  numeroFax: string | null;
  numeroWhatsapp: string | null;
  sedeId: string | null;
  sedeNome: string | null;
  note: string | null;
  active: boolean;
  occupanti: OccupanteRow[];
};

type SedeOpt = { id: string; nome: string };

export function PostazioniTable({
  postazioni,
  sedi,
  currentUserId,
}: {
  postazioni: PostazioneRow[];
  sedi: SedeOpt[];
  currentUserId?: string;
}) {
  const router = useRouter();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    interno: "",
    email: "",
    numeroFisso: "",
    numeroFax: "",
    numeroWhatsapp: "",
    sedeId: "",
    note: "",
  });

  function startEdit(p: PostazioneRow) {
    setSaveError(null);
    setEditingId(p.id);
    setForm({
      nome: p.nome,
      interno: p.interno || "",
      email: p.email || "",
      numeroFisso: p.numeroFisso || "",
      numeroFax: p.numeroFax || "",
      numeroWhatsapp: p.numeroWhatsapp || "",
      sedeId: p.sedeId || "",
      note: p.note || "",
    });
  }

  async function saveEdit(id: string) {
    setSaveError(null);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("nome", form.nome.trim());
    fd.set("interno", form.interno);
    fd.set("email", form.email);
    fd.set("numeroFisso", form.numeroFisso);
    fd.set("numeroFax", form.numeroFax);
    fd.set("numeroWhatsapp", form.numeroWhatsapp);
    fd.set("sedeId", form.sedeId);
    fd.set("note", form.note);
    try {
      await aggiornaPostazioneAction(fd);
      setEditingId(null);
      router.refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Errore durante il salvataggio");
    }
  }

  async function toggle(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    await togglePostazioneAction(fd);
    router.refresh();
  }

  async function elimina(id: string, nome: string) {
    if (!confirm(`Eliminare la postazione "${nome}"?`)) return;
    const fd = new FormData();
    fd.set("id", id);
    await eliminaPostazioneAction(fd);
    router.refresh();
  }

  if (postazioni.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--muted)]">
        Nessuna postazione configurata.
      </p>
    );
  }

  const inputCls = "h-8 w-full rounded border border-[var(--line)] px-2 text-xs";
  /** Email, fisso, fax e WhatsApp: stessa larghezza in tabella e in modifica inline. */
  const contattoCol =
    "w-[8.75rem] min-w-[8.75rem] max-w-[8.75rem] box-border px-1 align-top";
  const noteCol = "w-[7.5rem] min-w-[7.5rem] max-w-[7.5rem] box-border px-1 align-top";

  return (
    <div className="overflow-x-auto">
      {saveError ? (
        <p className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {saveError}
        </p>
      ) : null}
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col />
          <col className="w-20" />
          <col className="w-[8.75rem]" />
          <col className="w-[8.75rem]" />
          <col className="w-[8.75rem]" />
          <col className="w-[8.75rem]" />
          <col className="w-[7.5rem]" />
          <col />
          <col />
          <col className="w-28" />
          <col className="w-[4.5rem]" />
        </colgroup>
        <thead className="text-left text-[var(--muted)]">
          <tr>
            <th className="py-2">Postazione</th>
            <th>Interno</th>
            <th className={contattoCol}>Email</th>
            <th className={contattoCol}>Numero fisso</th>
            <th className={contattoCol}>Fax</th>
            <th className={contattoCol}>WhatsApp</th>
            <th className={noteCol}>Note</th>
            <th>Sede</th>
            <th>Occupante</th>
            <th>Stato</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {postazioni.map((p) =>
            editingId === p.id ? (
              <tr key={p.id} className="border-t border-[var(--line)] bg-[#f8fafc]">
                <td className="py-2">
                  <input
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    className={inputCls}
                  />
                </td>
                <td>
                  <input
                    value={form.interno}
                    onChange={(e) => setForm((f) => ({ ...f, interno: e.target.value }))}
                    className={`${inputCls} font-mono`}
                  />
                </td>
                <td className={contattoCol}>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className={inputCls}
                  />
                </td>
                <td className={contattoCol}>
                  <input
                    value={form.numeroFisso}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, numeroFisso: e.target.value }))
                    }
                    className={inputCls}
                  />
                </td>
                <td className={contattoCol}>
                  <input
                    value={form.numeroFax}
                    onChange={(e) => setForm((f) => ({ ...f, numeroFax: e.target.value }))}
                    className={inputCls}
                  />
                </td>
                <td className={contattoCol}>
                  <input
                    value={form.numeroWhatsapp}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, numeroWhatsapp: e.target.value }))
                    }
                    className={inputCls}
                  />
                </td>
                <td className={noteCol}>
                  <input
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                    className={inputCls}
                    placeholder="Note…"
                  />
                </td>
                <td>
                  <select
                    value={form.sedeId}
                    onChange={(e) => setForm((f) => ({ ...f, sedeId: e.target.value }))}
                    className={inputCls}
                    required
                  >
                    <option value="">—</option>
                    {sedi.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </td>
                <td colSpan={3}>
                  <div className="flex gap-1">
                    <button
                      onClick={() => saveEdit(p.id)}
                      className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white"
                    >
                      <Check className="h-3 w-3" /> Salva
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSaveError(null);
                        setEditingId(null);
                      }}
                      className="rounded p-1 text-[var(--muted)] hover:bg-slate-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr
                key={p.id}
                className={`border-t border-[var(--line)] ${!p.active ? "opacity-50" : ""}`}
              >
                <td className="py-2">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Monitor className="h-3.5 w-3.5 text-[var(--muted)]" />
                    {p.nome}
                  </span>
                </td>
                <td className="font-mono text-xs">{p.interno || "—"}</td>
                <td
                  className={`truncate text-xs text-[var(--muted)] ${contattoCol}`}
                  title={p.email || undefined}
                >
                  {p.email || "—"}
                </td>
                <td
                  className={`truncate text-xs ${contattoCol}`}
                  title={p.numeroFisso || undefined}
                >
                  {p.numeroFisso || "—"}
                </td>
                <td
                  className={`truncate text-xs ${contattoCol}`}
                  title={p.numeroFax || undefined}
                >
                  {p.numeroFax || "—"}
                </td>
                <td
                  className={`truncate text-xs ${contattoCol}`}
                  title={p.numeroWhatsapp || undefined}
                >
                  {p.numeroWhatsapp || "—"}
                </td>
                <td className={noteCol}>
                  {p.note?.trim() ? (
                    <span
                      className="block min-w-0 cursor-help truncate text-xs text-[var(--muted)] decoration-[var(--line)] decoration-dotted underline-offset-2 hover:underline"
                      title={p.note.trim()}
                    >
                      {p.note.trim()}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">—</span>
                  )}
                </td>
                <td className="text-xs">{p.sedeNome || "—"}</td>
                <td>
                  {p.occupanti.length > 0 ? (
                    <span className="flex flex-wrap items-center gap-1">
                      {p.occupanti.map((o) => {
                        const tua =
                          o.tua === true ||
                          (currentUserId != null && o.id === currentUserId);
                        return (
                          <span
                            key={o.id}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              tua
                                ? "bg-[var(--navy)] text-white"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {tua ? "Tu · " : null}
                            {o.name}
                          </span>
                        );
                      })}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">Libera</span>
                  )}
                </td>
                <td>
                  <button
                    onClick={() => toggle(p.id)}
                    className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold ${
                      p.active
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    <Power className="h-3 w-3" />
                    {p.active ? "Attiva" : "Disattivata"}
                  </button>
                </td>
                <td>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(p)}
                      className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => elimina(p.id, p.nome)}
                      className="flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-200"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
