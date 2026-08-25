import Link from "next/link";
import { euro } from "@/lib/domain";
import type { SezioneProvvigioni } from "@/lib/provvigioniDisplay";
import {
  etichettaIncentiviCash,
  etichettaScaglioni,
  performancePerc,
  provvigioniCodiceLabelEntries,
  provvigioniMetodoLabelEntries,
  scaglioneProvvigioneAttuale,
} from "@/lib/provvigioniPerimetro";

export type ProvvigioneRigaLista = {
  id: string;
  praticaId: string;
  praticaNumero: string;
  debitoreNome: string;
  operatoreNome: string;
  data: string;
  baseImporto: number;
  percentuale: number;
  importo: number;
  stato: string;
  statoLabel: string;
  perimetro: string;
};

function RigaTabella({
  r,
  showOperatore,
}: {
  r: ProvvigioneRigaLista;
  showOperatore?: boolean;
}) {
  return (
    <tr className="border-t border-[var(--line)]">
      <td className="px-3 py-2 whitespace-nowrap">{r.data}</td>
      {showOperatore ? <td className="px-3 py-2">{r.operatoreNome}</td> : null}
      <td className="px-3 py-2">
        <Link className="text-[var(--accent)] underline" href={`/pratiche/${r.praticaId}`}>
          {r.praticaNumero}
        </Link>
      </td>
      <td className="px-3 py-2">{r.debitoreNome}</td>
      <td className="px-3 py-2 text-right tabular-nums">{euro(r.baseImporto)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{r.percentuale.toFixed(1)}%</td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums">{euro(r.importo)}</td>
      <td className="px-3 py-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
            r.stato === "LIQUIDATA"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {r.statoLabel}
        </span>
      </td>
    </tr>
  );
}

export function ProvvigioniPannelloEconomico({
  sez,
}: {
  sez: SezioneProvvigioni<ProvvigioneRigaLista>;
}) {
  const lato = sez.pagata;
  const metodi = lato ? provvigioniMetodoLabelEntries(lato) : [];
  const codici = lato ? provvigioniCodiceLabelEntries(lato, sez.codiciScarico) : [];
  const incentiviCash = lato ? etichettaIncentiviCash(lato) : [];
  const scaglioniLabel = lato ? etichettaScaglioni(lato) : [];
  const perf = {
    incassato: sez.incassatoMese,
    affidatoTotale: sez.affidatoTotale,
    affidatoPeriodo: sez.affidatoPeriodo,
  };
  const { attuale, prossimo } = lato
    ? scaglioneProvvigioneAttuale(perf, lato.scaglioni)
    : { attuale: null, prossimo: null };

  return (
    <div className="border-b border-[var(--line)] bg-[#f8fafc] px-3 py-3 text-xs">
      <div className="mb-2 grid gap-2 sm:grid-cols-3">
        <div className="rounded border border-[var(--line)] bg-white px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">Incassato mese</p>
          <p className="text-lg font-bold tabular-nums text-[var(--navy)]">
            {euro(sez.incassatoMese)}
          </p>
        </div>
        <div className="rounded border border-[var(--line)] bg-white px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
            Provvigioni mese
          </p>
          <p className="text-lg font-bold tabular-nums text-[var(--navy)]">
            {euro(sez.provvigioniMese)}
          </p>
        </div>
        <div className="rounded border border-[var(--line)] bg-white px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
            Provvigione base
          </p>
          <p className="text-lg font-bold tabular-nums text-[var(--navy)]">
            {lato?.provvigionePerc != null ? `${lato.provvigionePerc}%` : "—"}
          </p>
        </div>
      </div>

      {metodi.length ? (
        <div className="mb-2">
          <p className="mb-1 font-semibold text-[var(--navy)]">% per modalità incasso</p>
          <div className="flex flex-wrap gap-1.5">
            {metodi.map((m) => (
              <span
                key={m.metodo}
                className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[11px]"
              >
                {m.label}: <strong>{m.perc}%</strong>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {codici.length ? (
        <div className="mb-2">
          <p className="mb-1 font-semibold text-[var(--navy)]">% per codice scarico</p>
          <div className="flex flex-wrap gap-1.5">
            {codici.map((c) => (
              <span
                key={c.codice}
                className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[11px]"
              >
                {c.label}: <strong>{c.perc}%</strong>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {incentiviCash.length ? (
        <div className="mb-2">
          <p className="mb-1 font-semibold text-[var(--navy)]">Incentivi cash</p>
          <ul className="list-inside list-disc space-y-0.5 text-[var(--muted)]">
            {incentiviCash.map((testo, i) => (
              <li key={i}>{testo}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {lato?.scaglioni.length ? (
        <div className="mb-2">
          <p className="mb-1 font-semibold text-[var(--navy)]">Scaglioni provvigione</p>
          {scaglioniLabel.length ? (
            <ul className="mb-2 list-inside list-disc space-y-0.5 text-[11px] text-[var(--muted)]">
              {scaglioniLabel.map((testo, i) => (
                <li key={i}>{testo}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {lato?.scaglioni.length ? (
        <div>
          <p className="mb-1 font-semibold text-[var(--navy)]">
            Stato scaglioni (incassato {euro(sez.incassatoMese)}
            {sez.affidatoTotale > 0 ? ` · affidato ${euro(sez.affidatoTotale)}` : ""})
          </p>
          <div className="overflow-x-auto rounded border border-[var(--line)] bg-white">
            <table className="w-full text-[11px]">
              <thead className="bg-[#eef2f6] text-left text-[var(--muted)]">
                <tr>
                  <th className="px-2 py-1">Codice</th>
                  <th className="px-2 py-1">Base</th>
                  <th className="px-2 py-1">Soglia %</th>
                  <th className="px-2 py-1">Provv. %</th>
                  <th className="px-2 py-1">Raggiunta</th>
                  <th className="px-2 py-1">Stato</th>
                </tr>
              </thead>
              <tbody>
                {lato.scaglioni.map((s) => {
                  const raggiunta = performancePerc(s.base, perf, s.codiceScarico);
                  const isAttuale = attuale?.id === s.id;
                  const superato = raggiunta >= s.sogliaPerc;
                  return (
                    <tr
                      key={s.id}
                      className={`border-t border-[var(--line)] ${isAttuale ? "bg-[#eef4f8] font-semibold" : ""}`}
                    >
                      <td className="px-2 py-1 font-mono text-[10px]">
                        {s.codiceScarico || "Tutti"}
                      </td>
                      <td className="px-2 py-1">{s.base === "affidato" ? "Affidato" : "Incassato"}</td>
                      <td className="px-2 py-1 tabular-nums">{s.sogliaPerc}%</td>
                      <td className="px-2 py-1 tabular-nums">{s.provvigionePerc}%</td>
                      <td className="px-2 py-1 tabular-nums">{raggiunta.toFixed(1)}%</td>
                      <td className="px-2 py-1">
                        {isAttuale
                          ? "Attuale"
                          : superato
                            ? "Superato"
                            : prossimo?.id === s.id
                              ? "Prossimo"
                              : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {prossimo ? (
            <p className="mt-1 text-[10px] text-[var(--muted)]">
              Prossimo scaglione: {prossimo.sogliaPerc}% (
              {prossimo.base === "affidato" ? "su affidato" : "su incassato"}
              {prossimo.codiceScarico ? ` · cod. ${prossimo.codiceScarico}` : ""}) → provv.{" "}
              {prossimo.provvigionePerc}%
            </p>
          ) : null}
        </div>
      ) : !lato ? (
        <p className="text-[10px] text-[var(--muted)]">
          Regole economiche non configurate su Mandanti → Perimetri (lato pagato ai collaboratori).
        </p>
      ) : null}
    </div>
  );
}

export function ProvvigioniListaPerimetro({
  sezioni,
  showOperatore,
}: {
  sezioni: SezioneProvvigioni<ProvvigioneRigaLista>[];
  showOperatore?: boolean;
}) {
  const colspan = showOperatore ? 8 : 7;

  if (!sezioni.length) {
    return (
      <p className="rounded-lg border border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--muted)]">
        Nessuna provvigione nel mese selezionato.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {sezioni.map((sez) => (
        <section
          key={sez.perimetro}
          className="overflow-hidden rounded-xl border-2 border-[#1a4f7a]/25 bg-white shadow-sm"
        >
          <header className="border-b border-[#1a4f7a]/20 bg-[#1a4f7a] px-4 py-2.5 text-white">
            <p className="text-[10px] font-semibold uppercase tracking-widest opacity-90">
              Perimetro
            </p>
            <h3 className="text-base font-bold tracking-tight">
              {sez.perimetro}
              <span className="ml-2 text-sm font-normal opacity-90">
                · Mandato {sez.mandanteCodice}
              </span>
            </h3>
          </header>

          <ProvvigioniPannelloEconomico sez={sez} />

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  {showOperatore ? <th className="px-3 py-2">Operatore</th> : null}
                  <th className="px-3 py-2">Pratica</th>
                  <th className="px-3 py-2">Debitore</th>
                  <th className="px-3 py-2 text-right">Incasso</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2 text-right">Provvigione</th>
                  <th className="px-3 py-2">Stato</th>
                </tr>
              </thead>
              <tbody>
                {sez.righe.map((r) => (
                  <RigaTabella key={r.id} r={r} showOperatore={showOperatore} />
                ))}
                {!sez.righe.length ? (
                  <tr>
                    <td colSpan={colspan} className="px-3 py-4 text-center text-[var(--muted)]">
                      Nessun movimento in questo perimetro nel mese selezionato.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
