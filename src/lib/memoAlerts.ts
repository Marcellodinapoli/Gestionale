export const MEMO_ALERT_MINUTES_BEFORE = 5;
export const MEMO_ALERT_GRACE_MINUTES = 15;

export function memoAlertWindow(memoAt: Date, now = new Date()) {
  const start = new Date(memoAt.getTime() - MEMO_ALERT_MINUTES_BEFORE * 60_000);
  const end = new Date(memoAt.getTime() + MEMO_ALERT_GRACE_MINUTES * 60_000);
  return { start, end, active: now >= start && now <= end };
}

export type MemoAlertPayload = {
  kind: "agenda" | "collega" | "sanzione";
  id?: string;
  praticaId: string | null;
  numero: string;
  memoAtMs?: number;
  time?: string;
  line: string;
  mandanteCodice?: string;
  fromSigla: string;
  fromName: string;
};

export function formatMemoAlertLine(input: {
  memoAt: Date;
  cognome: string;
  nome: string;
  telefono?: string | null;
  mandanteCodice: string;
}) {
  const time = input.memoAt.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const nome = `${input.cognome} ${input.nome}`.trim().toUpperCase();
  const tel = input.telefono || "";
  return `${time} ${nome} ${tel}(${input.mandanteCodice})`;
}
