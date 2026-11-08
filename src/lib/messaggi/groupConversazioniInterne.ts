import type { MessaggioInternoSerialized } from "@/lib/messaggi/messaggioInternoUi";

export type ConversazioneInternaGruppo = {
  key: string;
  controparteId: string;
  controparteName: string;
  praticaId: string | null;
  praticaNumero: string | null;
  debitore: string | null;
  messaggi: MessaggioInternoSerialized[];
  ultimoAt: string;
};

/** Raggruppa messaggi inviati/ricevuti per collega e pratica (ordine cronologico nel thread). */
export function groupConversazioniInterne(
  items: MessaggioInternoSerialized[],
  userId: string
): ConversazioneInternaGruppo[] {
  const map = new Map<string, MessaggioInternoSerialized[]>();

  for (const m of items) {
    const otherId = m.fromUserId === userId ? m.toUserId : m.fromUserId;
    const key = `${m.praticaId ?? ""}:${otherId}`;
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }

  const groups: ConversazioneInternaGruppo[] = [];

  for (const [key, messaggi] of map) {
    messaggi.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const first = messaggi[0];
    const controparte =
      first.fromUserId === userId
        ? { id: first.toUserId, name: first.toName }
        : { id: first.fromUserId, name: first.fromName };

    groups.push({
      key,
      controparteId: controparte.id,
      controparteName: controparte.name,
      praticaId: first.praticaId,
      praticaNumero: first.praticaNumero,
      debitore: first.debitore,
      messaggi,
      ultimoAt: messaggi[messaggi.length - 1].createdAt,
    });
  }

  groups.sort(
    (a, b) => new Date(b.ultimoAt).getTime() - new Date(a.ultimoAt).getTime()
  );

  return groups;
}
