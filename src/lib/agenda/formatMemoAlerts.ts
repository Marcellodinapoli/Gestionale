import "server-only";
import {
  formatMemoAlertLine,
  memoAlertWindow,
  type MemoAlertPayload,
} from "@/lib/memoAlerts";
import { operatorSigla } from "@/lib/noteFormat";
import { isSanzioneAttivaTesto } from "@/lib/sanzioneIncassoMassivo";
import type { MemoAlertsRawBundle } from "@/lib/data/contracts/agenda";

export function formatMemoAlertsFromBundle(raw: MemoAlertsRawBundle, now = new Date()) {
  const alerts: MemoAlertPayload[] = [];

  for (const p of raw.pratiche) {
    const memoAt = new Date(p.memoAt);
    if (!memoAlertWindow(memoAt, now).active) continue;
    alerts.push({
      kind: "agenda",
      praticaId: p.id,
      numero: p.numero,
      memoAtMs: memoAt.getTime(),
      time: memoAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      line: formatMemoAlertLine({
        memoAt,
        cognome: p.debitore.cognome,
        nome: p.debitore.nome,
        telefono: p.telefono ?? null,
        mandanteCodice: p.mandante?.codice ?? "",
      }),
      fromSigla: "AGE",
      fromName: "AGENDA",
    });
  }

  for (const i of raw.impegni) {
    const memoAt = new Date(i.memoAt);
    if (!memoAlertWindow(memoAt, now).active) continue;
    alerts.push({
      kind: "agenda",
      praticaId: null,
      numero: "",
      memoAtMs: memoAt.getTime(),
      time: memoAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      line: i.nota ? `${i.titolo} — ${i.nota}` : i.titolo,
      fromSigla: "IMP",
      fromName: "IMPEGNO",
    });
  }

  for (const m of raw.intern) {
    const msg = m as {
      id: string;
      praticaId: string | null;
      testo: string;
      fromUser?: { name: string };
      pratica?: {
        numero: string;
        debitore?: { nome: string; cognome: string };
      } | null;
    };
    const p = msg.pratica;
    const d = p?.debitore;
    const sanzione = isSanzioneAttivaTesto(msg.testo);
    alerts.push({
      kind: sanzione ? "sanzione" : "collega",
      id: msg.id,
      praticaId: msg.praticaId,
      numero: p?.numero || "",
      line: sanzione
        ? msg.testo
        : p && d
          ? `${p.numero} ${d.cognome} ${d.nome}\n${msg.testo}`
          : `Messaggio indipendente\n${msg.testo}`,
      fromSigla: operatorSigla(msg.fromUser?.name ?? ""),
      fromName: msg.fromUser?.name ?? "",
    });
  }

  alerts.sort((a, b) => {
    if (a.kind === "sanzione" && b.kind !== "sanzione") return -1;
    if (b.kind === "sanzione" && a.kind !== "sanzione") return 1;
    return 0;
  });

  return { alerts, total: alerts.length };
}
