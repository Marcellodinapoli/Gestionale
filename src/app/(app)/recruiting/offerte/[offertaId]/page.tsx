import Link from "next/link";
import { Briefcase } from "lucide-react";
import { canPermissionOrNav, requireNavPage } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { getOffertaLavoro, countCandidatureOfferta } from "@/lib/recruiting/offerteRepo";
import {
  DICITURA_PARI_OPPORTUNITA,
  MODALITA_LAVORO_LABELS,
  ORARIO_LAVORO_LABELS,
  STATO_OFFERTA_LAVORO_LABELS,
  TIPO_CONTRATTO_LABELS,
  isOrarioLavoro,
  isTipoContratto,
} from "@/lib/recruiting/offerte";
import { CandidatureOffertaClient } from "../../CandidatureOffertaClient";
import { OffertaSchedaClient } from "../../OffertaSchedaClient";

function Blocco({ titolo, testo }: { titolo: string; testo: string }) {
  const body = testo.trim();
  if (!body) return null;
  return (
    <section>
      <h2 className="text-[10px] font-semibold uppercase text-[var(--muted)]">{titolo}</h2>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{body}</p>
    </section>
  );
}

export default async function OffertaInserzionePage({
  params,
}: {
  params: Promise<{ offertaId: string }>;
}) {
  const user = await requireNavPage("recruiting");
  const { offertaId } = await params;
  const offerta = await getOffertaLavoro(user.tenantId, offertaId);
  if (!offerta) {
    return <p className="text-sm text-rose-700">Offerta non trovata.</p>;
  }
  const canManage = await canPermissionOrNav(user, "recruiting:manage");
  const candidatureCount = await countCandidatureOfferta(user.tenantId, offerta.id);
  const canDelete = canManage && candidatureCount === 0;
  const contratto = isTipoContratto(offerta.tipoContratto)
    ? TIPO_CONTRATTO_LABELS[offerta.tipoContratto]
    : "—";
  const orario = isOrarioLavoro(offerta.orario) ? ORARIO_LAVORO_LABELS[offerta.orario] : "—";

  return (
    <div className="space-y-4">
      <PageHeader
        title={offerta.titolo}
        subtitle={`${STATO_OFFERTA_LAVORO_LABELS[offerta.stato]} · ${offerta.luogo || "—"}`}
      />
      <Link href="/recruiting" className="text-sm underline">
        ← Recruiting
      </Link>

      <OffertaSchedaClient
        canManage={canManage}
        canDelete={canDelete}
        offerta={{
          id: offerta.id,
          titolo: offerta.titolo,
          luogo: offerta.luogo,
          modalitaLavoro: offerta.modalitaLavoro,
          tipoContratto: offerta.tipoContratto,
          orario: offerta.orario,
          numeroPosizioni: offerta.numeroPosizioni,
          descrizione: offerta.descrizione,
          attivitaPrincipali: offerta.attivitaPrincipali,
          requisiti: offerta.requisiti,
          competenze: offerta.competenze,
          retribuzione: offerta.retribuzione,
          benefit: offerta.benefit,
          stato: offerta.stato,
        }}
      />

      <article className="space-y-4 rounded-xl border border-[var(--line)] bg-white p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--navy)]">
          <Briefcase className="h-3.5 w-3.5" />
          Inserzione
        </p>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase text-[var(--muted)]">Sede</dt>
            <dd className="text-sm">{offerta.luogo || "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-[var(--muted)]">Modalità</dt>
            <dd className="text-sm">{MODALITA_LAVORO_LABELS[offerta.modalitaLavoro]}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-[var(--muted)]">Contratto</dt>
            <dd className="text-sm">{contratto}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-[var(--muted)]">Orario</dt>
            <dd className="text-sm">{orario}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-[var(--muted)]">Posizioni</dt>
            <dd className="text-sm tabular-nums">{offerta.numeroPosizioni}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase text-[var(--muted)]">Stato</dt>
            <dd className="text-sm">{STATO_OFFERTA_LAVORO_LABELS[offerta.stato]}</dd>
          </div>
        </dl>
        <Blocco titolo="Descrizione" testo={offerta.descrizione} />
        <Blocco titolo="Attività principali" testo={offerta.attivitaPrincipali} />
        <Blocco titolo="Requisiti" testo={offerta.requisiti} />
        <Blocco titolo="Competenze / esperienza" testo={offerta.competenze} />
        <Blocco titolo="Retribuzione" testo={offerta.retribuzione} />
        <Blocco titolo="Benefit" testo={offerta.benefit} />
        <p className="text-xs text-[var(--muted)]">{DICITURA_PARI_OPPORTUNITA}</p>
      </article>

      <CandidatureOffertaClient
        offertaId={offerta.id}
        candidature={[]}
        mostraElenco={false}
        canManage={canManage}
        offertaChiusa={offerta.stato === "CHIUSA"}
      />
    </div>
  );
}
