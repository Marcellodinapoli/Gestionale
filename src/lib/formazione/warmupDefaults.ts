export const DEFAULT_SYSTEM_PROMPT =
  "Sei un formatore esperto in recupero crediti e warm-up telefonico " +
  "in Italia. Valuta la risposta vocale dell'operatore rispetto " +
  "al contesto e alla linea corretta. Rispondi SOLO in JSON con due campi: " +
  "commento (feedback breve e costruttivo in italiano) e versione_migliorata " +
  "(esempio di risposta vocale migliorata, 2-4 frasi).";

export type WarmupTelefonataPhase = {
  phaseKey: string;
  sectionTitle: string;
  group: string;
  order: number;
  enabled: boolean;
  colorValue: number;
  customerLine: string;
  decodifica: string;
  spiegazione: string;
  evaluationCriteria: string;
  systemPrompt: string;
  phaseInstruction: string;
  targetPersonName?: string;
  callingOnBehalfOf?: string;
  responseGuidance?: string;
};

export const PHASE_UI_SUBTITLES: Record<string, string> = {
  Approccio: "Approfondisce la prima fase della telefonata",
  Presentazione: "Approfondisce la seconda fase della telefonata",
  Presentazione_standard:
    "Presentazione al titolare: rispondi quando ti chiedono chi sei",
  Presentazione_privacy:
    "Terza persona e legge sulla privacy: rispondi con iniziativa",
  Motivo_della_chiamata: "Approfondisce il motivo della telefonata",
  Negoziazione: "Approfondisce la terza fase della telefonata",
  Chiusura: "Approfondisce la quarta fase della telefonata",
};

const BY_KEY: Record<string, Omit<WarmupTelefonataPhase, "phaseKey">> = {
  Approccio: {
    sectionTitle: "Approccio",
    group: "",
    order: 0,
    enabled: true,
    colorValue: 0xfffb8c00,
    customerLine: "Pronto…",
    targetPersonName: "Rossi Andrea",
    responseGuidance:
      "Verifica se stai parlando con Rossi Andrea. In questa fase non presentarti ancora: niente nome, cognome o società.",
    decodifica:
      "Il cliente risponde alla chiamata: è il primo contatto. Non parlare ancora del debito.",
    spiegazione:
      "Obiettivo: capire se l'interlocutore è il debitore corretto. Saluto breve e verifica identità, senza presentarti e senza parlare del debito.",
    evaluationCriteria:
      "Verifica identità del debitore (es. signor Rossi Andrea) con tono professionale. Non presentarsi ancora e non anticipare il recupero crediti.",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    phaseInstruction:
      "IMPORTANTE: in fase Approccio l'operatore NON deve presentarsi (no nome, cognome, società). Valuta solo se verifica l'identità del debitore.",
  },
  Presentazione_standard: {
    sectionTitle: "Presentazione standard",
    group: "Presentazione",
    order: 1,
    enabled: true,
    colorValue: 0xff1e88e5,
    customerLine: "Con chi ho il piacere di parlare?",
    targetPersonName: "Rossi Andrea",
    callingOnBehalfOf: "la società mandante",
    responseGuidance:
      "Presentati con nome e cognome e indica la società per cui chiami. Non parlare ancora di insoluti o del debito.",
    decodifica:
      "Hai individuato l'interlocutore corretto: ora devi presentarti in modo chiaro e professionale, senza ancora entrare nel merito del debito.",
    spiegazione:
      "Obiettivo: presentarti con nome, cognome e società mandante. Non anticipare insoluti, pagamenti o comunicazioni sul debito.",
    evaluationCriteria:
      "Presentazione corretta: nome, cognome e società mandante, tono professionale. Vietato parlare di insoluti, debiti o scadenze.",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    phaseInstruction:
      "IMPORTANTE: in fase Presentazione standard il debitore è già stato identificato in Approccio.",
  },
  Presentazione_privacy: {
    sectionTitle: "Presentazione privacy",
    group: "Presentazione",
    order: 2,
    enabled: true,
    colorValue: 0xff1565c0,
    customerLine:
      "Sono la moglie, può parlare anche con me. Siamo marito e moglie.",
    targetPersonName: "Rossi Andrea",
    responseGuidance:
      "Debitore: Rossi Andrea. Puoi dire al massimo il tuo nome e cognome. Non indicare per conto di chi chiami.",
    decodifica:
      "Interviene una terza persona, non il debitore Rossi Andrea. Devi applicare le regole sulla privacy.",
    spiegazione:
      "Obiettivo: proteggere la privacy verso terzi. Non divulgare informazioni sensibili.",
    evaluationCriteria:
      "Gestione privacy corretta: non dire per conto di chi chiami, chiedere recapito telefonico o richiamata dal debitore.",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    phaseInstruction:
      "IMPORTANTE: in fase Presentazione privacy l'operatore NON deve dire per conto di chi chiama.",
  },
  Motivo_della_chiamata: {
    sectionTitle: "Motivo della chiamata",
    group: "",
    order: 3,
    enabled: true,
    colorValue: 0xff00897b,
    customerLine: "Va bene, mi dica pure il motivo della chiamata.",
    targetPersonName: "Rossi Andrea",
    responseGuidance:
      "Spiega in modo chiaro e professionale il motivo della chiamata (insoluto / recupero crediti).",
    decodifica:
      "Ti sei presentato: ora il debitore vuole sapere perché lo stai chiamando.",
    spiegazione:
      "Obiettivo: comunicare il motivo della chiamata con chiarezza, senza entrare ancora nella negoziazione.",
    evaluationCriteria:
      "Motivo della chiamata chiaro: indicare insoluto o recupero crediti con tono professionale.",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    phaseInstruction:
      "IMPORTANTE: in fase Motivo della chiamata spiegare SOLO il motivo del contatto.",
  },
  Negoziazione: {
    sectionTitle: "Negoziazione",
    group: "",
    order: 4,
    enabled: true,
    colorValue: 0xff5e35b1,
    customerLine: "Salve, mi dica.",
    targetPersonName: "Rossi Andrea",
    responseGuidance:
      "Debitore: Rossi Andrea. Incassa 224 euro complessivi (200 euro di debito più 24 euro di spese).",
    decodifica:
      "Il debitore Rossi Andrea ti ascolta: è il momento di condurre la trattativa.",
    spiegazione:
      "Obiettivo: richiedere il pagamento di 224 euro, scadenza entro oggi o al massimo domani.",
    evaluationCriteria:
      "Negoziazione efficace: richiedere 224 euro complessivi, scadenza entro oggi o domani.",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    phaseInstruction:
      "IMPORTANTE: in fase Negoziazione richiedere pagamento entro oggi o domani con tono fermo.",
  },
  Chiusura: {
    sectionTitle: "Chiusura",
    group: "",
    order: 5,
    enabled: true,
    colorValue: 0xff43a047,
    customerLine:
      "Va bene, le prometto di pagare la rata più le spese entro domani.",
    targetPersonName: "Rossi Andrea",
    responseGuidance:
      "Debitore: Rossi Andrea. Incassa 224 euro complessivi. Il debitore ha fissato il pagamento a domani.",
    decodifica:
      "Il debitore ha fissato il pagamento a domani: devi consolidare l'accordo prima di chiudere.",
    spiegazione:
      "Obiettivo: ribadire l'impegno di 224 euro con pagamento a domani, ottenere conferma e chiudere.",
    evaluationCriteria:
      "Chiusura corretta: riepilogo di 224 euro, impegno per domani, conferma e saluto.",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    phaseInstruction:
      "IMPORTANTE: in fase Chiusura ribadire impegno di 224 euro e pagamento entro domani.",
  },
};

export const PHASE_KEYS = [
  "Approccio",
  "Presentazione_standard",
  "Presentazione_privacy",
  "Motivo_della_chiamata",
  "Negoziazione",
  "Chiusura",
] as const;

export function defaultPhase(phaseKey: string): WarmupTelefonataPhase {
  const base = BY_KEY[phaseKey] ?? BY_KEY.Approccio!;
  return { phaseKey, ...base };
}

export function resolvePhases(
  rawPhases: Record<string, Record<string, unknown>> | null | undefined
): Record<string, WarmupTelefonataPhase> {
  const out: Record<string, WarmupTelefonataPhase> = {};

  if (rawPhases) {
    for (const [key, value] of Object.entries(rawPhases)) {
      const phaseKey = String(value.phaseKey ?? key);
      const defaults = defaultPhase(phaseKey);
      const readString = (k: keyof WarmupTelefonataPhase) =>
        String(value[k as string] ?? defaults[k as keyof WarmupTelefonataPhase] ?? "").trim();

      out[phaseKey] = {
        phaseKey,
        sectionTitle: readString("sectionTitle") || defaults.sectionTitle,
        group: readString("group") || defaults.group,
        order: Number(value.order ?? defaults.order),
        enabled: value.enabled !== false,
        colorValue: Number(value.colorValue ?? defaults.colorValue),
        customerLine: readString("customerLine") || defaults.customerLine,
        decodifica: readString("decodifica") || defaults.decodifica,
        spiegazione: readString("spiegazione") || defaults.spiegazione,
        evaluationCriteria:
          readString("evaluationCriteria") || defaults.evaluationCriteria,
        systemPrompt: readString("systemPrompt") || defaults.systemPrompt,
        phaseInstruction: readString("phaseInstruction") || defaults.phaseInstruction,
        targetPersonName: readString("targetPersonName") || defaults.targetPersonName,
        callingOnBehalfOf: readString("callingOnBehalfOf") || defaults.callingOnBehalfOf,
        responseGuidance: readString("responseGuidance") || defaults.responseGuidance,
      };
    }
  }

  for (const key of PHASE_KEYS) {
    if (!out[key]) out[key] = defaultPhase(key);
  }

  return out;
}

export function colorFromValue(value: number) {
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgb(${r}, ${g}, ${b})`;
}

export function categoryColor(category: string) {
  switch (category) {
    case "economica":
      return "#FB8C00";
    case "legale":
      return "#1E88E5";
    case "salute":
      return "#5E35B1";
    case "amministrativa":
      return "#43A047";
    default:
      return "#607D8B";
  }
}
