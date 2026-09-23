export type WarmupEvalResult = {
  score: number;
  puo_proseguire: boolean;
  trascrizione: string;
  commento: string;
  versione_migliorata: string;
};

export type WarmupEvalInput = {
  kind: "warmup" | "contestation";
  phaseKey?: string;
  phase?: string;
  transcription: string;
  evaluationCriteria?: string;
  phaseInstruction?: string;
  expectedText?: string;
  responseGuidance?: string;
  targetPersonName?: string;
};

function norm(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

function hasAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w));
}

function countHits(text: string, words: string[]) {
  return words.filter((w) => text.includes(w)).length;
}

const FORBIDDEN_DEBITO = [
  "debito",
  "insoluto",
  "mora",
  "recupero crediti",
  "agenzia",
];

function improvedLine(input: WarmupEvalInput) {
  const guided = String(input.responseGuidance ?? "").trim();
  const expected = String(input.expectedText ?? "").trim();
  if (expected && expected.length < 280) return expected.replace(/^«|»$/g, "");
  const name = input.targetPersonName || "Rossi Andrea";
  switch (input.phaseKey) {
    case "Approccio":
      return `Buongiorno, parlo con il signor ${name}?`;
    case "Presentazione_standard":
      return `Sono Mario Rossi, la contatto per conto della società mandante.`;
    case "Presentazione_privacy":
      return `Capisco. Posso lasciare un recapito perché il signor ${name} mi richiami?`;
    case "Motivo_della_chiamata":
      return `La contatto per una posizione insoluta da regolarizzare, le spiego i dettagli.`;
    case "Negoziazione":
      return `Le chiedo di saldare 224 euro complessivi entro oggi, al massimo domani.`;
    case "Chiusura":
      return `Allora resta confermato: 224 euro entro domani. La ringrazio, arrivederci.`;
    default:
      return guided || expected || "Risponda in modo chiaro, professionale e aderente alla fase.";
  }
}

export function evaluateWarmupLocal(input: WarmupEvalInput): WarmupEvalResult {
  const spoken = norm(input.transcription);
  const example = improvedLine(input);
  if (!spoken) {
    return {
      score: 40,
      puo_proseguire: false,
      trascrizione: "",
      commento:
        "Non ho captato le parole. Ripeti la registrazione parlando vicino al microfono.",
      versione_migliorata: example,
    };
  }

  let score = 55;
  const notes: string[] = [];
  const key = input.phaseKey || "";

  if (key === "Approccio") {
    const idOk = hasAny(spoken, ["rossi", "andrea", "signor", "parlo con", "e lei"]);
    const presented = hasAny(spoken, ["mi chiamo", "sono ", "societa", "agenzia"]);
    const debt = hasAny(spoken, FORBIDDEN_DEBITO);
    if (idOk) score += 25;
    else notes.push("Manca la verifica dell'identità (es. signor Rossi Andrea).");
    if (presented) {
      score -= 20;
      notes.push("In Approccio non devi ancora presentarti.");
    }
    if (debt) {
      score -= 20;
      notes.push("Non anticipare debito o recupero crediti.");
    }
  } else if (key === "Presentazione_standard") {
    const nameOk = hasAny(spoken, ["mi chiamo", "sono ", "il mio nome"]);
    const company = hasAny(spoken, ["societa", "mandante", "per conto"]);
    const debt = hasAny(spoken, FORBIDDEN_DEBITO);
    if (nameOk) score += 20;
    else notes.push("Presentati con nome e cognome.");
    if (company) score += 15;
    else notes.push("Indica per conto di chi chiami.");
    if (debt) {
      score -= 15;
      notes.push("Non parlare ancora di insoluti.");
    }
  } else if (key === "Presentazione_privacy") {
    const leak = hasAny(spoken, ["mandante", "insoluto", "debito", "recupero"]);
    const ask = hasAny(spoken, ["richiami", "recapito", "numero", "posso lasciare"]);
    if (ask) score += 25;
    else notes.push("Chiedi un recapito o che richiami il debitore.");
    if (leak) {
      score -= 25;
      notes.push("Non rivelare a terzi il motivo della chiamata.");
    }
  } else if (key === "Motivo_della_chiamata") {
    if (hasAny(spoken, ["insoluto", "recupero", "posizione", "regolarizz"])) score += 25;
    else notes.push("Spiega il motivo (insoluto / recupero) senza negoziare.");
  } else if (key === "Negoziazione") {
    if (hasAny(spoken, ["224", "duecentoventi", "euro"])) score += 15;
    if (hasAny(spoken, ["oggi", "domani"])) score += 15;
    if (score < 70) notes.push("Chiedi 224 euro con scadenza oggi o al massimo domani.");
  } else if (key === "Chiusura") {
    if (hasAny(spoken, ["224", "euro"])) score += 10;
    if (hasAny(spoken, ["domani"])) score += 10;
    if (hasAny(spoken, ["conferma", "accordo", "arrivederci", "grazie"])) score += 10;
    if (score < 70) notes.push("Ribadisci importo, data e ottieni conferma.");
  } else {
    const expected = norm(input.expectedText ?? "");
    const keys = expected.split(/\s+/).filter((w) => w.length > 4).slice(0, 8);
    const hits = countHits(spoken, keys);
    score += Math.min(30, hits * 6);
    if (hits < 2) notes.push("Avvicinati di più alla linea di risposta corretta.");
  }

  score = Math.max(20, Math.min(100, score));
  const passed = score >= 70;
  const commento = passed
    ? "Risposta aderente alla fase: puoi proseguire."
    : notes.join(" ") || "Ripeti tenendo presenti i criteri della fase.";

  return {
    score,
    puo_proseguire: passed,
    trascrizione: input.transcription.trim(),
    commento,
    versione_migliorata: example,
  };
}
