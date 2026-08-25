export const CONTESTAZIONI_SYSTEM_PROMPT =
  "Sei un formatore esperto in recupero crediti e gestione contestazioni " +
  "telefoniche in Italia. Valuta la risposta vocale dell'operatore rispetto " +
  "al contesto e alla linea corretta. Rispondi SOLO in JSON con due campi: " +
  "commento (feedback breve e costruttivo in italiano) e versione_migliorata " +
  "(esempio di risposta vocale migliorata, 2-4 frasi).";

export type ContestazioneTrainingItem = {
  id: string;
  title: string;
  subtitle: string;
  context: string;
  category: string;
  order: number;
  enabled: boolean;
  declared: string;
  meaning: string;
  risk: string;
  objective: string;
  response: string;
  systemPrompt: string;
};

const BY_ID: Record<string, Omit<ContestazioneTrainingItem, "id">> = {
  ritardo: {
    title: "Un giorno di ritardo",
    subtitle: "Contestazione sulle morosità applicate subito",
    context: "sollecito",
    category: "amministrativa",
    order: 0,
    enabled: true,
    declared: "«Ho pagato con un giorno di ritardo, non capisco le morosità.»",
    meaning: "Il cliente minimizza il ritardo e contesta le spese di mora.",
    risk: "Accettare il rinvio senza spiegare le regole contrattuali.",
    objective:
      "Chiarire le regole senza toni aggressivi e riportare al pagamento.",
    response:
      "«Capisco, le spiego come sono calcolate le morosità e vediamo come regolarizzare la posizione.»",
    systemPrompt: CONTESTAZIONI_SYSTEM_PROMPT,
  },
  agenzia: {
    title: "Agenzia debiti",
    subtitle: "Coinvolgimento di terzi o richiesta rata singola",
    context: "sollecito",
    category: "legale",
    order: 1,
    enabled: true,
    declared: "«Non tratto con agenzie di recupero crediti.»",
    meaning: "Rifiuto del ruolo dell'interlocutore e del mandato.",
    risk: "Perdere autorevolezza o chiudere la trattativa.",
    objective: "Legittimare il contatto e mantenere il dialogo.",
    response:
      "«La contatto in qualità di mandataria del creditore, possiamo definire insieme la soluzione migliore.»",
    systemPrompt: CONTESTAZIONI_SYSTEM_PROMPT,
  },
  coobbligato: {
    title: "Coobbligato",
    subtitle: "Richiesta di contattare l'intestatario",
    context: "sollecito",
    category: "amministrativa",
    order: 2,
    enabled: true,
    declared: "«Sono solo coobbligato, chiami l'intestatario.»",
    meaning: "Spostamento della responsabilità sull'altro soggetto.",
    risk: "Chiudere senza verificare il ruolo e gli obblighi.",
    objective: "Chiarire responsabilità solidale e proseguire.",
    response:
      "«Capisco il suo ruolo, verifichiamo insieme gli obblighi e come regolarizzare.»",
    systemPrompt: CONTESTAZIONI_SYSTEM_PROMPT,
  },
  prodotto: {
    title: "Prodotto difettoso",
    subtitle: "Rifiuto pagamento per problema sul bene",
    context: "sollecito",
    category: "generica",
    order: 3,
    enabled: true,
    declared: "«Il prodotto era difettoso, non pago.»",
    meaning: "Contestazione sul merito della fornitura.",
    risk: "Accettare il rifiuto senza distinguere reclamo e debito.",
    objective: "Separare reclamo e obbligo di pagamento.",
    response:
      "«Registro la contestazione sul prodotto e nel contempo verifichiamo la posizione debitoria.»",
    systemPrompt: CONTESTAZIONI_SYSTEM_PROMPT,
  },
  pagamento: {
    title: "Pagamento generico",
    subtitle: "Promessa non concreta di pagamento",
    context: "sollecito",
    category: "generica",
    order: 4,
    enabled: true,
    declared: "«Pagherò appena posso, non so quando.»",
    meaning: "Promessa vaga senza impegno temporale.",
    risk: "Rinviare senza data o modalità concrete.",
    objective: "Ottenere una scadenza e una modalità certe.",
    response:
      "«Mi indichi una data precisa e la modalità con cui intende regolarizzare.»",
    systemPrompt: CONTESTAZIONI_SYSTEM_PROMPT,
  },
  economica: {
    title: "Difficoltà economica",
    subtitle: "Situazione lavorativa o reddito insufficiente",
    context: "sollecito",
    category: "economica",
    order: 5,
    enabled: true,
    declared: "«Non ho lavoro, non posso pagare adesso.»",
    meaning: "Condizione economica usata per bloccare la trattativa.",
    risk: "Chiudere senza esplorare soluzioni sostenibili.",
    objective: "Mantenere il dialogo e individuare un piano fattibile.",
    response: "«Capisco la situazione, vediamo insieme cosa è sostenibile oggi.»",
    systemPrompt: CONTESTAZIONI_SYSTEM_PROMPT,
  },
  importo_errato: {
    title: "Importo errato",
    subtitle: "Contestazione sull'ammontare del debito in recupero",
    context: "recupero",
    category: "amministrativa",
    order: 0,
    enabled: true,
    declared: "«L'importo che mi chiedete non è corretto.»",
    meaning: "Il debitore contesta il capitale, le spese o il totale.",
    risk: "Accettare la contestazione senza verificare la posizione.",
    objective: "Verificare i dati e riportare il dialogo alla regolarizzazione.",
    response:
      "«Verifico subito la posizione e le spiego come è composto l'importo.»",
    systemPrompt: CONTESTAZIONI_SYSTEM_PROMPT,
  },
  gia_pagato: {
    title: "Già pagato",
    subtitle: "Il debitore sostiene di aver già saldato",
    context: "recupero",
    category: "amministrativa",
    order: 1,
    enabled: true,
    declared: "«Ho già pagato, controllate meglio.»",
    meaning: "Rifiuto basato su presunto pagamento già effettuato.",
    risk: "Insistere senza verificare ricevute o movimenti.",
    objective: "Raccogliere evidenze e ricostruire la posizione.",
    response: "«Capisco, verifichiamo insieme eventuali pagamenti ricevuti.»",
    systemPrompt: CONTESTAZIONI_SYSTEM_PROMPT,
  },
  piano_rate: {
    title: "Richiesta piano rateale",
    subtitle: "Proposta di dilazione in fase di recupero",
    context: "recupero",
    category: "economica",
    order: 2,
    enabled: true,
    declared: "«Posso pagare solo a rate, non tutto insieme.»",
    meaning: "Apertura parziale con richiesta di dilazione.",
    risk: "Accettare rate senza criteri o rifiutare senza alternative.",
    objective: "Valutare fattibilità e formalizzare un impegno concreto.",
    response: "«Vediamo insieme un piano sostenibile con scadenze precise.»",
    systemPrompt: CONTESTAZIONI_SYSTEM_PROMPT,
  },
  avvocato: {
    title: "Ho già un avvocato",
    subtitle: "Rinvio al legale del debitore",
    context: "recupero",
    category: "legale",
    order: 3,
    enabled: true,
    declared: "«Per queste cose parli con il mio avvocato.»",
    meaning: "Il debitore interrompe il dialogo rimandando al legale.",
    risk: "Perdere il controllo della trattativa o chiudere bruscamente.",
    objective: "Ottenere riferimenti e mantenere un canale aperto.",
    response:
      "«Mi lasci il riferimento del suo legale così possiamo coordinarci.»",
    systemPrompt: CONTESTAZIONI_SYSTEM_PROMPT,
  },
  merito_recupero: {
    title: "Contestazione di merito",
    subtitle: "Contesta il credito in fase di recupero",
    context: "recupero",
    category: "legale",
    order: 4,
    enabled: true,
    declared: "«Non devo nulla, contesto il credito.»",
    meaning: "Negazione totale dell'obbligo in fase avanzata.",
    risk: "Trasformare la chiamata in confronto senza gestire il reclamo.",
    objective: "Separare reclamo e recupero mantenendo tono professionale.",
    response:
      "«Registro la contestazione e verifichiamo la documentazione a disposizione.»",
    systemPrompt: CONTESTAZIONI_SYSTEM_PROMPT,
  },
  difficolta_recupero: {
    title: "Difficoltà economica",
    subtitle: "Impossibilità di pagare in recupero",
    context: "recupero",
    category: "economica",
    order: 5,
    enabled: true,
    declared: "«In questo momento non ho modo di pagare.»",
    meaning: "Blocco della trattativa per motivi economici.",
    risk: "Chiudere senza esplorare soluzioni realistiche.",
    objective: "Individuare un primo passo concreto verso la regolarizzazione.",
    response:
      "«Capisco, vediamo quale soluzione è sostenibile partendo da oggi.»",
    systemPrompt: CONTESTAZIONI_SYSTEM_PROMPT,
  },
};

function genericTemplate(id: string): Omit<ContestazioneTrainingItem, "id"> {
  return {
    title: "Nuova contestazione",
    subtitle: "",
    context: "sollecito",
    category: "generica",
    order: 99,
    enabled: true,
    declared: "",
    meaning: "Analisi della contestazione.",
    risk: "Rischio comunicativo.",
    objective: "Gestione corretta della risposta.",
    response: "Risposta professionale e controllata.",
    systemPrompt: CONTESTAZIONI_SYSTEM_PROMPT,
  };
}

export function defaultContestazioneItem(id: string): ContestazioneTrainingItem {
  const base = BY_ID[id] ?? genericTemplate(id);
  return { id, ...base };
}

export function resolveContestazioneItems(
  rawItems: Record<string, Record<string, unknown>> | null | undefined
): Record<string, ContestazioneTrainingItem> {
  const out: Record<string, ContestazioneTrainingItem> = {};

  if (rawItems) {
    for (const [key, value] of Object.entries(rawItems)) {
      const id = String(value.id ?? key);
      const defaults = defaultContestazioneItem(id);
      const read = (k: keyof ContestazioneTrainingItem): string => {
        const v = value[k as string];
        if (v == null || v === "") return String(defaults[k] ?? "");
        return String(v);
      };

      out[id] = {
        id,
        title: read("title"),
        subtitle: read("subtitle"),
        context: read("context") || defaults.context,
        category: read("category") || defaults.category,
        order: Number(value.order ?? defaults.order),
        enabled: value.enabled !== false,
        declared: read("declared"),
        meaning: read("meaning"),
        risk: read("risk"),
        objective: read("objective"),
        response: read("response"),
        systemPrompt: read("systemPrompt") || defaults.systemPrompt,
      };
    }
  }

  for (const id of Object.keys(BY_ID)) {
    if (!out[id]) out[id] = defaultContestazioneItem(id);
  }

  return out;
}

export function orderedContestazioni(
  items: Record<string, ContestazioneTrainingItem>,
  context: string
) {
  return Object.values(items)
    .filter((item) => item.enabled && item.context === context)
    .sort((a, b) => {
      const order = a.order - b.order;
      return order !== 0 ? order : a.title.localeCompare(b.title);
    });
}
