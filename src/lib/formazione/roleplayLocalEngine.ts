import type { RoleplayHistoryMessage } from "@/lib/formazione/roleplayProgress";

type PracticeRow = { label?: string; value?: string };

export type RoleplayStepInput = {
  userText?: string;
  sessionId?: string;
  history?: RoleplayHistoryMessage[];
  practiceData?: unknown[];
  difficulty?: string;
  personality?: string;
};

const PERSONA = ["debitore", "garante", "terza"] as const;
type Persona = (typeof PERSONA)[number];

function hashSeed(value: string) {
  let n = 0;
  for (const ch of value) n = (n + ch.charCodeAt(0) * 17) % 997;
  return n;
}

function personaFromSession(sessionId: string): Persona {
  return PERSONA[hashSeed(sessionId || "rp") % PERSONA.length];
}

function practiceLines(data: unknown[] | undefined) {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      if (!row || typeof row !== "object") return "";
      const r = row as PracticeRow;
      const label = String(r.label ?? "").trim();
      const value = String(r.value ?? "").trim();
      if (!value) return "";
      return label ? `${label}: ${value}` : value;
    })
    .filter(Boolean);
}

function lastAssistant(history: RoleplayHistoryMessage[] | undefined) {
  return [...(history ?? [])].reverse().find((m) => m.role === "assistant")?.content ?? "";
}

function userTurns(history: RoleplayHistoryMessage[] | undefined) {
  return (history ?? []).filter((m) => m.role === "user").length;
}

function pick<T>(items: T[], seed: number) {
  return items[seed % items.length];
}

/**
 * Debitore locale: usato perché la Cloud Function `roleplayStep` non è
 * deployata su CreditForm (404). Risposte brevi in personaggio.
 */
export function generateRoleplayReply(input: RoleplayStepInput): string {
  const sessionId = String(input.sessionId ?? "rp");
  const persona = personaFromSession(sessionId);
  const personality = String(input.personality ?? "collaborativo").toLowerCase();
  const difficulty = String(input.difficulty ?? "media").toLowerCase();
  const text = String(input.userText ?? "").trim().toLowerCase();
  const history = input.history ?? [];
  const seed = hashSeed(sessionId + text + String(history.length));
  const practice = practiceLines(input.practiceData);
  const praticaHint = practice[0] ? ` su ${practice[0]}` : "";

  if (!text) {
    if (persona === "terza") {
      return pick(
        [
          "Pronto?",
          "Sì, chi parla?",
          "Pronto, chi è?",
        ],
        seed
      );
    }
    if (persona === "garante") {
      return pick(["Pronto.", "Sì, dimmi.", "Pronto, chi cerca?"], seed);
    }
    return pick(
      [
        "Pronto?",
        "Sì, chi è?",
        personality === "aggressivo" ? "Pronto. Chi è e cosa vuole?" : "Pronto, dimmi.",
      ],
      seed
    );
  }

  const hard = difficulty === "difficile" || difficulty === "esperto";
  const turns = userTurns(history);
  const saidPrivacy =
    /debit|mora|insoluto|recupero|pratica|importo|rata|pagamento/.test(text) &&
    persona === "terza" &&
    turns < 3;

  if (saidPrivacy && !/io sono|mi chiamo|il debitore|signor|signora/.test(lastAssistant(history).toLowerCase())) {
    return pick(
      [
        "Aspetti, chi sta cercando e per quale motivo?",
        "Posso sapere di cosa si tratta, prima?",
        "Non ho capito: chi lo cerca e perché?",
      ],
      seed
    );
  }

  if (/chi (parla|sono|è)|si presenta|società|agenzia|studio/.test(text) && turns <= 2) {
    if (persona === "terza") return "Ok… e chi cerca esattamente?";
    return personality === "diffidente"
      ? "Sì ho capito, ma come ha preso questo numero?"
      : "Sì, dimmi pure di cosa si tratta.";
  }

  if (/pagare|pagamento|rata|bonifico|accordo|soluzione|piano/.test(text)) {
    if (persona === "garante") {
      return hard
        ? "Guardi, io non pago io. Deve parlare con lui, non è un mio problema."
        : "Capisco, però non riguarda me: deve sentirsi con lui.";
    }
    if (persona === "terza") {
      return "Adesso non è il momento, può richiamare più tardi?";
    }
    if (personality === "collaborativo" && !hard && turns >= 3) {
      return "Se mi spiega bene importo e scadenza posso vedere… ma adesso non ho tutto.";
    }
    return pick(
      [
        "Adesso non ho i soldi, mi richiami il mese prossimo.",
        "Il debito è alto, non posso impegnarmi così al telefono.",
        "Devo prima vedere l'estratto conto, non riconosco queste cifre.",
        hard ? "Non mi interessa, avete già chiamato e non ho niente da aggiungere." : "Vediamo, ma non le prometto niente oggi.",
      ],
      seed
    );
  }

  if (/debit|importo|euro|mora|pratica/.test(text)) {
    if (persona === "terza") {
      return "Aspetti, di che debito parla? Io non so di cosa si tratta.";
    }
    if (persona === "garante") {
      return "Non ero informato. Parlate con lui, io non c'entro.";
    }
    return pick(
      [
        `Non so se corrisponde${praticaHint ? "" : ""}. Mi manda tutto per iscritto?`,
        "Ho altre priorità adesso, ho perso il lavoro e non posso.",
        personality === "aggressivo"
          ? "La banca mi ha già trattato male, non accetto questo tono."
          : "Devo parlarne in famiglia, ora non decido niente.",
      ],
      seed
    );
  }

  if (/arrivederci|saluto|richiam|termino|chiudo|buona giornata/.test(text)) {
    return "Va bene, arrivederci.";
  }

  if (persona === "terza") {
    return pick(
      [
        "Guardi, adesso è occupato. Lasci il recapito.",
        "Posso sapere se è urgente, prima di disturbare?",
        "Non è il momento, richiami più tardi.",
      ],
      seed
    );
  }

  if (persona === "garante") {
    return pick(
      [
        "Le ripeto: non riguarda me.",
        "Io non pago. Deve sentirsi con lui.",
        "Non è un mio problema, mi scusi.",
      ],
      seed
    );
  }

  if (personality === "aggressivo") {
    return "Senta, vada al sodo: cosa vuole precisamente?";
  }
  if (personality === "emotivo") {
    return "Mi sta mettendo ansia… non so come uscirne, capisce?";
  }
  if (personality === "manipolatore") {
    return "Se mi va incontro io valuto, altrimenti chiudiamo qui.";
  }

  return pick(
    [
      "Non è il momento, sto lavorando.",
      "Mi deve spiegare meglio, non ho capito.",
      "Richiami, adesso non posso parlare.",
      "Vediamo, ma non le dico di sì così.",
    ],
    seed
  );
}
