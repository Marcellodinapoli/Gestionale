import Link from "next/link";
import { redirect } from "next/navigation";
import { requireNavPage } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { getOffertaLavoro } from "@/lib/recruiting/offerteRepo";
import { listCandidatureByOfferta } from "@/lib/recruiting/candidatureRepo";
import { DICITURA_PARI_OPPORTUNITA, STATO_OFFERTA_LAVORO_LABELS } from "@/lib/recruiting/offerte";
import { CandidatureOffertaClient } from "../../CandidatureOffertaClient";

export default async function CandidatureOffertaPage({
  params,
}: {
  params: Promise<{ offertaId: string }>;
}) {
  const user = await requireNavPage("recruiting");
  if (!can(user, "recruiting:view")) redirect("/");
  const { offertaId } = await params;
  const offerta = await getOffertaLavoro(user.tenantId, offertaId);
  if (!offerta) {
    return <p className="text-sm text-rose-700">Offerta non trovata.</p>;
  }
  const rows = await listCandidatureByOfferta(user.tenantId, offerta.id);
  const candidature = rows.map((c) => ({
    id: c.id,
    stato: c.stato,
    source: c.source,
    receivedAt: c.receivedAt.toISOString(),
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Candidature · ${offerta.titolo}`}
        subtitle={`${STATO_OFFERTA_LAVORO_LABELS[offerta.stato]} · ${candidature.length} ${candidature.length === 1 ? "candidatura" : "candidature"}`}
      />
      <Link href="/recruiting" className="text-sm underline">
        ← Recruiting
      </Link>
      <p className="text-xs text-[var(--muted)]">{DICITURA_PARI_OPPORTUNITA}</p>
      <CandidatureOffertaClient
        offertaId={offerta.id}
        candidature={candidature}
        canManage={can(user, "recruiting:manage")}
        offertaChiusa={offerta.stato === "CHIUSA"}
      />
    </div>
  );
}
