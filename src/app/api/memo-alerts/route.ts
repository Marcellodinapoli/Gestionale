import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { praticaScopeWhere } from "@/lib/gruppoPerimetroScope";
import { can, isManutenzione } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  formatMemoAlertLine,
  memoAlertWindow,
  MEMO_ALERT_GRACE_MINUTES,
  MEMO_ALERT_MINUTES_BEFORE,
} from "@/lib/memoAlerts";
import { operatorSigla } from "@/lib/noteFormat";
import { isSanzioneAttivaTesto } from "@/lib/sanzioneIncassoMassivo";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (isManutenzione(user)) return NextResponse.json({ alerts: [], total: 0 });

  const baseScope = await praticaScopeWhere(user);

  const now = new Date();
  // memoAt in [now - grace, now + before] ⇔ now in memoAlertWindow(memoAt)
  const memoAtGte = new Date(now.getTime() - MEMO_ALERT_GRACE_MINUTES * 60_000);
  const memoAtLte = new Date(now.getTime() + MEMO_ALERT_MINUTES_BEFORE * 60_000);

  const alerts: Array<{
    kind: "agenda" | "collega" | "sanzione";
    id?: string;
    praticaId: string | null;
    numero: string;
    memoAtMs?: number;
    time?: string;
    line: string;
    fromSigla: string;
    fromName: string;
  }> = [];

  if (can(user, "agenda:view")) {
    const pratiche = await prisma.pratica.findMany({
      where: {
        AND: [
          baseScope,
          { memoAt: { gte: memoAtGte, lte: memoAtLte } },
        ],
      },
      select: {
        id: true,
        numero: true,
        memoAt: true,
        debitore: { select: { nome: true, cognome: true, telefono: true } },
        mandante: { select: { codice: true } },
      },
      orderBy: { memoAt: "asc" },
      take: 50,
    });
    for (const p of pratiche) {
      if (!p.memoAt || !memoAlertWindow(p.memoAt, now).active) continue;
      alerts.push({
        kind: "agenda",
        praticaId: p.id,
        numero: p.numero,
        memoAtMs: p.memoAt.getTime(),
        time: p.memoAt.toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        line: formatMemoAlertLine({
          memoAt: p.memoAt,
          cognome: p.debitore.cognome,
          nome: p.debitore.nome,
          telefono: p.debitore.telefono,
          mandanteCodice: p.mandante.codice,
        }),
        fromSigla: "AGE",
        fromName: "AGENDA",
      });
    }

    const impegni = await prisma.impegnoAgenda.findMany({
      where: {
        userId: user.id,
        completato: false,
        memoAt: { gte: memoAtGte, lte: memoAtLte },
      },
      orderBy: { memoAt: "asc" },
      take: 50,
    });
    for (const i of impegni) {
      if (!memoAlertWindow(i.memoAt, now).active) continue;
      alerts.push({
        kind: "agenda",
        praticaId: null,
        numero: "",
        memoAtMs: i.memoAt.getTime(),
        time: i.memoAt.toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        line: i.nota ? `${i.titolo} — ${i.nota}` : i.titolo,
        fromSigla: "IMP",
        fromName: "IMPEGNO",
      });
    }
  }

  const intern = await prisma.messaggioInterno.findMany({
    where: { toUserId: user.id, letto: false },
    include: {
      fromUser: { select: { name: true } },
      pratica: {
        select: {
          numero: true,
          debitore: { select: { nome: true, cognome: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
  for (const m of intern) {
    const p = m.pratica;
    const d = p?.debitore;
    const sanzione = isSanzioneAttivaTesto(m.testo);
    alerts.push({
      kind: sanzione ? "sanzione" : "collega",
      id: m.id,
      praticaId: m.praticaId,
      numero: p?.numero || "",
      line: sanzione
        ? m.testo
        : p && d
          ? `${p.numero} ${d.cognome} ${d.nome}\n${m.testo}`
          : `Messaggio indipendente\n${m.testo}`,
      fromSigla: operatorSigla(m.fromUser.name),
      fromName: m.fromUser.name,
    });
  }

  // Sanzioni in cima alla coda popup
  alerts.sort((a, b) => {
    if (a.kind === "sanzione" && b.kind !== "sanzione") return -1;
    if (b.kind === "sanzione" && a.kind !== "sanzione") return 1;
    return 0;
  });

  return NextResponse.json({ alerts, total: alerts.length });
}
