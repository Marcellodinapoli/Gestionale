"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  registraEsitoGiudizialeAction,
  salvaStrategiaProceduraAction,
} from "@/actions/giudiziale";
import {
  ATTIVITA_PROCEDURA,
  ESITI_GIUDIZIALI,
  STATI_ATTIVITA_PROCEDURA,
  STATI_PROCEDURA,
  STRATEGIE_SCELTE,
  emptyAttivitaProcedura,
  parseAttivitaProceduraJson,
  type AttivitaProceduraKey,
  type AttivitaProceduraMap,
  type EsitoGiudiziale,
} from "@/lib/giudiziale/strategiaGiudiziale";
import {
  parseSpeseGiudizialiJson,
  serializeSpeseGiudizialiJson,
  type SpesaGiudizialeVoce,
} from "@/lib/giudiziale/speseGiudiziali";
import { SpeseGiudizialiEditor } from "@/components/giudiziale/SpeseGiudizialiEditor";

const fieldCls =
  "h-9 w-full rounded-lg border border-[#7d94a8] bg-white px-2 text-sm text-[var(--navy)]";
const labelCls = "mb-0.5 block text-[11px] font-semibold text-[var(--danger)]";
const sectionCls =
  "space-y-3 rounded-lg border border-[var(--line)]/70 bg-[#f8fafc] p-3";
const areaCls =
  "w-full rounded-lg border border-[#7d94a8] bg-white px-2 py-1.5 text-sm text-[var(--navy)]";

export type StrategiaProceduraInitial = {
  strategiaScelta?: string | null;
  proceduraDaSeguire?: string | null;
  professionistaIncaricato?: string | null;
  attivitaProceduraJson?: string | null;
  agendaScadenze?: string | null;
  documentiDaProdurre?: string | null;
  statoProcedura?: string | null;
  eventiStorico?: string | null;
  costiSostenuti?: string | null;
  speseGiudizialiJson?: string | null;
  esitoGiudiziale?: string | null;
  dataEsito?: string | Date | null;
  importoRecuperato?: number | null;
  noteLegaliOperatori?: string | null;
};

export function StrategiaProceduraForm({
  praticaId,
  initial,
  readOnly,
}: {
  praticaId: string;
  initial?: StrategiaProceduraInitial;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [strategia, setStrategia] = useState(initial?.strategiaScelta || "");
  const [procedura, setProcedura] = useState(initial?.proceduraDaSeguire || "");
  const [professionista, setProfessionista] = useState(
    initial?.professionistaIncaricato || ""
  );
  const [attivita, setAttivita] = useState<AttivitaProceduraMap>(() =>
    parseAttivitaProceduraJson(initial?.attivitaProceduraJson)
  );
  const [agenda, setAgenda] = useState(initial?.agendaScadenze || "");
  const [documenti, setDocumenti] = useState(initial?.documentiDaProdurre || "");
  const [statoProcedura, setStatoProcedura] = useState(
    initial?.statoProcedura || "DA_AVVIARE"
  );
  const [eventi, setEventi] = useState(initial?.eventiStorico || "");
  const [spese, setSpese] = useState<SpesaGiudizialeVoce[]>(() =>
    parseSpeseGiudizialiJson(initial?.speseGiudizialiJson)
  );
  const [esito, setEsito] = useState(initial?.esitoGiudiziale || "");
  const [dataEsito, setDataEsito] = useState(() => {
    const raw = initial?.dataEsito;
    if (!raw) return "";
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
    return d.toISOString().slice(0, 10);
  });
  const [importoRecuperato, setImportoRecuperato] = useState(
    initial?.importoRecuperato != null && Number(initial.importoRecuperato) !== 0
      ? String(initial.importoRecuperato)
      : initial?.importoRecuperato === 0
        ? "0"
        : ""
  );
  const [note, setNote] = useState(initial?.noteLegaliOperatori || "");

  const disabled = readOnly || pending;

  function patchAttivita(
    key: AttivitaProceduraKey,
    patch: Partial<AttivitaProceduraMap[AttivitaProceduraKey]>
  ) {
    setAttivita((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || emptyAttivitaProcedura()[key]), ...patch },
    }));
  }

  const payload = useMemo(
    () => ({
      praticaId,
      strategiaScelta: strategia || null,
      proceduraDaSeguire: procedura,
      professionistaIncaricato: professionista,
      attivitaProceduraJson: JSON.stringify(attivita),
      agendaScadenze: agenda,
      documentiDaProdurre: documenti,
      statoProcedura: statoProcedura || null,
      eventiStorico: eventi,
      speseGiudizialiJson: serializeSpeseGiudizialiJson(spese),
      esitoGiudiziale: (esito as EsitoGiudiziale) || null,
      dataEsito: dataEsito || null,
      importoRecuperato:
        importoRecuperato.trim() === ""
          ? null
          : Number(importoRecuperato),
      noteLegaliOperatori: note,
    }),
    [
      praticaId,
      strategia,
      procedura,
      professionista,
      attivita,
      agenda,
      documenti,
      statoProcedura,
      eventi,
      spese,
      esito,
      dataEsito,
      importoRecuperato,
      note,
    ]
  );

  function onSalva() {
    setError(null);
    setOk(null);
    startTransition(async () => {
      const result = await salvaStrategiaProceduraAction(payload);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOk(result.ok || "Strategia salvata");
      router.refresh();
    });
  }

  function onRegistraEsito() {
    setError(null);
    setOk(null);
    if (!esito) {
      setError("Seleziona l'esito");
      return;
    }
    if (!dataEsito) {
      setError("Indica la data esito");
      return;
    }
    startTransition(async () => {
      const result = await registraEsitoGiudizialeAction(payload);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOk(result.ok || "Esito registrato");
      if (result.redirectTo) {
        router.push(result.redirectTo);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <section className={sectionCls}>
        <h3 className="text-sm font-bold text-[var(--navy)]">
          Strategia e procedura
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Strategia scelta</label>
            <select
              className={fieldCls}
              value={strategia}
              disabled={disabled}
              onChange={(e) => setStrategia(e.target.value)}
            >
              <option value="">— Seleziona —</option>
              {STRATEGIE_SCELTE.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Professionista incaricato</label>
            <input
              className={fieldCls}
              value={professionista}
              disabled={disabled}
              onChange={(e) => setProfessionista(e.target.value)}
              placeholder="Avvocato / studio"
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Procedura da seguire</label>
          <textarea
            className={areaCls}
            rows={3}
            value={procedura}
            disabled={disabled}
            onChange={(e) => setProcedura(e.target.value)}
            placeholder="Passi operativi della procedura giudiziale"
          />
        </div>
      </section>

      <section className={sectionCls}>
        <h3 className="text-sm font-bold text-[var(--navy)]">
          Attività da eseguire
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[11px] uppercase text-[var(--muted)]">
                <th className="py-1.5 pr-2 font-semibold">Attività</th>
                <th className="py-1.5 pr-2 font-semibold">Stato</th>
                <th className="py-1.5 pr-2 font-semibold">Responsabile</th>
                <th className="py-1.5 font-semibold">Scadenza</th>
              </tr>
            </thead>
            <tbody>
              {ATTIVITA_PROCEDURA.map((a) => {
                const row = attivita[a.key];
                return (
                  <tr key={a.key} className="border-b border-[var(--line)]/60">
                    <td className="py-1.5 pr-2 font-medium text-[var(--navy)]">
                      {a.label}
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        className={fieldCls}
                        value={row?.stato || ""}
                        disabled={disabled}
                        onChange={(e) =>
                          patchAttivita(a.key, {
                            stato: e.target
                              .value as AttivitaProceduraMap[AttivitaProceduraKey]["stato"],
                          })
                        }
                      >
                        <option value="">—</option>
                        {STATI_ATTIVITA_PROCEDURA.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        className={fieldCls}
                        value={row?.responsabile || ""}
                        disabled={disabled}
                        onChange={(e) =>
                          patchAttivita(a.key, {
                            responsabile: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="py-1.5">
                      <input
                        type="date"
                        className={fieldCls}
                        value={row?.scadenza || ""}
                        disabled={disabled}
                        onChange={(e) =>
                          patchAttivita(a.key, { scadenza: e.target.value })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={sectionCls}>
        <h3 className="text-sm font-bold text-[var(--navy)]">
          Agenda, documenti e stato
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Stato della procedura</label>
            <select
              className={fieldCls}
              value={statoProcedura}
              disabled={disabled}
              onChange={(e) => setStatoProcedura(e.target.value)}
            >
              {STATI_PROCEDURA.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Agenda / scadenze</label>
          <textarea
            className={areaCls}
            rows={3}
            value={agenda}
            disabled={disabled}
            onChange={(e) => setAgenda(e.target.value)}
            placeholder="Scadenze processuali e appuntamenti"
          />
        </div>
        <div>
          <label className={labelCls}>Documenti da produrre</label>
          <textarea
            className={areaCls}
            rows={3}
            value={documenti}
            disabled={disabled}
            onChange={(e) => setDocumenti(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Eventi giudiziari / storico</label>
          <textarea
            className={areaCls}
            rows={4}
            value={eventi}
            disabled={disabled}
            onChange={(e) => setEventi(e.target.value)}
            placeholder="Cronologia eventi (deposito, notifica, udienza…)"
          />
        </div>
      </section>

      <SpeseGiudizialiEditor
        voci={spese}
        onChange={setSpese}
        disabled={disabled}
      />

      <section className={sectionCls}>
        <h3 className="text-sm font-bold text-[var(--navy)]">
          Esito / chiusura procedura
        </h3>
        <p className="text-[11px] text-[var(--muted)]">
          L&apos;importo recuperato è informativo. Gli incassi si registrano nella
          gestione Incassi della pratica.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelCls}>Esito</label>
            <select
              className={fieldCls}
              value={esito}
              disabled={disabled}
              onChange={(e) => setEsito(e.target.value)}
            >
              <option value="">— Non ancora definito —</option>
              {ESITI_GIUDIZIALI.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Data esito</label>
            <input
              type="date"
              className={fieldCls}
              value={dataEsito}
              disabled={disabled}
              onChange={(e) => setDataEsito(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Importo eventualmente recuperato €</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className={fieldCls}
              value={importoRecuperato}
              disabled={disabled}
              onChange={(e) => setImportoRecuperato(e.target.value)}
              placeholder="Opzionale"
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Note finali</label>
          <textarea
            className={areaCls}
            rows={3}
            value={note}
            disabled={disabled}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </section>

      {error ? (
        <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
      ) : null}
      {ok ? (
        <p className="text-sm font-semibold text-emerald-700">{ok}</p>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={onSalva}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Salvataggio…" : "Salva strategia / spese"}
          </button>
          <button
            type="button"
            disabled={disabled || !esito || !dataEsito}
            onClick={onRegistraEsito}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--navy)] bg-white px-4 text-sm font-semibold text-[var(--navy)] hover:bg-[#eef4f8] disabled:opacity-50"
          >
            Registra esito e chiudi
          </button>
        </div>
      ) : null}
    </div>
  );
}
