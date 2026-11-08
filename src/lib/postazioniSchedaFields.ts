/** Campi mostrati in Account / riepilogo (allineati alla scheda Postazioni admin). */
export type PostazioneSchedaView = {
  nome: string;
  sede: string | null;
  interno: string | null;
  email: string | null;
  numeroFisso: string | null;
  numeroFax: string | null;
  numeroWhatsapp: string | null;
  note: string | null;
};

export type PostazioneSchedaCampo = {
  key: keyof PostazioneSchedaView;
  label: string;
};

/** Aggiungere qui nuovi campi scheda postazione per propagarli in Account. */
export const POSTAZIONE_SCHEDA_CAMPI: PostazioneSchedaCampo[] = [
  { key: "nome", label: "Nome / codice" },
  { key: "sede", label: "Sede" },
  { key: "interno", label: "Interno" },
  { key: "email", label: "Email postazione" },
  { key: "numeroFisso", label: "Numero fisso" },
  { key: "numeroFax", label: "Fax" },
  { key: "numeroWhatsapp", label: "WhatsApp" },
  { key: "note", label: "Note" },
];

export function valorePostazioneScheda(
  dettaglio: PostazioneSchedaView | null | undefined,
  key: keyof PostazioneSchedaView
): string {
  if (!dettaglio) return "—";
  const v = dettaglio[key];
  if (v == null || String(v).trim() === "") return "—";
  return String(v).trim();
}

export function postazioneSchedaFromRow(p: {
  nome: string;
  interno?: string | null;
  email?: string | null;
  numeroFisso?: string | null;
  numeroFax?: string | null;
  numeroWhatsapp?: string | null;
  note?: string | null;
  sede?: string | null;
}): PostazioneSchedaView {
  return {
    nome: p.nome,
    sede: p.sede ?? null,
    interno: p.interno ?? null,
    email: p.email ?? null,
    numeroFisso: p.numeroFisso ?? null,
    numeroFax: p.numeroFax ?? null,
    numeroWhatsapp: p.numeroWhatsapp ?? null,
    note: p.note ?? null,
  };
}
