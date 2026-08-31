import Link from "next/link";
import { euro } from "@/lib/domainFormat";
import { isImportoFissoProvvigioneId } from "@/lib/provvigioniImportoFisso";
import type { SezioneProvvigioni } from "@/lib/provvigioniDisplay";
import {
  etichettaIncentiviCash,
  etichettaScaglione,
  mancanoPezziPerScaglione,
  performancePerc,
  provvigionePercEffettiva,
  provvigioniCodiceLabelEntries,
  provvigioniMetodoLabelEntries,
  scaglioneProvvigioneAttuale,
} from "@/lib/provvigioniPerimetroUi";
import type { ScaglioneProvvigione } from "@/lib/mandantePerimetri";

function pillsProvvigioniScaglione(
  scaglione: ScaglioneProvvigione,
  codici: ReturnType<typeof provvigioniCodiceLabelEntries>
) {
  const target = scaglione.codiceScarico?.trim().toUpperCase() || null;
  if (codici.length) {
    return codici.map((c) => ({
      key: c.codice,
      label: c.label,
      perc: target && c.codice.toUpperCase() === target ? scaglione.provvigionePerc : c.perc,
    }));
  }
  return [
    {
      key: "scaglione",
      label: "Provvigione scaglione",
      perc: scaglione.provvigionePerc,
    },
  ];
}

function ProvvigioniIncentivoPills({ labels }: { labels: string[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {labels.map((testo, i) => (
        <span
          key={i}
          className="rounded-full border-2 border-violet-400 bg-white px-2 py-0.5 text-[11px] font-semibold text-violet-950"
        >
          {testo}
        </span>
      ))}
    </div>
  );
}

function ProvvigioniCodicePills({
  items,
  variant,
}: {
  items: { key: string; label: string; perc: number }[];
  variant: "attivo" | "successivo";
}) {
  const cls =
    variant === "attivo"
      ? "border-2 border-emerald-400 font-semibold text-emerald-900"
      : "border-2 border-amber-400 font-semibold text-amber-950";
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((c) => (
        <span
          key={c.key}
          className={`rounded-full border-2 bg-white px-2 py-0.5 text-[11px] ${cls}`}
        >
          {c.label}: <strong>{c.perc}%</strong>
        </span>
      ))}
    </div>
  );
}

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
  codiceScarico: string;
};

function RigaTabella({
  r,
  showOperatore,
}: {
  r: ProvvigioneRigaLista;
  showOperatore?: boolean;
}) {
  const fisso = isImportoFissoProvvigioneId(r.id);
  return (
    <tr className="border-t border-[var(--line)]">
      <td className="px-3 py-2">{r.perimetro}</td>
      <td className="px-3 py-2 whitespace-nowrap">{r.data}</td>
      {showOperatore ? <td className="px-3 py-2">{r.operatoreNome}</td> : null}
      <td className="px-3 py-2 font-mono text-xs">{r.codiceScarico}</td>
      <td className="px-3 py-2">
        {fisso || !r.praticaId ? (
          <span className="text-[var(--muted)]">{r.praticaNumero}</span>
        ) : (
          <Link className="text-[var(--accent)] underline" href={`/pratiche/${r.praticaId}`}>
            {r.praticaNumero}
          </Link>
        )}
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
  if (sez.perimetro === "Compenso fisso") {
    return (
      <div className="border-b border-[var(--line)] px-4 py-3 text-xs text-[var(--muted)]">
        Retribuzione fissa mensile configurata sull&apos;operatore, oltre alle provvigioni variabili.
      </div>
    );
  }

  const lato = sez.pagata;
  const metodi = lato ? provvigioniMetodoLabelEntries(lato) : [];
  const codici = lato ? provvigioniCodiceLabelEntries(lato, sez.codiciScarico) : [];
  const incentiviCash = lato ? etichettaIncentiviCash(lato) : [];
  const perf = {
    incassato: sez.incassatoMese,
    affidatoTotale: sez.performance?.affidatoTotale ?? sez.affidatoTotale,
    affidatoPeriodo: sez.performance?.affidatoPeriodo ?? sez.affidatoPeriodo,
    pezziAffido: sez.performance?.pezziAffido,
    perCodice: sez.performance?.perCodice,
  };
  const { attuale, prossimo } = lato
    ? scaglioneProvvigioneAttuale(perf, lato.scaglioni)
    : { attuale: null, prossimo: null };
  const provvigioneEffettiva = lato ? provvigionePercEffettiva(lato, perf) : 0;
  const raggiuntaProssimo = prossimo
    ? performancePerc(prossimo.base, perf, prossimo.codiceScarico)
    : 0;
  const mancaPezzi = prossimo ? mancanoPezziPerScaglione(prossimo, perf) : null;
  const scaglioneBaseAttivo = Boolean(lato?.scaglioni.length && !attuale);
  const scaglioneCodiciAttivo = scaglioneBaseAttivo && codici.length > 0;
  const scaglioneAttualeEvidenziato = scaglioneCodiciAttivo || Boolean(attuale);
  const mostraGrigliaScaglioni = Boolean(lato?.scaglioni.length);

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

      {codici.length && !mostraGrigliaScaglioni ? (
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

      {mostraGrigliaScaglioni ? (
        <div className="mb-2 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          <div
            className={`rounded-lg border-2 px-2.5 py-2 ${
              scaglioneAttualeEvidenziato
                ? "border-emerald-400 bg-emerald-50/80"
                : "border-[var(--line)] bg-white"
            }`}
          >
            <p
              className={`mb-1 font-semibold ${
                scaglioneAttualeEvidenziato ? "text-emerald-900" : "text-[var(--navy)]"
              }`}
            >
              Scaglione attuale
            </p>
            {scaglioneCodiciAttivo ? (
              <>
                <ProvvigioniCodicePills items={codici.map((c) => ({ ...c, key: c.codice }))} variant="attivo" />
                <p className="mt-1 text-[10px] text-emerald-800">
                  Effettiva nel periodo: {provvigioneEffettiva.toFixed(1)}%
                </p>
              </>
            ) : attuale ? (
              <>
                <p className="font-semibold text-emerald-900">{etichettaScaglione(attuale)}</p>
                {codici.length ? (
                  <ProvvigioniCodicePills
                    items={pillsProvvigioniScaglione(attuale, codici)}
                    variant="attivo"
                  />
                ) : null}
                <p className="mt-1 text-[10px] text-emerald-800">
                  Effettiva nel periodo: {provvigioneEffettiva.toFixed(1)}%
                </p>
              </>
            ) : scaglioneBaseAttivo ? (
              <p className="text-lg font-bold tabular-nums text-[var(--navy)]">
                {lato?.provvigionePerc != null ? `${lato.provvigionePerc}%` : "—"}
              </p>
            ) : (
              <p className="text-[11px] text-[var(--muted)]">—</p>
            )}
          </div>

          <div
            className={`rounded-lg border-2 px-2.5 py-2 ${
              prossimo ? "border-amber-400 bg-amber-50/80" : "border-[var(--line)] bg-white"
            }`}
          >
            <p
              className={`mb-1 font-semibold ${
                prossimo ? "text-amber-950" : "text-[var(--navy)]"
              }`}
            >
              Scaglione successivo
            </p>
            {prossimo ? (
              <>
                <p className="font-semibold text-amber-950">{etichettaScaglione(prossimo)}</p>
                <p className="mt-1 text-[10px] text-amber-900">
                  Avanzamento {raggiuntaProssimo.toFixed(1)}% / {prossimo.sogliaPerc}%
                  {mancaPezzi ? (
                    <>
                      {" "}
                      ({mancaPezzi.attuali}/{mancaPezzi.pezziAffido} affido pratiche) · mancano{" "}
                      <strong>{mancaPezzi.mancano}</strong> {mancaPezzi.codice}
                    </>
                  ) : (
                    <> · mancano {(prossimo.sogliaPerc - raggiuntaProssimo).toFixed(1)} punti</>
                  )}
                </p>
                <ProvvigioniCodicePills
                  items={pillsProvvigioniScaglione(prossimo, codici)}
                  variant="successivo"
                />
              </>
            ) : attuale ? (
              <p className="text-[11px] text-[var(--muted)]">Tutti gli scaglioni raggiunti.</p>
            ) : (
              <p className="text-[11px] text-[var(--muted)]">—</p>
            )}
          </div>

          <div
            className={`rounded-lg border-2 px-2.5 py-2 ${
              incentiviCash.length
                ? "border-violet-400 bg-violet-50/80"
                : "border-[var(--line)] bg-white"
            }`}
          >
            <p
              className={`mb-1 font-semibold ${
                incentiviCash.length ? "text-violet-950" : "text-[var(--navy)]"
              }`}
            >
              Eventuale incentivo
            </p>
            {incentiviCash.length ? (
              <ProvvigioniIncentivoPills labels={incentiviCash} />
            ) : (
              <p className="text-[11px] text-[var(--muted)]">Nessun incentivo configurato.</p>
            )}
          </div>
        </div>
      ) : !lato ? (
        <p className="text-[10px] text-[var(--muted)]">
          Regole economiche non configurate su Mandanti → Perimetri (lato pagato ai collaboratori).
        </p>
      ) : null}

      {incentiviCash.length && !mostraGrigliaScaglioni ? (
        <div className="mb-2">
          <p className="mb-1 font-semibold text-[var(--navy)]">Incentivi cash</p>
          <ul className="list-inside list-disc space-y-0.5 text-[var(--muted)]">
            {incentiviCash.map((testo, i) => (
              <li key={i}>{testo}</li>
            ))}
          </ul>
        </div>
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
  const colspan = (showOperatore ? 10 : 9);

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
                  <th className="px-3 py-2">Perimetro</th>
                  <th className="px-3 py-2">Data</th>
                  {showOperatore ? <th className="px-3 py-2">Operatore</th> : null}
                  <th className="px-3 py-2">Codice scarico</th>
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
