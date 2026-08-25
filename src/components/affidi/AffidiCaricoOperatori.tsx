import Link from "next/link";
import { euro } from "@/lib/domainFormat";
import { isPraticaChiusa } from "@/lib/praticaCollegata";

export const CODE_LAVORAZIONE = [
  { key: "AFFIDATA", label: "Affidate" },
  { key: "IN_LAVORAZIONE", label: "In lavorazione" },
  { key: "PROMESSA", label: "Promessa" },
  { key: "PIANO", label: "Piano" },
] as const;

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
  mandato?: string;
  perimetro?: string;
  sezione?: AffidiSezione;
};

export function buildAffidiHref(params?: AffidiNavParams): string {
  const sp = new URLSearchParams();
  if (params?.mandato) sp.set("mandato", params.mandato);
  if (params?.perimetro) sp.set("perimetro", encodeURIComponent(params.perimetro));
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
};

export function buildCaricoOperatori(
  operatori: Array<{ id: string; name: string; role: string }>,
  pratiche: PraticaAffido[],
  oggi = new Date()
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
    };
  });
}

export function AffidiCaricoOperatori({
  carico,
  selezionatoId,
  coda,
  nav,
}: {
  carico: OperatoreCarico[];
  selezionatoId?: string;
  coda?: CodaAffidi;
  nav?: Pick<AffidiNavParams, "mandato" | "perimetro">;
}) {
  const href = (operatore?: string, codaKey?: CodaAffidi) =>
    buildAffidiHref({ ...nav, operatore, coda: codaKey });
  const tot = (key: string) => carico.reduce((s, o) => s + (o.perStato[key] || 0), 0);
  const totAperte = carico.reduce((s, o) => s + o.totAperte, 0);
  const totScadute = carico.reduce((s, o) => s + o.scadute, 0);
  const totResiduo = carico.reduce((s, o) => s + o.residuo, 0);
  const totChiuse = carico.reduce((s, o) => s + o.totChiuse, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="text-left text-[var(--muted)]">
          <tr>
            <th className="py-2">Operatore</th>
            <th className="text-right">Aperte</th>
            {CODE_LAVORAZIONE.map((c) => (
              <th key={c.key} className="text-right">
                {c.label}
              </th>
            ))}
            <th className="text-right">Scadute</th>
            <th className="text-right">Residuo</th>
            <th className="text-right">Chiuse</th>
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
                <td className="text-right font-semibold">
                  <CountLink
                    n={o.totAperte}
                    href={href(o.id, "aperte")}
                    active={onOp && coda === "aperte"}
                  />
                </td>
                {CODE_LAVORAZIONE.map((c) => (
                  <td key={c.key} className="text-right">
                    <CountLink
                      n={o.perStato[c.key] || 0}
                      href={href(o.id, c.key)}
                      active={onOp && coda === c.key}
                    />
                  </td>
                ))}
                <td className="text-right">
                  <CountLink
                    n={o.scadute}
                    href={href(o.id, "scadute")}
                    active={onOp && coda === "scadute"}
                  />
                </td>
                <td className="text-right">
                  {o.totAperte ? (
                    <Link
                      href={href(o.id, "aperte")}
                      className={`underline ${onOp && coda === "aperte" ? "font-bold text-[var(--navy)]" : "text-[var(--accent)]"}`}
                    >
                      {euro(o.residuo)}
                    </Link>
                  ) : (
                    euro(o.residuo)
                  )}
                </td>
                <td className="text-right">
                  <CountLink
                    n={o.totChiuse}
                    href={href(o.id, "chiuse")}
                    active={onOp && coda === "chiuse"}
                    muted
                  />
                </td>
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
              <CountLink n={totAperte} href={href(undefined, "aperte")} active={!selezionatoId && coda === "aperte"} />
            </td>
            {CODE_LAVORAZIONE.map((c) => (
              <td key={c.key} className="text-right">
                <CountLink
                  n={tot(c.key)}
                  href={href(undefined, c.key)}
                  active={!selezionatoId && coda === c.key}
                />
              </td>
            ))}
            <td className="text-right">
              <CountLink n={totScadute} href={href(undefined, "scadute")} active={!selezionatoId && coda === "scadute"} />
            </td>
            <td className="text-right">
              {totAperte ? (
                <Link
                  href={href(undefined, "aperte")}
                  className={`underline ${!selezionatoId && coda === "aperte" ? "font-bold text-[var(--navy)]" : "text-[var(--accent)]"}`}
                >
                  {euro(totResiduo)}
                </Link>
              ) : (
                euro(totResiduo)
              )}
            </td>
            <td className="text-right">
              <CountLink
                n={totChiuse}
                href={href(undefined, "chiuse")}
                active={!selezionatoId && coda === "chiuse"}
                muted
              />
            </td>
          </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}