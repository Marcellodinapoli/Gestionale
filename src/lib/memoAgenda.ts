import { prisma } from "@/lib/prisma";
import { formatMemoAlertLine } from "@/lib/memoAlerts";

export async function syncMessaggioAgenda(input: {
  praticaId: string;
  userId: string;
  memoAt: Date | null;
  nota?: string | null;
}) {
  if (!input.memoAt) {
    await markMessaggiLetti(input.praticaId);
    return;
  }

  const pratica = await prisma.pratica.findUnique({
    where: { id: input.praticaId },
    include: { debitore: true, mandante: true },
  });
  if (!pratica) return;

  const base = formatMemoAlertLine({
    memoAt: input.memoAt,
    cognome: pratica.debitore.cognome,
    nome: pratica.debitore.nome,
    telefono: pratica.debitore.telefono,
    mandanteCodice: pratica.mandante.codice,
  });
  const nota = input.nota?.trim();
  const line = nota ? `${base} — ${nota}` : base;

  const aperto = await prisma.messaggioAgenda.findFirst({
    where: { praticaId: input.praticaId, letto: false },
    orderBy: { createdAt: "desc" },
  });

  if (aperto) {
    await prisma.messaggioAgenda.update({
      where: { id: aperto.id },
      data: { memoAt: input.memoAt, line, userId: input.userId },
    });
    return;
  }

  await prisma.messaggioAgenda.create({
    data: {
      praticaId: input.praticaId,
      userId: input.userId,
      memoAt: input.memoAt,
      line,
    },
  });
}

export async function markMessaggiLetti(praticaId: string) {
  await prisma.messaggioAgenda.updateMany({
    where: { praticaId, letto: false },
    data: { letto: true, lettoAt: new Date() },
  });
}
