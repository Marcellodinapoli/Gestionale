import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { dateInputValue, datetimeLocalValue, euro, dataIt } from "@/lib/domainFormat";
import { formatNotaLine } from "@/lib/noteFormat";
import { RegistroNote } from "@/components/pratica/RegistroNote";
import { PraticaFunzioniBar } from "@/components/pratica/PraticaFunzioniBar";
import { AnagraficaRecapiti } from "@/components/pratica/AnagraficaRecapiti";
import { GarantiPanel } from "@/components/pratica/GarantiPanel";
import {
  AnagraficaField,
  indirizzoCompleto,
} from "@/components/pratica/anagraficaUi";
import { StatoPraticaBar } from "@/components/pratica/StatoPraticaBar";
import { RiepilogoEsitoPratica } from "@/components/pratica/RiepilogoEsitoPratica";
import { PaginazioneBar } from "@/components/PaginazioneBar";
import { ContabilePreviewPanel } from "@/components/pratica/ContabilePreviewPanel";
import { IncassoForm } from "@/components/pratica/IncassoForm";
import {
  buildPraticaCollegataHref,
  etichettaFiltroCollegata,
} from "@/lib/praticaCollegata";
import { buildPraticaCodaHref, buildPraticheListaHref, type CodaNav } from "@/lib/praticaCoda";
import { codiceScaricoPratica } from "@/lib/scarico";
import type { RecordingMode } from "@/lib/recordingMode";

type AnagraficaPersona = {
  id?: string;
  nome: string;
  cognome: string;
  codiceFiscale?: string | null;
  telefono?: string | null;
  telefonoStato?: string | null;
  email?: string | null;
  indirizzo?: string | null;
  citta?: string | null;
  cap?: string | null;
  provincia?: string | null;
  recapiti?: Array<{ id: string; tipo: string; valore: string; stato?: string | null }>;
};

type PraticaData = {
  id: string;
  numero: string;
  numeroMandante: string | null;
  stato: string;
  capitale: number;
  interessi: number;
  spese: number;
  residuo: number;
  dataAffido: Date | null;
  scadenza: Date | null;
  note: string | null;
  esitoContatto: string | null;
  tipoContatto: string | null;
  codiceScarico: string | null;
  codiceScaricoAt: Date | null;
  memoAt: Date | null;
  promessaAt: Date | null;
  promessaImporto: number | null;
  debitore: AnagraficaPersona & {
    codiceFiscale: string | null;
    ndg?: string | null;
  };
  garanti: Array<AnagraficaPersona & { id: string }>;
  mandante: {
    codice: string;
    ragioneSociale: string;
  };
  assegnatario: { name: string } | null;
  attivita: Array<{
    id: string;
    tipo: string;
    esito: string | null;
    nota: string | null;
    scheduledAt: Date | null;
    createdAt: Date;
    fissata?: boolean;
    importante?: boolean;
    bloccata?: boolean;
    user: { name: string };
  }>;
  rate: Array<{
    numeroRata: number;
    importo: number;
    scadenza: Date;
    pagata: boolean;
  }>;
  fatture?: Array<{
    id: string;
    numero: string;
    causale: string | null;
    dataFattura: Date;
    dataScadenza: Date;
    importo: number;
    pagato: number;
  }>;
  incassi?: Array<{
    id: string;
    data: Date;
    dataScadenza: Date | null;
    capitale: number;
    interessi: number;
    spese: number;
    speseRec: number;
    importo: number;
    modo: string | null;
    causale: string | null;
    metodo: string;
    user?: { name: string } | null;
  }>;
};

function HeaderRigaDati({
  numeroMandante,
  dataAffido,
  scadenza,
  praticaId,
  stato,
  filtroStato,
  promessaAt,
  canEditStato,
}: {
  numeroMandante: string | null;
  dataAffido: Date | null;
  scadenza: Date | null;
  praticaId: string;
  stato: string;
  filtroStato?: string | null;
  promessaAt?: string | null;
  canEditStato: boolean;
}) {
  const affido = dataAffido ? dataIt(dataAffido) : null;
  const scad = scadenza ? dataIt(scadenza) : null;

  const boxCls =
    "rounded border border-[var(--line)] bg-white px-1.5 py-px font-mono text-xs leading-tight text-[var(--navy)]";

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5">
        {numeroMandante ? (
          <>
            <span className="text-xs font-bold">Contratto</span>
            <span className={boxCls}>{numeroMandante}</span>
          </>
        ) : null}
        <StatoPraticaBar
          praticaId={praticaId}
          stato={stato}
          filtroStato={filtroStato}
          promessaAt={promessaAt}
          canEdit={canEditStato}
          compact
        />
      </span>
      {affido || scad ? (
        <span className="inline-flex items-center gap-1">
          <span className="text-xs font-bold">Aff/Scad</span>
          {affido ? <span className={boxCls}>{affido}</span> : null}
          {scad ? <span className={boxCls}>{scad}</span> : null}
        </span>
      ) : null}
    </div>
  );
}

export function PraticaSchedaOperatore({
  pratica,
  canEditNotes,
  canEditStato,
  canRegistraIncasso,
  lockedByName,
  nav,
  currentUserName,
  currentUserRole,
  prefissoChiamata,
  recordingMode,
  elencoAperto,
  origineId,
  origineNumero,
}: {
  pratica: PraticaData;
  canEditNotes: boolean;
  canEditStato: boolean;
  canRegistraIncasso?: boolean;
  lockedByName?: string | null;
  nav: {
    page: number;
    totalPages: number;
    ids: string[];
    filtroCollegata?: "aperta" | "chiusa";
    codaNav?: CodaNav;
  };
  currentUserName?: string;
  currentUserRole?: string;
  prefissoChiamata?: string | null;
  recordingMode?: RecordingMode;
  elencoAperto?: boolean;
  origineId?: string;
  origineNumero?: string;
}) {
  const totale = pratica.capitale + pratica.interessi + pratica.spese;
  const rateAperte = pratica.rate.filter((r) => !r.pagata);
  const impRata = rateAperte[0]?.importo ?? (rateAperte.length ? null : pratica.residuo);
  const pagato = (pratica.incassi || []).reduce((s, i) => s + (i.importo || 0), 0);
  /** Spese di recupero sul debito (campo dedicato non ancora in anagrafica pratica). */
  const speseRecupero = 0;
  /** Scala con i pagamenti inseriti (affidato − pagato). */
  const differenza = Math.max(0, Math.round((totale - pagato) * 100) / 100);
  const daPagare = pratica.residuo;

  const attivitaLines = [...pratica.attivita]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((a) => ({
      id: a.id,
      line: formatNotaLine({
        userName: a.user.name,
        createdAt: a.createdAt,
        tipo: a.tipo,
        esito: a.esito,
        nota: a.nota,
      }),
      tipo: a.tipo,
      esito: a.esito,
      nota: a.nota,
      fissata: Boolean(a.fissata),
      importante: Boolean(a.importante),
      bloccata: Boolean(a.bloccata),
    }));

  const debitoreLabel = `${pratica.debitore.cognome} ${pratica.debitore.nome}`.trim();
  const affido = pratica.assegnatario?.name?.trim();
  const affidoVisibile = affido && affido !== currentUserName?.trim();
  const praticaBloccata = Boolean(lockedByName);
  const elencoHref = buildPraticheListaHref(nav.codaNav);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--line)] bg-[#f5f7fa] shadow-sm max-lg:overflow-visible xl:min-h-0">
      {praticaBloccata ? (
        <div className="shrink-0 border-b border-amber-400 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950">
          Pratica bloccata — in lavorazione da {lockedByName}. Puoi solo consultare in lettura.
        </div>
      ) : null}
      <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--line)] bg-[#dce4ec] px-3 py-1.5 text-sm text-[var(--navy)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {!nav.filtroCollegata && nav.codaNav ? (
            <Link
              href={elencoHref}
              className="flex shrink-0 items-center gap-1 rounded border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--navy)] hover:bg-[#eef4f8]"
              title="Torna all'elenco pratiche"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Elenco
            </Link>
          ) : null}
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-bold">{debitoreLabel}</span>
            <span className="shrink-0 text-[var(--muted)]">·</span>
            <span className="shrink-0 font-mono text-xs text-[var(--muted)]">{pratica.numero}</span>
          </div>
          <HeaderRigaDati
            numeroMandante={pratica.numeroMandante}
            dataAffido={pratica.dataAffido}
            scadenza={pratica.scadenza}
            praticaId={pratica.id}
            stato={pratica.stato}
            filtroStato={nav.codaNav?.filtro?.stato}
            promessaAt={pratica.promessaAt ? dateInputValue(pratica.promessaAt) : ""}
            canEditStato={canEditStato}
          />
          {affidoVisibile ? (
            <span className="truncate text-xs text-[var(--muted)]">Affidata a: {affido}</span>
          ) : null}
          {nav.filtroCollegata ? (
            <span className="truncate text-xs text-[var(--muted)]">
              Intestate:{" "}
              <span className="font-semibold text-[var(--navy)]">
                {etichettaFiltroCollegata(nav.filtroCollegata)}
              </span>
            </span>
          ) : null}
        </div>
        {origineId && nav.filtroCollegata ? (
          <Link
            href={`/pratiche/${origineId}`}
            className="flex shrink-0 items-center gap-1 rounded border border-[#2d6a4f] bg-gradient-to-b from-[#b7e4c7] to-[#74c69d] px-2 py-0.5 text-[11px] font-semibold text-[#1b4332] hover:from-[#d8f3dc]"
            title={
              origineId === pratica.id
                ? "Esci dal filtro collegate e torna alla coda di lavoro"
                : "Torna alla pratica in cui stavi lavorando"
            }
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Ritorna{origineNumero ? ` ${origineNumero}` : ""}
          </Link>
        ) : null}
      </div>

      {/* Metà superiore: anagrafica + garanti + estratto */}
      <div className="shrink-0 border-b border-[var(--line)] max-lg:max-h-[50vh] max-lg:overflow-y-auto">
        <div className="grid gap-0 lg:grid-cols-12">
          {/* Anagrafica debitore */}
          <div className="min-w-0 border-b border-[var(--line)] lg:col-span-4 lg:border-b-0 lg:border-r">
            <div className="bg-[#c5d4e3] px-2 py-1 text-[11px] font-bold uppercase text-[#1a365d]">
              Anagrafica debitore
            </div>
            <div className="grid grid-cols-1 gap-0 p-1">
              <AnagraficaField
                wide
                compact
                label="Indirizzo"
                value={indirizzoCompleto(pratica.debitore)}
              />
              <AnagraficaRecapiti
                praticaId={pratica.id}
                telefono={pratica.debitore.telefono ?? null}
                telefonoStato={pratica.debitore.telefonoStato ?? null}
                email={pratica.debitore.email ?? null}
                recapiti={pratica.debitore.recapiti || []}
                canEdit={canEditNotes}
                layout="debitore"
                codiceFiscale={pratica.debitore.codiceFiscale}
                operatoreName={currentUserName}
                prefissoChiamata={prefissoChiamata}
              />
            </div>
          </div>

          <GarantiPanel
            praticaId={pratica.id}
            garanti={pratica.garanti}
            canEdit={canEditNotes}
            operatoreName={currentUserName}
            prefissoChiamata={prefissoChiamata}
          />

          <ContabilePreviewPanel
            praticaId={pratica.id}
            canEditFatture={canRegistraIncasso}
            debitore={pratica.debitore}
            numero={pratica.numero}
            creditore={pratica.mandante.ragioneSociale}
            societa={pratica.mandante.codice}
            scadenza={pratica.scadenza}
            fatture={pratica.fatture || []}
            incassi={[...(pratica.incassi || [])].sort(
              (a, b) => a.data.getTime() - b.data.getTime()
            )}
            incassiRegistrati={pratica.incassi || []}
            affidato={totale}
            definito={pratica.residuo}
          />
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--line)] bg-white">
        <div className="grid grid-cols-3 gap-0 sm:grid-cols-5 lg:grid-cols-9">
          <AnagraficaField
            label="Deb. residuo"
            value={euro(pratica.residuo)}
            highlight
            compact
            accent
            tone="danger"
          />
          <AnagraficaField
            label="Imp. rata"
            value={impRata != null ? euro(impRata) : "—"}
            compact
            accent
          />
          <AnagraficaField label="Spese" value={euro(pratica.spese)} compact accent />
          <AnagraficaField label="Spese rec." value={euro(speseRecupero)} compact accent />
          <AnagraficaField label="Capitale" value={euro(pratica.capitale)} compact accent />
          <AnagraficaField label="Mora" value={euro(pratica.interessi)} compact accent />
          <AnagraficaField
            label="Pagato"
            value={euro(pagato)}
            compact
            accent
            tone="success"
          />
          <AnagraficaField label="Differenza" value={euro(differenza)} compact accent />
          <AnagraficaField
            label="Da pagare"
            value={euro(daPagare)}
            compact
            accent
            tone="danger"
          />
        </div>
      </div>

      <div className="flex shrink-0 min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 bg-[#c5d4e3] px-2 py-1 text-[11px] text-[#1a365d]">
        <span className="shrink-0 font-bold uppercase">Mandante</span>
        <span className="min-w-0 truncate font-semibold" title={pratica.mandante.ragioneSociale}>
          {pratica.mandante.ragioneSociale}
        </span>
        <span className="shrink-0 text-[var(--muted)]">·</span>
        <span className="shrink-0 font-mono">{pratica.mandante.codice}</span>
        {pratica.scadenza ? (
          <>
            <span className="shrink-0 text-[var(--muted)]">·</span>
            <span className="shrink-0">Scad. {dataIt(pratica.scadenza)}</span>
          </>
        ) : null}
      </div>

      <div className="shrink-0 border-y border-[var(--line)] bg-[#eef2f6] px-2 py-1 has-[.f9-collegate-flash]:relative has-[.f9-collegate-flash]:z-50 has-[.f9-collegate-flash]:overflow-visible">
        <PraticaFunzioniBar
          praticaId={pratica.id}
          canEditNotes={canEditNotes}
          praticaLocked={praticaBloccata}
          codiceScarico={codiceScaricoPratica(pratica.stato, pratica.codiceScarico)}
          memoAt={datetimeLocalValue(pratica.memoAt)}
          promessaAt={pratica.promessaAt ? dateInputValue(pratica.promessaAt) : ""}
          promessaImporto={pratica.promessaImporto}
          residuo={pratica.residuo}
          showRecordingControl={
            !praticaBloccata &&
            ["OPERATOR", "SUPERVISOR", "BACK_OFFICE"].includes(currentUserRole || "")
          }
          recordingMode={recordingMode}
          nextPraticaHref={(() => {
            const nextIdx = nav.page;
            if (nextIdx >= nav.totalPages) return null;
            const targetId = nav.ids[nextIdx];
            if (!targetId) return null;
            if (nav.filtroCollegata) {
              return buildPraticaCollegataHref(targetId, nav.filtroCollegata, {
                elenco: elencoAperto,
                da: origineId,
              });
            }
            return buildPraticaCodaHref(targetId, nav.codaNav);
          })()}
        />
      </div>

      {/* Registro note — riempie fino all'incasso / paginazione */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-1.5 pb-0 max-lg:min-h-[240px] lg:min-h-0">
        <RegistroNote
          praticaId={pratica.id}
          attivita={attivitaLines}
          canEdit={canEditNotes}
          canSblocca={["ADMIN", "SUPERVISOR", "BACK_OFFICE", "AMMINISTRAZIONE"].includes(
            currentUserRole || ""
          )}
        />
      </div>

      {canRegistraIncasso ? <IncassoForm praticaId={pratica.id} compact /> : null}

      <div className="shrink-0">
        <PaginazioneBar
          page={nav.page}
          totalPages={nav.totalPages}
          left={
            <RiepilogoEsitoPratica
              stato={pratica.stato}
              codiceScarico={pratica.codiceScarico}
              codiceScaricoAt={pratica.codiceScaricoAt}
              promessaAt={pratica.promessaAt ? dateInputValue(pratica.promessaAt) : ""}
            />
          }
          hrefForPage={(p) => {
            const targetId = nav.ids[p - 1];
            if (nav.filtroCollegata) {
              return buildPraticaCollegataHref(targetId, nav.filtroCollegata, {
                elenco: elencoAperto,
                da: origineId,
              });
            }
            return buildPraticaCodaHref(targetId, nav.codaNav);
          }}
          labels={{
            first: nav.filtroCollegata
              ? "Prima pratica intestata"
              : "Prima pratica",
            prev: nav.filtroCollegata
              ? "Pratica intestata precedente"
              : "Pratica precedente",
            next: nav.filtroCollegata
              ? "Pratica intestata successiva"
              : "Pratica successiva",
            last: nav.filtroCollegata
              ? "Ultima pratica intestata"
              : "Ultima pratica",
          }}
        />
      </div>
    </div>
  );
}
