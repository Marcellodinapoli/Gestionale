import { notFound } from "next/navigation";
import { mandantiDbFromUser } from "@/lib/mandantiRepo";
import { requirePermission } from "@/lib/guard";
import { euro } from "@/lib/domainFormat";
import { metodoIncassoLabel } from "@/lib/metodoIncasso";
import {
  SCAGLIONE_BASE_LABELS,
  emptyLatoEconomico,
  etichettaPerimetro,
  hasPdrFasceConfigurate,
  hasPagamentiIntestazioni,
  hasStralcioVincoli,
  loadPerimetriForEditor,
  type LatoEconomico,
  type MandantePerimetro,
  type PagamentiIntestazioniPerimetro,
} from "@/lib/mandantePerimetri";
import { StampaAnteprima } from "@/components/pratica/StampaAnteprima";

export type DestinatarioStampaMandante = "admin" | "operatore" | "consulente";

const DESTINATARIO_LABEL: Record<DestinatarioStampaMandante, string> = {
  admin: "Amministrazione / Admin",
  operatore: "Operatore",
  consulente: "Consulente",
};

function parseDestinatario(raw: string | undefined): DestinatarioStampaMandante {
  if (raw === "operatore" || raw === "consulente" || raw === "admin") return raw;
  return "admin";
}

function dash(v: string | null | undefined) {
  const t = (v || "").trim();
  return t || "—";
}

function Dl({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  const shown = items.filter((i) => i.value && i.value !== "—");
  if (!shown.length) {
    return <p className="text-xs text-[var(--muted)]">Nessun dato compilato.</p>;
  }
  return (
    <dl className="grid grid-cols-[minmax(9rem,auto)_1fr] gap-x-3 gap-y-0.5 text-[12px]">
      {shown.map((i) => (
        <div key={i.label} className="contents">
          <dt className="font-semibold text-[#445566]">{i.label}</dt>
          <dd className="whitespace-pre-wrap break-words">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function LatoBlock({ title, lato }: { title: string; lato: LatoEconomico }) {
  const metodi = Object.entries(lato.provvigioniMetodo || {}).filter(
    ([, v]) => v != null && Number.isFinite(v)
  );
  const codici = Object.entries(lato.provvigioniCodice || {}).filter(
    ([, v]) => v != null && Number.isFinite(v)
  );
  const has =
    lato.provvigionePerc != null ||
    metodi.length > 0 ||
    codici.length > 0 ||
    lato.scaglioni.length > 0 ||
    lato.incentivi.length > 0;
  if (!has) return null;

  return (
    <div className="mt-2">
      <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide">
        {title}
      </h4>
      <ul className="space-y-0.5 text-[12px]">
        {lato.provvigionePerc != null ? (
          <li>Provvigione base: {lato.provvigionePerc}%</li>
        ) : null}
        {metodi.map(([k, v]) => (
          <li key={k}>
            Provvigione {metodoIncassoLabel(k)}: {v}%
          </li>
        ))}
        {codici.map(([k, v]) => (
          <li key={k}>
            Provvigione codice {k}: {v}%
          </li>
        ))}
        {lato.scaglioni.map((s) => (
          <li key={s.id}>
            Scaglione {SCAGLIONE_BASE_LABELS[s.base]}
            {s.codiceScarico ? ` · codice ${s.codiceScarico}` : ""}: soglia{" "}
            {s.sogliaPerc}% → provvigione {s.provvigionePerc}%
            {s.note ? ` (${s.note})` : ""}
          </li>
        ))}
        {lato.incentivi.map((inc) => (
          <li key={inc.id}>
            Incentivo cash: {euro(inc.valore)}
            {inc.soglia != null ? ` · soglia ${euro(inc.soglia)}` : ""}
            {inc.note ? ` (${inc.note})` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PagamentiBlock({ p }: { p: PagamentiIntestazioniPerimetro }) {
  if (!hasPagamentiIntestazioni(p)) return null;
  return (
    <div className="mt-2">
      <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide">
        Intestazioni modalità di pagamento
      </h4>
      <Dl
        items={[
          { label: "Bonifico intestato a", value: dash(p.bonificoIntestatoA) },
          { label: "IBAN", value: dash(p.bonificoIban) },
          {
            label: "Bollettino intestato a",
            value: dash(p.bollettinoIntestatoA),
          },
          { label: "CCP / CCN", value: dash(p.bollettinoCcp) },
          {
            label: "Indirizzo bollettino",
            value: dash(p.bollettinoIndirizzo),
          },
          {
            label: "Assegno intestato a",
            value: dash(p.assegnoIntestatoA),
          },
        ]}
      />
    </div>
  );
}

function PerimetroBlock({
  p,
  destinatario,
}: {
  p: MandantePerimetro;
  destinatario: DestinatarioStampaMandante;
}) {
  const pdr = p.pdr;
  const stralcio = p.stralcio;
  const showRicevuta = destinatario === "admin";
  const showOperatori =
    destinatario === "admin" || destinatario === "operatore";
  const showConsulenti =
    destinatario === "admin" || destinatario === "consulente";
  const showCodiciBo = destinatario === "admin";
  const showSms = destinatario === "admin" || destinatario === "operatore";

  return (
    <section className="mb-5 break-inside-avoid">
      <h2 className="mb-2 border-b border-[#132033] pb-0.5 text-sm font-bold">
        Perimetro · {etichettaPerimetro(p)}
      </h2>
      <Dl
        items={[
          { label: "Acronimo", value: dash(p.nomeInterno) },
          { label: "Descrizione", value: dash(p.descrizione) },
          { label: "Chiave import", value: dash(p.nomeMandante) },
        ]}
      />

      <PagamentiBlock p={p.pagamenti} />

      {hasPdrFasceConfigurate(pdr) ||
      pdr.minInstallmentAmount != null ||
      pdr.maxAgePdr != null ||
      pdr.effettiCambiari ||
      pdr.bollettiniPostali ? (
        <div className="mt-2">
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide">
            Piano di rientro (PDR)
          </h4>
          {pdr.bands.length ? (
            <ul className="mb-1 space-y-0.5 text-[12px]">
              {pdr.bands.map((b, i) => (
                <li key={i}>
                  Fascia {euro(b.from)} – {euro(b.to)} → max {b.installments}{" "}
                  rate
                </li>
              ))}
            </ul>
          ) : null}
          <Dl
            items={[
              {
                label: "Minimo rata",
                value:
                  pdr.minInstallmentAmount != null
                    ? euro(pdr.minInstallmentAmount)
                    : "—",
              },
              {
                label: "Età massima PDR",
                value: pdr.maxAgePdr != null ? String(pdr.maxAgePdr) : "—",
              },
              {
                label: "Effetti cambiari",
                value: pdr.effettiCambiari ? "Sì" : "No",
              },
              {
                label: "Bollettini postali",
                value: pdr.bollettiniPostali ? "Sì" : "No",
              },
            ]}
          />
        </div>
      ) : null}

      {hasStralcioVincoli(stralcio) ? (
        <div className="mt-2">
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide">
            Saldo a stralcio
          </h4>
          <Dl
            items={[
              {
                label: "% minima",
                value:
                  stralcio.percMin != null ? `${stralcio.percMin}%` : "—",
              },
              {
                label: "% massima",
                value:
                  stralcio.percMax != null ? `${stralcio.percMax}%` : "—",
              },
              {
                label: "% proposta",
                value:
                  stralcio.percProposta != null
                    ? `${stralcio.percProposta}%`
                    : "—",
              },
              { label: "Note", value: dash(stralcio.note) },
            ]}
          />
        </div>
      ) : null}

      {showCodiciBo && p.codiciScarico.length ? (
        <div className="mt-2">
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide">
            Codici scarico back office
          </h4>
          <ul className="space-y-0.5 text-[12px]">
            {p.codiciScarico.map((c) => (
              <li key={c.codice}>
                {c.codice}
                {c.descrizione ? ` — ${c.descrizione}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {p.codiciScaricoOperatori.length ? (
        <div className="mt-2">
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide">
            Codici scarico operatori
          </h4>
          <ul className="space-y-0.5 text-[12px]">
            {p.codiciScaricoOperatori.map((c) => (
              <li key={c.codice}>
                {c.codice}
                {c.descrizione ? ` — ${c.descrizione}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showSms && p.smsPreimpostati.length ? (
        <div className="mt-2">
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide">
            SMS preimpostati
          </h4>
          <ul className="space-y-1 text-[12px]">
            {p.smsPreimpostati.map((s, i) => (
              <li key={s.id || i}>
                <span className="font-semibold">{s.titolo || `SMS ${i + 1}`}</span>
                {s.testo ? (
                  <span className="block whitespace-pre-wrap text-[#334455]">
                    {s.testo}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showRicevuta ? (
        <LatoBlock
          title="Provvigioni percepite dalla mandante"
          lato={p.ricevuta}
        />
      ) : null}
      {showOperatori ? (
        <LatoBlock
          title="Provvigioni da pagare agli operatori"
          lato={p.pagata}
        />
      ) : null}
      {showConsulenti ? (
        <LatoBlock
          title="Provvigioni da pagare ai consulenti"
          lato={p.pagataConsulenti ?? emptyLatoEconomico()}
        />
      ) : null}
    </section>
  );
}

export default async function StampaMandantePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ destinatario?: string }>;
}) {
  const user = await requirePermission("mandanti:manage");
  const { id } = await params;
  const sp = await searchParams;
  const destinatario = parseDestinatario(sp.destinatario);

  const mandante = await mandantiDbFromUser(user).findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!mandante) notFound();

  const perimetri = loadPerimetriForEditor(mandante);
  const indirizzo = [
    mandante.indirizzo,
    [mandante.cap, mandante.citta, mandante.provincia].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <StampaAnteprima
      backHref={`/mandanti/${mandante.id}`}
      backLabel="← Torna alla mandante (Esc)"
    >
      <div className="text-[#132033]">
        <header className="mb-4 border-b-2 border-[#132033] pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#667788]">
            Scheda mandante · stampa per {DESTINATARIO_LABEL[destinatario]}
          </p>
          <h1 className="text-lg font-bold">
            {mandante.codice} · {mandante.ragioneSociale}
          </h1>
        </header>

        <section className="mb-5">
          <h2 className="mb-2 border-b border-[#132033] pb-0.5 text-xs font-bold uppercase">
            Anagrafica
          </h2>
          <Dl
            items={[
              { label: "Codice", value: dash(mandante.codice) },
              {
                label: "Ragione sociale",
                value: dash(mandante.ragioneSociale),
              },
              { label: "Email", value: dash(mandante.email) },
              { label: "Telefono", value: dash(mandante.telefono) },
              { label: "Referente", value: dash(mandante.referente) },
              {
                label: "Tel. referente",
                value: dash(mandante.referenteTelefono),
              },
              {
                label: "Email referente",
                value: dash(mandante.referenteEmail),
              },
              { label: "PEC", value: dash(mandante.pec) },
              { label: "Indirizzo", value: dash(indirizzo) },
            ]}
          />
        </section>

        {perimetri.length ? (
          perimetri.map((p) => (
            <PerimetroBlock key={p.id} p={p} destinatario={destinatario} />
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Nessun perimetro configurato.
          </p>
        )}
      </div>
    </StampaAnteprima>
  );
}
