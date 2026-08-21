/** Formato righe registro note stile CG32: SIGLA gg/mm/aaaa hh:mm testo */

export function operatorSigla(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name.slice(0, 3) || "OPR").toUpperCase();
}

export function formatNotaLine(input: {
  userName: string;
  createdAt: Date | string;
  tipo?: string | null;
  esito?: string | null;
  nota?: string | null;
}): string {
  const sigla = operatorSigla(input.userName);
  const d = new Date(input.createdAt);
  const date = d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts: string[] = [];
  if (input.tipo === "TELEFONATA" && input.esito) {
    parts.push(esitoLabel(input.esito));
  } else if (input.tipo === "LETTERA") {
    parts.push("Lettera / sollecito");
  } else if (input.tipo === "SMS") {
    parts.push("SMS");
  } else if (input.tipo && input.tipo !== "NOTA") {
    parts.push(input.tipo.replace(/_/g, " ").toLowerCase());
  }
  if (input.esito && input.tipo !== "TELEFONATA") {
    parts.push(esitoLabel(input.esito));
  }
  if (input.nota?.trim()) parts.push(input.nota.trim());
  const body = parts.join(" — ") || "—";
  return `${sigla} ${date} ${time} ${body}`;
}

function esitoLabel(esito: string): string {
  const map: Record<string, string> = {
    CONTATTO: "contatto",
    NON_RISPONDE: "non risponde",
    PROMESSA: "promessa pagamento",
    RIFIUTO: "rifiuto",
    RECAPITO_ERRATO: "recapito errato",
    INESIGIBILE: "inesigibile",
    ALTRO: "altro",
  };
  return map[esito] || esito.toLowerCase();
}

/** Testo nota registro per messaggio interno collegato a pratica. */
export function formatMessaggioCollegaNota(input: {
  fromName: string;
  toNames: string[];
  testo: string;
}): string {
  const dest = input.toNames.filter(Boolean).join(", ") || "—";
  return `Da: ${input.fromName.trim()} — A: ${dest} — ${input.testo.trim()}`;
}

function dataOraNota(at = new Date()) {
  const date = at.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = at.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date, time };
}

/** Bozza nota dopo chiamata o e-mail (resta editabile). */
export function formatNotaAzioneContatto(input: {
  userName: string;
  azione: "chiamata" | "mail" | "sms";
  dest: string;
  testo?: string;
  prefisso?: string | null;
  at?: Date;
}): string {
  const sigla = operatorSigla(input.userName);
  const { date, time } = dataOraNota(input.at);
  const dest = input.dest.trim();
  const extra = input.testo?.trim();
  const prefisso = (input.prefisso || "").trim();
  const corpo =
    input.azione === "chiamata"
      ? prefisso
        ? `ha chiamato al ${dest} con prefisso ${prefisso}`
        : `ha chiamato al ${dest}`
      : input.azione === "sms"
        ? `ha inviato SMS al ${dest}${extra ? `: ${extra}` : ""}`
        : `ha inviato e-mail a ${dest}`;
  return `${sigla} ${date} ${time} ${corpo} `;
}
