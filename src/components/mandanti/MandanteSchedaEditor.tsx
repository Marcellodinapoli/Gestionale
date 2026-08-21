"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { updateMandanteAction, createMandanteAction } from "@/actions/core";
import { METODI_INCASSO } from "@/lib/metodoIncasso";
import { parseProvvigioniMetodo } from "@/lib/provvigioni";
import {
  parsePerimetri,
  serializePerimetri,
  type MandantePerimetro,
} from "@/lib/mandantePerimetri";
import { PerimetriMandanteSection } from "@/components/mandanti/PerimetriMandanteSection";

type SmsPreset = { id: string; titolo: string; testo: string };
type CodiceScaricoCust = { codice: string; descrizione: string };

type MandanteData = {
  id: string;
  codice: string;
  ragioneSociale: string;
  email: string | null;
  telefono: string | null;
  indirizzo: string | null;
  citta: string | null;
  cap: string | null;
  provincia: string | null;
  provvigionePerc: number | null;
  provvigioniMetodo: string | null;
  incentivoTipo: string | null;
  incentivoValore: number | null;
  incentivoSoglia: number | null;
  incentivoNote: string | null;
  codiciScarico: string | null;
  smsPreimpostati: string | null;
  perimetri: string | null;
  pratiche: number;
};

function parseSmsPresets(raw: string | null): SmsPreset[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function parseCodiciScarico(raw: string | null): CodiceScaricoCust[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function MandanteSchedaEditor({
  mandante,
  ruolo,
  isNew = false,
}: {
  mandante: MandanteData;
  ruolo: string;
  isNew?: boolean;
}) {
  const canSeeFinanza = ruolo !== "BACK_OFFICE";
  const [codice, setCodice] = useState(mandante.codice);
  const [ragioneSociale, setRagioneSociale] = useState(mandante.ragioneSociale);
  const [email, setEmail] = useState(mandante.email || "");
  const [telefono, setTelefono] = useState(mandante.telefono || "");
  const [indirizzo, setIndirizzo] = useState(mandante.indirizzo || "");
  const [citta, setCitta] = useState(mandante.citta || "");
  const [cap, setCap] = useState(mandante.cap || "");
  const [provincia, setProvincia] = useState(mandante.provincia || "");
  const [provvPerc, setProvvPerc] = useState(
    mandante.provvigionePerc != null ? String(mandante.provvigionePerc) : ""
  );
  const [provvMetodo, setProvvMetodo] = useState<Record<string, string>>(() => {
    const map = parseProvvigioniMetodo(mandante.provvigioniMetodo);
    return Object.fromEntries(
      METODI_INCASSO.map((m) => [
        m.value,
        map[m.value] != null ? String(map[m.value]) : "",
      ])
    );
  });
  const [incentivoTipo, setIncentivoTipo] = useState(mandante.incentivoTipo || "");
  const [incentivoValore, setIncentivoValore] = useState(
    mandante.incentivoValore != null ? String(mandante.incentivoValore) : ""
  );
  const [incentivoSoglia, setIncentivoSoglia] = useState(
    mandante.incentivoSoglia != null ? String(mandante.incentivoSoglia) : ""
  );
  const [incentivoNote, setIncentivoNote] = useState(mandante.incentivoNote || "");
  const [codici, setCodici] = useState<CodiceScaricoCust[]>(
    parseCodiciScarico(mandante.codiciScarico)
  );
  const [nuovoCodice, setNuovoCodice] = useState("");
  const [nuovaDesc, setNuovaDesc] = useState("");
  const [editingCodIdx, setEditingCodIdx] = useState<number | null>(null);
  const [editCodice, setEditCodice] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [smsPresets, setSmsPresets] = useState<SmsPreset[]>(
    parseSmsPresets(mandante.smsPreimpostati)
  );
  const [perimetri, setPerimetri] = useState<MandantePerimetro[]>(
    parsePerimetri(mandante.perimetri)
  );
  const [nuovoSmsTitolo, setNuovoSmsTitolo] = useState("");
  const [nuovoSmsTesto, setNuovoSmsTesto] = useState("");
  const [editingSmsIdx, setEditingSmsIdx] = useState<number | null>(null);
  const [editSmsTitolo, setEditSmsTitolo] = useState("");
  const [editSmsTesto, setEditSmsTesto] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function addCodice() {
    const codice = nuovoCodice.trim().toUpperCase();
    const descrizione = nuovaDesc.trim();
    if (!codice || !descrizione) return;
    if (codici.some((c) => c.codice === codice)) return;
    setCodici((prev) => [...prev, { codice, descrizione }]);
    setNuovoCodice("");
    setNuovaDesc("");
  }

  function removeCodice(idx: number) {
    setCodici((prev) => prev.filter((_, i) => i !== idx));
  }

  function startEditCodice(idx: number) {
    setEditingCodIdx(idx);
    setEditCodice(codici[idx].codice);
    setEditDesc(codici[idx].descrizione);
  }

  function saveEditCodice() {
    if (editingCodIdx == null) return;
    const codice = editCodice.trim().toUpperCase();
    const descrizione = editDesc.trim();
    if (!codice || !descrizione) return;
    setCodici((prev) =>
      prev.map((c, i) => (i === editingCodIdx ? { codice, descrizione } : c))
    );
    setEditingCodIdx(null);
  }

  function addSms() {
    const titolo = nuovoSmsTitolo.trim();
    const testo = nuovoSmsTesto.trim();
    if (!titolo || !testo) return;
    setSmsPresets((prev) => [
      ...prev,
      { id: `sms-${Date.now()}`, titolo, testo },
    ]);
    setNuovoSmsTitolo("");
    setNuovoSmsTesto("");
  }

  function removeSms(id: string) {
    setSmsPresets((prev) => prev.filter((s) => s.id !== id));
  }

  function startEditSms(idx: number) {
    setEditingSmsIdx(idx);
    setEditSmsTitolo(smsPresets[idx].titolo);
    setEditSmsTesto(smsPresets[idx].testo);
  }

  function saveEditSms() {
    if (editingSmsIdx == null) return;
    const titolo = editSmsTitolo.trim();
    const testo = editSmsTesto.trim();
    if (!titolo || !testo) return;
    setSmsPresets((prev) =>
      prev.map((s, i) =>
        i === editingSmsIdx ? { ...s, titolo, testo } : s
      )
    );
    setEditingSmsIdx(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const fd = new FormData();
      if (isNew) {
        fd.set("codice", codice);
        fd.set("ragioneSociale", ragioneSociale);
        fd.set("email", email);
        fd.set("telefono", telefono);
        await createMandanteAction(fd);
        return;
      }
      fd.set("id", mandante.id);
      fd.set("ragioneSociale", ragioneSociale);
      fd.set("email", email);
      fd.set("telefono", telefono);
      fd.set("indirizzo", indirizzo);
      fd.set("citta", citta);
      fd.set("cap", cap);
      fd.set("provincia", provincia);
      fd.set("provvigionePerc", provvPerc);
      const provvigioniMetodoObj: Record<string, number> = {};
      for (const m of METODI_INCASSO) {
        const raw = provvMetodo[m.value]?.trim();
        if (!raw) continue;
        const n = parseFloat(raw.replace(",", "."));
        if (!Number.isNaN(n) && n >= 0) provvigioniMetodoObj[m.value] = n;
      }
      fd.set("provvigioniMetodo", JSON.stringify(provvigioniMetodoObj));
      fd.set("incentivoTipo", incentivoTipo);
      fd.set("incentivoValore", incentivoValore);
      fd.set("incentivoSoglia", incentivoSoglia);
      fd.set("incentivoNote", incentivoNote);
      fd.set("codiciScarico", JSON.stringify(codici));
      fd.set("smsPreimpostati", JSON.stringify(smsPresets));
      fd.set("perimetri", serializePerimetri(perimetri));
      await updateMandanteAction(fd);
      setMsg("Salvato");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Errore");
    } finally {
      setSaving(false);
    }
  }

  const sectionCls =
    "rounded-lg border border-[var(--line)] bg-[#f8fafc] overflow-hidden";
  const headerCls =
    "bg-[#c5d4e3] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#1a365d]";
  const inputCls =
    "h-9 w-full rounded border border-[var(--line)] px-2 text-sm";

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-2">
      <div className="flex items-center gap-2">
        <Link
          href="/mandanti"
          className="flex items-center gap-1 rounded border border-[var(--line)] px-2 py-1 text-xs hover:bg-[#eef4f8]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Mandanti
        </Link>
        <h1 className="text-lg font-bold text-[var(--navy)]">
          {isNew ? "Nuova mandante" : `${mandante.codice} · ${mandante.ragioneSociale}`}
        </h1>
        {!isNew && (
          <span className="ml-auto text-xs text-[var(--muted)]">
            {mandante.pratiche} pratiche
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Anagrafica */}
        <div className={sectionCls}>
          <div className={headerCls}>Anagrafica mandante</div>
          <div className="grid gap-3 p-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Ragione sociale
              </span>
              <input
                value={ragioneSociale}
                onChange={(e) => setRagioneSociale(e.target.value)}
                required
                className={inputCls}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Codice
              </span>
              <input
                value={codice}
                onChange={(e) => setCodice(e.target.value.toUpperCase())}
                disabled={!isNew}
                required={isNew}
                className={`${inputCls} ${!isNew ? "bg-[#eef2f6] text-[var(--muted)]" : ""}`}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Telefono
              </span>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Indirizzo
              </span>
              <input
                value={indirizzo}
                onChange={(e) => setIndirizzo(e.target.value)}
                placeholder="Via/Piazza..."
                className={inputCls}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Città
              </span>
              <input
                value={citta}
                onChange={(e) => setCitta(e.target.value)}
                className={inputCls}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                  CAP
                </span>
                <input
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                  maxLength={5}
                  className={inputCls}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                  Provincia
                </span>
                <input
                  value={provincia}
                  onChange={(e) => setProvincia(e.target.value)}
                  maxLength={2}
                  placeholder="RM"
                  className={`${inputCls} uppercase`}
                />
              </label>
            </div>
          </div>
        </div>

        {canSeeFinanza && <>
        {/* Provvigioni */}
        <div className={sectionCls}>
          <div className={headerCls}>Provvigioni</div>
          <div className="p-3">
            <label className="block max-w-xs text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Percentuale provvigione (%)
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={provvPerc}
                onChange={(e) => setProvvPerc(e.target.value)}
                placeholder="es. 8"
                className={`${inputCls} max-w-[120px]`}
              />
            </label>
            <p className="mt-1 text-[10px] text-[var(--muted)]">
              Percentuale di default se non indicata per la singola modalità di incasso.
            </p>

            <div className="mt-4 border-t border-[var(--line)] pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase text-[var(--muted)]">
                Provvigioni per modalità di incasso
              </p>
              <p className="mb-3 text-[10px] text-[var(--muted)]">
                Imposta una percentuale diversa per ogni tipologia. Se lasci vuoto, si usa la
                percentuale di default sopra.
              </p>
              <div className="overflow-x-auto rounded border border-[var(--line)] bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-[#eef2f6] text-left text-[10px] uppercase text-[var(--muted)]">
                    <tr>
                      <th className="px-3 py-2">Modalità incasso</th>
                      <th className="px-3 py-2 w-28">Provvigione %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {METODI_INCASSO.map((m) => (
                      <tr key={m.value} className="border-t border-[var(--line)]">
                        <td className="px-3 py-1.5 text-xs">{m.label}</td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={provvMetodo[m.value] || ""}
                            onChange={(e) =>
                              setProvvMetodo((prev) => ({
                                ...prev,
                                [m.value]: e.target.value,
                              }))
                            }
                            placeholder={provvPerc || "8"}
                            className="h-8 w-24 rounded border border-[var(--line)] px-2 text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Incentivi */}
        <div className={sectionCls}>
          <div className={headerCls}>Incentivi</div>
          <div className="grid gap-3 p-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Tipo incentivo
              </span>
              <select
                value={incentivoTipo}
                onChange={(e) => setIncentivoTipo(e.target.value)}
                className={inputCls}
              >
                <option value="">— Nessuno —</option>
                <option value="percentuale">% su incassi</option>
                <option value="cash">Importo fisso (cash)</option>
              </select>
            </label>
            {incentivoTipo && (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                    {incentivoTipo === "percentuale" ? "Percentuale (%)" : "Importo (€)"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={incentivoValore}
                    onChange={(e) => setIncentivoValore(e.target.value)}
                    placeholder={incentivoTipo === "percentuale" ? "es. 5" : "es. 100"}
                    className={`${inputCls} max-w-[150px]`}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                    Soglia minima incasso (€)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={incentivoSoglia}
                    onChange={(e) => setIncentivoSoglia(e.target.value)}
                    placeholder="es. 500"
                    className={`${inputCls} max-w-[150px]`}
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                    Note incentivo
                  </span>
                  <textarea
                    value={incentivoNote}
                    onChange={(e) => setIncentivoNote(e.target.value)}
                    rows={2}
                    className="w-full rounded border border-[var(--line)] px-2 py-1 text-sm"
                  />
                </label>
              </>
            )}
          </div>
        </div>
        </>}

        {!isNew && canSeeFinanza ? (
          <div className={sectionCls}>
            <div className={headerCls}>Perimetri / commesse</div>
            <PerimetriMandanteSection initial={perimetri} onChange={setPerimetri} />
          </div>
        ) : null}

        {/* Codici scarico */}
        <div className={sectionCls}>
          <div className={headerCls}>Codici scarico</div>
          <div className="space-y-2 p-3">
            <p className="text-[10px] text-[var(--muted)]">
              Codici scarico personalizzati per questo mandante. Aggiungi, modifica o elimina.
            </p>
            {codici.length > 0 ? (
              <div className="space-y-1">
                {codici.map((c, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded border border-[var(--line)] bg-white px-2 py-1.5"
                  >
                    {editingCodIdx === idx ? (
                      <>
                        <input
                          value={editCodice}
                          onChange={(e) => setEditCodice(e.target.value)}
                          className="h-7 w-20 rounded border border-[var(--line)] px-1.5 text-xs font-mono"
                          placeholder="Codice"
                        />
                        <input
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="h-7 min-w-0 flex-1 rounded border border-[var(--line)] px-1.5 text-xs"
                          placeholder="Descrizione"
                        />
                        <button
                          type="button"
                          onClick={saveEditCodice}
                          className="shrink-0 rounded p-1 text-emerald-600 hover:bg-emerald-50"
                          title="Salva"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCodIdx(null)}
                          className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[#eef4f8]"
                          title="Annulla"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="w-16 shrink-0 font-mono text-xs font-bold text-[var(--navy)]">
                          {c.codice}
                        </span>
                        <span className="min-w-0 flex-1 text-xs">
                          {c.descrizione}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEditCodice(idx)}
                          className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[#eef4f8] hover:text-[var(--navy)]"
                          title="Modifica"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCodice(idx)}
                          className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[#fee2e2] hover:text-[var(--danger)]"
                          title="Elimina"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                Nessun codice scarico definito.
              </p>
            )}
            <div className="rounded border border-dashed border-[var(--accent)] bg-white p-2">
              <div className="flex flex-wrap items-end gap-2">
                <input
                  value={nuovoCodice}
                  onChange={(e) => setNuovoCodice(e.target.value)}
                  placeholder="Codice (es. PTC)"
                  className="h-8 w-24 rounded border border-[var(--line)] px-2 font-mono text-xs"
                />
                <input
                  value={nuovaDesc}
                  onChange={(e) => setNuovaDesc(e.target.value)}
                  placeholder="Descrizione (es. Pagato / chiuso)"
                  className="h-8 min-w-[180px] flex-1 rounded border border-[var(--line)] px-2 text-xs"
                />
                <button
                  type="button"
                  onClick={addCodice}
                  disabled={!nuovoCodice.trim() || !nuovaDesc.trim()}
                  className="flex h-8 items-center gap-1 rounded bg-[var(--navy)] px-3 text-xs text-white disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" /> Aggiungi
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SMS preimpostati */}
        <div className={sectionCls}>
          <div className={headerCls}>Messaggi SMS preimpostati</div>
          <div className="space-y-2 p-3">
            <p className="text-[10px] text-[var(--muted)]">
              Messaggi SMS personalizzati per questo mandante. Se vuoti, verranno
              usati quelli di default.
            </p>
            {smsPresets.length > 0 ? (
              <div className="space-y-1.5">
                {smsPresets.map((sms, idx) => (
                  <div
                    key={sms.id}
                    className="flex items-start gap-2 rounded border border-[var(--line)] bg-white p-2"
                  >
                    {editingSmsIdx === idx ? (
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <input
                          value={editSmsTitolo}
                          onChange={(e) => setEditSmsTitolo(e.target.value)}
                          className="h-7 w-full rounded border border-[var(--line)] px-1.5 text-xs font-semibold"
                          placeholder="Titolo"
                        />
                        <textarea
                          value={editSmsTesto}
                          onChange={(e) => setEditSmsTesto(e.target.value)}
                          rows={2}
                          className="w-full rounded border border-[var(--line)] px-1.5 py-1 text-[10px]"
                          placeholder="Testo del messaggio"
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={saveEditSms}
                            className="shrink-0 rounded p-1 text-emerald-600 hover:bg-emerald-50"
                            title="Salva"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSmsIdx(null)}
                            className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[#eef4f8]"
                            title="Annulla"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[var(--navy)]">
                            {sms.titolo}
                          </p>
                          <p className="text-[10px] text-[var(--muted)]">
                            {sms.testo}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEditSms(idx)}
                          className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[#eef4f8] hover:text-[var(--navy)]"
                          title="Modifica"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSms(sms.id)}
                          className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[#fee2e2] hover:text-[var(--danger)]"
                          title="Elimina"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="rounded border border-dashed border-[var(--accent)] bg-white p-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                <input
                  value={nuovoSmsTitolo}
                  onChange={(e) => setNuovoSmsTitolo(e.target.value)}
                  placeholder="Titolo"
                  className="h-8 rounded border border-[var(--line)] px-2 text-xs"
                />
                <input
                  value={nuovoSmsTesto}
                  onChange={(e) => setNuovoSmsTesto(e.target.value)}
                  placeholder="Testo del messaggio..."
                  className="h-8 rounded border border-[var(--line)] px-2 text-xs"
                />
                <button
                  type="button"
                  onClick={addSms}
                  disabled={!nuovoSmsTitolo.trim() || !nuovoSmsTesto.trim()}
                  className="flex h-8 items-center gap-1 rounded bg-[var(--navy)] px-3 text-xs text-white disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" /> Aggiungi
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Salva / Annulla */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg bg-[var(--navy)] px-6 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Salvataggio..." : isNew ? "Crea mandante" : "Salva modifiche"}
          </button>
          <Link
            href="/mandanti"
            className="flex h-10 items-center rounded-lg border border-[var(--line)] bg-white px-6 text-sm font-semibold text-[var(--navy)] hover:bg-[#eef4f8]"
          >
            Annulla
          </Link>
          {msg ? (
            <span
              className={`text-xs font-semibold ${
                msg === "Salvato" ? "text-emerald-600" : "text-[var(--danger)]"
              }`}
            >
              {msg}
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
