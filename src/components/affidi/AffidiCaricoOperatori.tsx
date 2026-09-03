import Link from "next/link";
import { isPraticaChiusa } from "@/lib/praticaCollegata";
import {
  CODICI_SCARICO,
  CODICE_SCARICO_LABELS,
  type CodiceScarico,
} from "@/lib/scarico";
import type { CodiciScaricoOperatore } from "@/lib/homeKpi/codiciScaricoAdmin";

export const CODE_LAVORAZIONE = [
  { key: "AFFIDATA", label: "Affidate" },
  { key: "IN_LAVORAZIONE", label: "In lavorazione" },
  { key: "PROMESSA", label: "Promessa" },
  { key: "PIANO", label: "Piano" },
] as const;

const COL_CARICO = "IN_LAVORAZIONE" as const;

export type CodaAffidi =
  | "aperte"
  | "chiuse"
  | "scadute"
  | (typeof CODE_LAVORAZIONE)[number]["key"];

export function parseCodaAffidi(value?: string | null): CodaAffidi | undefined {
  if (!value) return undefined;
  if (value === "aperte" || value === "chiuse" || value === "scadute") return value;
  if (CODE_LAVORAZIONE.some((c) => c.key === value)) return value as CodaAffidi;
  return undefined;
}

export function etichettaCodaAffidi(coda?: CodaAffidi) {
  if (!coda) return "tutte";
  if (coda === "aperte") return "aperte";
  if (coda === "chiuse") return "chiuse";
  if (coda === "scadute") return "scadute";
  return CODE_LAVORAZIONE.find((c) => c.key === coda)?.label.toLowerCase() || coda;
}

export type AffidiSezione = "affida";

export type AffidiNavParams = {
  operatore?: string;
  coda?: CodaAffidi;
  /** Filtri monitoraggio / elenco pratiche in basso */
  mandato?: string;
  perimetro?: string;
  /** Filtri incassi e carico operatori */
  caricoMandato?: string;
  caricoPerimetro?: string;
  caricoMese?: string;
  sezione?: AffidiSezione;
};

export function buildAffidiHref(params?: AffidiNavParams): string {
  const sp = new URLSearchParams();
  if (params?.mandato) sp.set("mandato", params.mandato);
  if (params?.perimetro) sp.set("perimetro", params.perimetro);
  if (params?.caricoMandato) sp.set("caricoMandato", params.caricoMandato);
  if (params?.caricoPerimetro) sp.set("caricoPerimetro", params.caricoPerimetro);
  if (params?.caricoMese) sp.set("caricoMese", params.caricoMese);
  if (params?.operatore) sp.set("operatore", params.operatore);
  if (params?.coda) sp.set("coda", params.coda);
  if (params?.sezione) sp.set("sezione", params.sezione);
  const qs = sp.toString();
  return qs ? `/affidi?${qs}` : "/affidi";
}

/** URL padre in Affidi (sottoviste con filtri in query string). */
export { affidiBackHrefFromSearch, resolveAffidiBackNav } from "@/lib/affidiNavBack";

export function filtraPraticheAffido(
  pratiche: PraticaAffido[],
  opts: { operatoreId?: string; coda?: CodaAffidi },
  oggi = new Date()
) {
  let rows = opts.operatoreId
    ? pratiche.filter(
        (p) =>
          p.assegnatarioId === opts.operatoreId ||
          p.operatoreTitolareId === opts.operatoreId
      )
    : pratiche;
  if (opts.coda === "aperte") rows = rows.filter((p) => !isPraticaChiusa(p.stato));
  else if (opts.coda === "chiuse") rows = rows.filter((p) => isPraticaChiusa(p.stato));
  else if (opts.coda === "scadute") {
    rows = rows.filter(
      (p) => !isPraticaChiusa(p.stato) && p.scadenza && p.scadenza <= oggi
    );
  } else if (opts.coda) {
    rows = rows.filter((p) => p.stato === opts.coda);
  }
  return rows;
}

function CountLink({
  n,
  href,
  active,
  muted,
}: {
  n: number;
  href: string;
  active?: boolean;
  muted?: boolean;
}) {
  if (!n) {
    return <span className={muted ? "text-[var(--muted)]" : ""}>0</span>;
  }
  return (
    <Link
      href={href}
      className={`cursor-pointer underline ${
        active ? "font-bold text-[var(--navy)]" : "text-[var(--accent)]"
      } ${muted ? "text-[var(--muted)]" : ""}`}
    >
      {n}
    </Link>
  );
}

export type PraticaAffido = {
  id: string;
  numero: string;
  stato: string;
  residuo: number;
  scadenza: Date | null;
  codiceScarico: string | null;
  mandanteId: string;
  numeroMandante: string | null;
  debitore: { nome: string; cognome: string };
  mandante: { codice: string };
  assegnatarioId: string | null;
  assegnatario: { id: string; name: string } | null;
  operatoreTitolareId: string | null;
  operatoreTitolare: { id: string; name: string } | null;
};

export type OperatoreCarico = {
  id: string;
  name: string;
  role: string;
  totAperte: number;
  totChiuse: number;
  scadute: number;
  residuo: number;
  perStato: Record<string, number>;
  scarichi?: CodiciScaricoOperatore;
  incassatoMese?: number;
  guadagnoMese?: number;
};

function ScaricoCell({ oggi, mese }: { oggi: number; mese: number }) {
  return (
    <span className="tabular-nums">
      <span className={oggi ? "" : "text-[var(--muted)]"}>{oggi}</span>
      <span className="text-[var(--muted)]"> / </span>
      <span className={mese ? "font-semibold text-[var(--navy)]" : "text-[var(--muted)]"}>
        {mese}
      </span>
    </span>
  );
}

function valoriScarico(
  scarichi: CodiciScaricoOperatore | undefined,
  codice: CodiceScarico
) {
  return scarichi?.[codice] ?? { oggi: 0, mese: 0 };
}

function emptyScarichiOperatore(): CodiciScaricoOperatore {
  return Object.fromEntries(
    CODICI_SCARICO.map((codice) => [codice, { oggi: 0, mese: 0 }])
  ) as CodiciScaricoOperatore;
}

export function buildCaricoOperatori(
  operatori: Array<{ id: string; name: string; role: string }>,
  pratiche: PraticaAffido[],
  oggi = new Date(),
  scarichiPerOperatore?: Record<string, CodiciScaricoOperatore>,
  incassatoPerOperatore?: Record<string, number>,
  guadagnoPerOperatore?: Record<string, number>
): OperatoreCarico[] {
  return operatori.map((op) => {
    const sue = pratiche.filter((p) => p.assegnatarioId === op.id);
    const aperte = sue.filter((p) => !isPraticaChiusa(p.stato));
    const perStato: Record<string, number> = {};
    for (const p of sue) {
      perStato[p.stato] = (perStato[p.stato] || 0) + 1;
    }
    return {
      id: op.id,
      name: op.name,
      role: op.role,
      totAperte: aperte.length,
      totChiuse: sue.length - aperte.length,
      scadute: aperte.filter((p) => p.scadenza && p.scadenza <= oggi).length,
      residuo: aperte.reduce((s, p) => s + p.residuo, 0),
      perStato,
      ...(scarichiPerOperatore
        ? { scarichi: scarichiPerOperatore[op.id] ?? emptyScarichiOperatore() }
        : {}),
      ...(incassatoPerOperatore
        ? { incassatoMese: incassatoPerOperatore[op.id] ?? 0 }
        : {}),
      ...(guadagnoPerOperatore
        ? { guadagnoMese: guadagnoPerOperatore[op.id] ?? 0 }
        : {}),
    };
  });
}

export function AffidiCaricoOperatori({
  carico,
  selezionatoId,
  coda,
  nav,
  meseLabel,
  scarichiGruppo,
}: {
  carico: OperatoreCarico[];
  selezionatoId?: string;
  coda?: CodaAffidi;
  nav?: Pick<
    AffidiNavParams,
    "mandato" | "perimetro" | "caricoMandato" | "caricoPerimetro" | "caricoMese" | "operatore" | "coda"
  >;
  meseLabel?: string;
  scarichiGruppo?: CodiciScaricoOperatore;
}) {
  const mostraScarichi = Boolean(scarichiGruppo) || carico.some((o) => o.scarichi);
  const href = (operatore?: string, codaKey?: CodaAffidi) =>
    buildAffidiHref({ ...nav, operatore, coda: codaKey });
  const totInLavorazione = carico.reduce(
    (s, o) => s + (o.perStato[COL_CARICO] || 0),
    0
  );
  const totScarico = (codice: CodiceScarico) => {
    if (scarichiGruppo) return scarichiGruppo[codice] ?? { oggi: 0, mese: 0 };
    return carico.reduce(
      (acc, o) => {
        const v = valoriScarico(o.scarichi, codice);
        return { oggi: acc.oggi + v.oggi, mese: acc.mese + v.mese };
      },
      { oggi: 0, mese: 0 }
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead className="text-left text-[var(--muted)]">
          <tr>
            <th className="py-2">Operatore</th>
            <th className="text-right">In lavorazione</th>
            {mostraScarichi
              ? CODICI_SCARICO.map((codice) => (
                  <th
                    key={codice}
                    className="text-right"
                    title={CODICE_SCARICO_LABELS[codice]}
                  >
                    <span className="block font-mono">{codice}</span>
                    <span className="text-[9px] font-normal normal-case">
                      oggi / {meseLabel ?? "mese"}
                    </span>
                  </th>
                ))
              : null}
          </tr>
        </thead>
        <tbody>
          {carico.map((o) => {
            const onOp = selezionatoId === o.id;
            if (selezionatoId && !onOp) return null;
            return (
              <tr
                key={o.id}
                className={`border-t border-[var(--line)] ${onOp ? "bg-[#eef4f8]" : ""}`}
              >
                <td className="py-2">
                  <Link
                    href={href(o.id)}
                    className={`font-medium ${onOp && !coda ? "text-[var(--navy)]" : "text-[var(--accent)] underline"}`}
                  >
                    {o.name}
                  </Link>
                  {o.role === "SUPERVISOR" ? (
                    <span className="ml-1 text-[10px] text-[var(--muted)]">supervisor</span>
                  ) : null}
                </td>
                <td className="text-right">
                  <CountLink
                    n={o.perStato[COL_CARICO] || 0}
                    href={href(o.id, COL_CARICO)}
                    active={onOp && coda === COL_CARICO}
                  />
                </td>
                {mostraScarichi
                  ? CODICI_SCARICO.map((codice) => {
                      const v = valoriScarico(o.scarichi, codice);
                      return (
                        <td key={codice} className="text-right text-xs">
                          <ScaricoCell oggi={v.oggi} mese={v.mese} />
                        </td>
                      );
                    })
                  : null}
              </tr>
            );
          })}
          {!selezionatoId ? (
          <tr className="border-t-2 border-[#132033] font-semibold">
            <td className="py-2">
              <Link href={buildAffidiHref(nav)} className="hover:underline">
                Totale gruppo
              </Link>
            </td>
            <td className="text-right">
              <CountLink
                n={totInLavorazione}
                href={href(undefined, COL_CARICO)}
                active={!selezionatoId && coda === COL_CARICO}
              />
            </td>
            {mostraScarichi
              ? CODICI_SCARICO.map((codice) => {
                  const v = totScarico(codice);
                  return (
                    <td key={codice} className="text-right text-xs">
                      <ScaricoCell oggi={v.oggi} mese={v.mese} />
                    </td>
                  );
                })
              : null}
          </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}