import "server-only";
import type { SessionUser } from "@/lib/permissions";
import {
  listPraticheGiudiziali,
  type PraticaGiudizialeListItem,
} from "@/lib/giudiziale/praticaGiudizialeRepo";
import {
  expandImpegniLegali,
  type AgendaGiudizialeVoce,
} from "@/lib/agenda/scadenzeGiudiziali";

function debitoreFromNome(nomeCompleto: string) {
  const trimmed = nomeCompleto.trim();
  const space = trimmed.indexOf(" ");
  if (space <= 0) return { nome: "", cognome: trimmed || "—" };
  return {
    cognome: trimmed.slice(0, space),
    nome: trimmed.slice(space + 1),
  };
}

/** Impegni con data dalle pagine Legal (avvio, strategia, esito). */
export async function loadAgendaLegale(
  user: SessionUser,
  opts?: { praticaId?: string; items?: PraticaGiudizialeListItem[] }
): Promise<AgendaGiudizialeVoce[]> {
  const items = opts?.items ?? (await listPraticheGiudiziali(user));
  const filtered = opts?.praticaId
    ? items.filter((i) => i.praticaId === opts.praticaId)
    : items;

  return filtered
    .flatMap((item) =>
      expandImpegniLegali({
        praticaId: item.praticaId,
        numero: item.praticaNumero,
        debitore: debitoreFromNome(item.debitoreNome),
        dataAffidamentoGiudiziale: item.dataAffidamentoGiudiziale,
        attivitaProceduraJson: item.attivitaProceduraJson,
        agendaScadenze: item.agendaScadenze,
        dataEsito: item.dataEsito,
      })
    )
    .sort((a, b) => new Date(a.memoAt).getTime() - new Date(b.memoAt).getTime());
}

export function toCalendarioLegaleVoci(voci: AgendaGiudizialeVoce[]) {
  return voci.map((g) => ({
    kind: "giudiziale" as const,
    id: g.id,
    praticaId: g.praticaId,
    memoAt: g.memoAt,
    titolo: g.titolo,
    activityLabel: g.activityLabel,
    numero: g.numero,
    debitore: `${g.debitore.cognome} ${g.debitore.nome}`.trim() || "—",
    responsabile: g.responsabile ?? null,
    href: g.href,
    fase: g.fase,
  }));
}
