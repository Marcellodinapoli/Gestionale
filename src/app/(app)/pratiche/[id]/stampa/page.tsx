import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { praticaDbFromUser, idsAffidoTemporaneoForTenant, idsImportoTotaleForTenant, idsTotIncassatoForTenant, type PraticaDbContext } from "@/lib/praticheRepo";
import { requireUser } from "@/lib/guard";
import { STATO_LABELS } from "@/lib/permissions";
import { canAccessPratica, euro, dataIt, dataOraIt, importoIt } from "@/lib/domain";
import { formatNotaLine } from "@/lib/noteFormat";
import { esitoContattoLabel, tipoContattoLabel } from "@/lib/contatto";
import { EstrattoContoPreview } from "@/components/pratica/EstrattoContoPreview";
import { IncassiPreview } from "@/components/pratica/IncassiPreview";
import { StampaAnteprima } from "@/components/pratica/StampaAnteprima";

export default async function StampaPraticaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const praticaModel = praticaDbFromUser(user);
  const { id } = await params;
  if (!(await canAccessPratica(user, id))) notFound();

  const pratica = await praticaModel.findUnique({
    where: { id },
    include: {
      debitore: {
        include: { recapiti: { orderBy: [{ tipo: "asc" }, { ordine: "asc" }] } },
      },
      mandante: true,
      assegnatario: true,
      attivita: { include: { user: true }, orderBy: { createdAt: "asc" } },
      garanti: { orderBy: { ordine: "asc" } },
      fatture: { orderBy: { dataFattura: "asc" } },
      incassi: { include: { user: true }, orderBy: { data: "asc" } },
    },
  });
  if (!pratica) notFound();

  const praticaOk = pratica;
  const d = praticaOk.debitore;
  const totale = praticaOk.capitale + praticaOk.interessi + praticaOk.spese;
  const indirizzo = [d.indirizzo, [d.cap, d.citta, d.provincia].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" — ");
  const fatturePagate = praticaOk.fatture.filter((f) => f.importo - f.pagato <= 0.009);
  const fattureAperte = praticaOk.fatture.filter((f) => f.importo - f.pagato > 0.009);

  function FattureTable({
    title,
    rows,
  }: {
    title: string;
    rows: typeof praticaOk.fatture;
  }) {
    const totImp = rows.reduce((s, f) => s + f.importo, 0);
    const totPag = rows.reduce((s, f) => s + f.pagato, 0);
    return (
      <div className="mb-4">
        <h3 className="mb-1 text-xs font-bold uppercase">{title}</h3>
        <table className="w-full min-w-[640px] border-collapse text-left font-mono text-[13px]">
          <thead>
            <tr className="border-y border-[#132033]">
              <th className="py-0.5 pr-3">Num.Fatt.</th>
              <th className="py-0.5 pr-3">Causale</th>
              <th className="py-0.5 pr-3">Data Fat.</th>
              <th className="py-0.5 pr-3">Data Scad.</th>
              <th className="py-0.5 pr-3 text-right">Importo</th>
              <th className="py-0.5 pr-3 text-right">Pagato</th>
              <th className="py-0.5 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <td className="pr-3">{f.numero}</td>
                <td className="pr-3">{f.causale || "—"}</td>
                <td className="pr-3">{dataIt(f.dataFattura)}</td>
                <td className="pr-3">{dataIt(f.dataScadenza)}</td>
                <td className="pr-3 text-right">{importoIt(f.importo)}</td>
                <td className="pr-3 text-right">{importoIt(f.pagato)}</td>
                <td className="text-right">{importoIt(f.importo - f.pagato)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="py-2 text-[var(--muted)]">
                  Nessuna fattura in questo gruppo.
                </td>
              </tr>
            ) : null}
          </tbody>
          {rows.length ? (
            <tfoot>
              <tr className="border-t border-[#132033] font-semibold">
                <td colSpan={4}>Totale</td>
                <td className="pr-3 text-right">{importoIt(totImp)}</td>
                <td className="pr-3 text-right">{importoIt(totPag)}</td>
                <td className="text-right">{importoIt(totImp - totPag)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    );
  }

  return (
    <StampaAnteprima praticaId={pratica.id}>
      <div className="text-[13px] leading-5 text-[#132033]">
        <header className="mb-4 border-b border-[#132033] pb-2">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
            Credixa
          </p>
          <h1 className="text-xl font-semibold">
            Pratica {pratica.numero}
            {pratica.numeroMandante ? ` · Pr ${pratica.numeroMandante}` : ""}
          </h1>
          <p>
            {d.cognome} {d.nome} · {STATO_LABELS[pratica.stato] || pratica.stato}
          </p>
        </header>

        <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1">
          <p>
            <span className="font-semibold">Mandante:</span> {pratica.mandante.ragioneSociale} (
            {pratica.mandante.codice})
          </p>
          <p>
            <span className="font-semibold">Affidatario:</span> {pratica.assegnatario?.name || "—"}
          </p>
          <p>
            <span className="font-semibold">Affido:</span> {dataIt(pratica.dataAffido) || "—"}
          </p>
          <p>
            <span className="font-semibold">Scadenza:</span> {dataIt(pratica.scadenza) || "—"}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-x-8">
          <div>
            <h2 className="mb-1 text-xs font-bold uppercase">Debitore</h2>
            <p className="font-semibold">
              {d.cognome} {d.nome}
            </p>
            <p>CF {d.codiceFiscale || "—"}</p>
            <p>{indirizzo || "—"}</p>
            <p>
              Tel. {d.telefono || "—"} · E-mail {d.email || "—"}
            </p>
            {d.recapiti.length ? (
              <p>
                Altri recapiti: {d.recapiti.map((r) => `${r.tipo} ${r.valore}`).join(" · ")}
              </p>
            ) : null}
          </div>
          <div>
            <h2 className="mb-1 text-xs font-bold uppercase">Garante</h2>
            {pratica.garanti.length ? (
              pratica.garanti.map((g, i) => {
                const indG = [
                  g.indirizzo,
                  [g.cap, g.citta, g.provincia].filter(Boolean).join(" "),
                ]
                  .filter(Boolean)
                  .join(" — ");
                return (
                  <div key={g.id} className={i > 0 ? "mt-2" : ""}>
                    <p className="font-semibold">
                      {pratica.garanti.length > 1 ? `${i + 1}. ` : ""}
                      {g.cognome} {g.nome}
                    </p>
                    <p>CF {g.codiceFiscale || "—"}</p>
                    <p>{indG || "—"}</p>
                    <p>
                      Tel. {g.telefono || "—"} · E-mail {g.email || "—"}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="italic text-[var(--muted)]">Nessun garante</p>
            )}
          </div>
        </div>

        <section className="mb-5">
          <h2 className="mb-1 text-xs font-bold uppercase">Situazione debito</h2>
          <p>
            Res. {euro(pratica.residuo)} · Cap. {euro(pratica.capitale)} · Int.{" "}
            {euro(pratica.interessi)} · Spese {euro(pratica.spese)} · Tot. {euro(totale)}
          </p>
          {pratica.esitoContatto || pratica.tipoContatto ? (
            <p className="mt-1">
              Esito: {esitoContattoLabel(pratica.esitoContatto)} · Tipo:{" "}
              {tipoContattoLabel(pratica.tipoContatto)}
              {pratica.memoAt ? ` · Memo: ${dataOraIt(pratica.memoAt)}` : ""}
            </p>
          ) : null}
        </section>

        <section className="mb-5">
          <h2 className="mb-2 border-b border-[#132033] pb-0.5 text-xs font-bold uppercase">
            Estratto conto
          </h2>
          <EstrattoContoPreview
            flow
            debitore={d}
            numero={pratica.numero}
            creditore={pratica.mandante.ragioneSociale}
            societa={pratica.mandante.codice}
            scadenza={pratica.scadenza}
            fatture={pratica.fatture}
            incassi={pratica.incassi}
            affidato={totale}
            definito={pratica.residuo}
          />
        </section>

        <section className="mb-5">
          <h2 className="mb-2 border-b border-[#132033] pb-0.5 text-xs font-bold uppercase">
            Fatture
          </h2>
          <FattureTable title="Fatture pagate" rows={fatturePagate} />
          <FattureTable title="Fatture insolute / aperte" rows={fattureAperte} />
        </section>

        <section className="mb-5">
          <h2 className="mb-2 border-b border-[#132033] pb-0.5 text-xs font-bold uppercase">
            Incassi
          </h2>
          <IncassiPreview flow incassi={pratica.incassi} />
        </section>

        <section>
          <h2 className="mb-2 border-b border-[#132033] pb-0.5 text-xs font-bold uppercase">
            Registro note
          </h2>
          {pratica.attivita.length ? (
            <ul className="space-y-0.5 font-mono text-[12px]">
              {pratica.attivita.map((a) => (
                <li key={a.id}>
                  {formatNotaLine({
                    userName: a.user.name,
                    createdAt: a.createdAt,
                    tipo: a.tipo,
                    esito: a.esito,
                    nota: a.nota,
                  })}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">Nessuna nota registrata.</p>
          )}
        </section>
      </div>
    </StampaAnteprima>
  );
}
