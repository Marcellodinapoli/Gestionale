import "server-only";
import { attivitaDbFromUser } from "@/lib/attivitaRepo";
import type { SessionUser } from "@/lib/permissions";

export type PraticaNotaDto = {
  id: string;
  tipo: string;
  esito: string | null;
  nota: string | null;
  scheduledAt: string | null;
  createdAt: string;
  fissata: boolean;
  importante: boolean;
  bloccata: boolean;
  user: { name: string };
};

function toIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string") return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toIsoRequired(value: unknown): string {
  return toIso(value) ?? new Date(0).toISOString();
}

/** Carica le attività/note di una pratica (connector o Firestore). */
export async function loadPraticaNote(user: SessionUser, praticaId: string): Promise<PraticaNotaDto[]> {
  const rows = await attivitaDbFromUser(user).findMany({
    where: { praticaId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (rows as Array<Record<string, unknown>>).map((a) => {
    const userObj = a.user as { name?: string | null } | null | undefined;
    return {
      id: String(a.id),
      tipo: String(a.tipo || "NOTA"),
      esito: a.esito != null ? String(a.esito) : null,
      nota: a.nota != null ? String(a.nota) : null,
      scheduledAt: toIso(a.scheduledAt),
      createdAt: toIsoRequired(a.createdAt),
      fissata: Boolean(a.fissata),
      importante: Boolean(a.importante),
      bloccata: Boolean(a.bloccata),
      user: {
        name: String(userObj?.name || a.userName || "").trim() || "Operatore",
      },
    };
  });
}

export function fingerprintNote(attivita: PraticaNotaDto[]): string {
  return attivita
    .map(
      (a) =>
        `${a.id}:${a.createdAt}:${a.fissata ? 1 : 0}:${a.importante ? 1 : 0}:${(a.nota || "").length}`
    )
    .join("|");
}
