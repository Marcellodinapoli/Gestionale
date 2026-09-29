import type { AltriFiltri } from "@/lib/praticheAltriFiltriUi";
import {
  vociAltriFiltriAttivi,
  type AltriFiltroAttivoVoce,
} from "@/lib/praticheAltriFiltriUi";
import {
  formatDataIso,
  labelLavorateFascia,
  parseLavorateFascia,
  startOfToday,
} from "@/lib/lavorateOggiUi";
import { STATI_FILTRO_PRATICHE } from "@/lib/statoOperativoPratica";

function fmtDataIt(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("it-IT");
}

function labelStatoFiltro(stato?: string | null) {
  if (!stato) return null;
  return (
    STATI_FILTRO_PRATICHE.find((s) => s.value === stato)?.label ?? stato
  );
}

/** Tutti i filtri elenco pratiche (barra rapida + avanzati). */
export function vociFiltriPraticheAttivi(opts: {
  q?: string | null;
  stato?: string | null;
  lavorateDa?: string | null;
  lavorateA?: string | null;
  lavorateData?: string | null;
  lavorateOggi?: boolean;
  lavorateFascia?: string | null;
  nonToccateDa?: string | number | null;
  altri?: AltriFiltri;
  operatori?: Array<{ id: string; name: string; acronimo?: string | null }>;
  mandanti?: Array<{ id: string; codice: string; ragioneSociale: string }>;
}): AltriFiltroAttivoVoce[] {
  const voci: AltriFiltroAttivoVoce[] = [];
  const q = opts.q?.trim();
  if (q) {
    voci.push({ id: "q", campo: "anagrafica", valore: q });
  }
  const statoLabel = labelStatoFiltro(opts.stato);
  if (statoLabel) {
    voci.push({ id: "stato", campo: "stato", valore: statoLabel });
  }

  const da =
    opts.lavorateDa?.trim() ||
    (opts.lavorateOggi ? formatDataIso(startOfToday()) : undefined) ||
    opts.lavorateData?.trim() ||
    undefined;
  const a =
    opts.lavorateA?.trim() ||
    (opts.lavorateOggi ? formatDataIso(startOfToday()) : undefined) ||
    opts.lavorateData?.trim() ||
    undefined;
  const fascia = parseLavorateFascia(opts.lavorateFascia);

  if (da || a) {
    let valore = "";
    if (da && a) valore = `dal ${fmtDataIt(da)} al ${fmtDataIt(a)}`;
    else if (da) valore = `dal ${fmtDataIt(da)} in poi`;
    else if (a) valore = `fino al ${fmtDataIt(a)}`;
    if (fascia) valore += ` (${labelLavorateFascia(fascia)})`;
    voci.push({
      id: "lavorate",
      campo: "ultima lavorazione",
      valore,
    });
  } else if (fascia) {
    voci.push({
      id: "lavorate-fascia",
      campo: "fascia lavorazione",
      valore: labelLavorateFascia(fascia),
    });
  }

  const nonToccate = opts.nonToccateDa != null && String(opts.nonToccateDa).trim() !== ""
    ? String(opts.nonToccateDa).trim()
    : "";
  if (nonToccate) {
    voci.push({
      id: "non-toccate",
      campo: "dormienti",
      valore: `non aggiornate da ≥ ${nonToccate} giorni`,
    });
  }

  voci.push(
    ...vociAltriFiltriAttivi(opts.altri, {
      operatori: opts.operatori,
      mandanti: opts.mandanti,
    })
  );
  return voci;
}

export function PraticheFiltriAttiviRiepilogo(opts: {
  q?: string | null;
  stato?: string | null;
  lavorateDa?: string | null;
  lavorateA?: string | null;
  lavorateData?: string | null;
  lavorateOggi?: boolean;
  lavorateFascia?: string | null;
  nonToccateDa?: string | number | null;
  altri?: AltriFiltri;
  operatori?: Array<{ id: string; name: string; acronimo?: string | null }>;
  mandanti?: Array<{ id: string; codice: string; ragioneSociale: string }>;
  className?: string;
}) {
  const voci = vociFiltriPraticheAttivi(opts);
  if (!voci.length) {
    return (
      <p className={opts.className ?? "text-[11px] text-[var(--muted)]"}>
        Nessun filtro specifico oltre all&apos;elenco caricato.
      </p>
    );
  }

  return (
    <p className={opts.className ?? "text-[11px] text-[var(--muted)]"}>
      <span className="font-semibold text-[var(--navy)]">Filtri attivi:</span>{" "}
      {voci.map((v, i) => (
        <span key={v.id}>
          {i > 0 ? <span className="text-[var(--muted)]"> · </span> : null}
          <span>
            {v.campo}
            {v.op ? ` ${v.op}` : ""}{" "}
            <strong className="font-semibold text-[var(--navy)]">{v.valore}</strong>
            {v.suffisso ? (
              <span className="text-[var(--muted)]"> ({v.suffisso})</span>
            ) : null}
          </span>
        </span>
      ))}
    </p>
  );
}
