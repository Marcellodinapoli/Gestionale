import { praticaDb } from "@/lib/praticheRepo";
import { formatMemoAlertLine } from "@/lib/memoAlerts";
import { messaggiAgendaFromUser } from "@/lib/messaggiAgendaRepo";
import type { SessionUser } from "@/lib/permissions";

function stubUser(tenantId: string, tenantSlug: string, userId = ""): SessionUser {
  return {
    tenantId,
    tenantSlug,
    id: userId,
    role: "ADMIN",
    name: "",
    email: "",
    active: true,
    supervisorId: null,
  } as SessionUser;
}

export async function syncMessaggioAgenda(input: {
  praticaId: string;
  userId: string;
  tenantId: string;
  tenantSlug: string;
  memoAt: Date | null;
  nota?: string | null;
}) {
  const repo = messaggiAgendaFromUser(stubUser(input.tenantId, input.tenantSlug, input.userId));

  if (!input.memoAt) {
    await markMessaggiLetti(input.praticaId, input.tenantId, input.tenantSlug);
    return;
  }

  const praticaModel = praticaDb({
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    role: "ADMIN",
    userId: input.userId,
  });
  const pratica = await praticaModel.findUnique({
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

  await repo.upsertOpen(input.tenantSlug, input.tenantId, {
    praticaId: input.praticaId,
    userId: input.userId,
    memoAt: input.memoAt,
    line,
  });
}

export async function markMessaggiLetti(
  praticaId: string,
  tenantId: string,
  tenantSlug?: string
) {
  const slug = tenantSlug ?? tenantId;
  const repo = messaggiAgendaFromUser(stubUser(tenantId, slug));
  await repo.markPraticaLetti(slug, tenantId, praticaId);
}
