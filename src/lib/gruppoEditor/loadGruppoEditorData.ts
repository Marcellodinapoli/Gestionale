import "server-only";
import { mandantiDbFromUser } from "@/lib/mandantiRepo";
import { usersDbFromUser } from "@/lib/usersRepo";
import { parsePerimetriList } from "@/lib/mandantePerimetri";
import { getGruppoLavoroForSupervisor } from "@/lib/gruppoLavoro";
import type { SessionUser } from "@/lib/permissions";
import type {
  GruppoInfoAltro,
  MandanteOptionGruppo,
  OperatoreAnagraficaGruppo,
} from "@/lib/gruppoEditor/types";

export type GruppoEditorData = {
  supervisorId: string;
  membri: GruppoLavoro["members"];
  gruppoNome: string | null;
  gruppoMandanti: GruppoLavoro["gruppoMandanti"];
  mandanti: MandanteOptionGruppo[];
  tuttiOperatori: OperatoreAnagraficaGruppo[];
  altriGruppi: GruppoInfoAltro[];
};

/** Dati per Crea / Gestisci gruppo in Home. Solo supervisor (proprio o altro del tenant). */
export async function loadGruppoEditorDataForSupervisor(
  user: SessionUser,
  supervisorId: string
): Promise<GruppoEditorData | null> {
  if (user.role !== "SUPERVISOR") return null;

  const userModel = usersDbFromUser(user);
  const supRow = await userModel.findFirst({
    where: {
      id: supervisorId,
      tenantId: user.tenantId,
      role: "SUPERVISOR",
      active: true,
    },
    select: { id: true },
  });
  if (!supRow) return null;

  const gruppo = await getGruppoLavoroForSupervisor(user.tenantId, supervisorId);

  const mandantiDb = await mandantiDbFromUser(user).findMany({
    where: { tenantId: user.tenantId },
    orderBy: { codice: "asc" },
    select: { id: true, codice: true, ragioneSociale: true, perimetri: true },
  });

  const mandanti: MandanteOptionGruppo[] = mandantiDb.map((m) => ({
    id: m.id,
    codice: m.codice,
    ragioneSociale: m.ragioneSociale,
    perimetri: parsePerimetriList(m.perimetri),
  }));

  const tuttiOperatoriRaw = await usersDbFromUser(user).findMany({
    where: { tenantId: user.tenantId, role: "OPERATOR", active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      supervisorId: true,
      supervisor: { select: { name: true } },
    },
  });

  const tuttiOperatori: OperatoreAnagraficaGruppo[] = tuttiOperatoriRaw.map((o) => ({
    id: o.id,
    name: o.name,
    supervisorId: o.supervisorId,
    supervisorName: o.supervisor?.name ?? null,
  }));

  const altriGruppiRaw = await usersDbFromUser(user).findMany({
    where: {
      tenantId: user.tenantId,
      role: "SUPERVISOR",
      active: true,
      id: { not: supervisorId },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      gruppoNome: true,
      gruppoMandanti: true,
    },
  });

  const altriGruppiOperatori =
    altriGruppiRaw.length > 0
      ? await usersDbFromUser(user).findMany({
          where: {
            tenantId: user.tenantId,
            role: "OPERATOR",
            active: true,
            supervisorId: { in: altriGruppiRaw.map((s) => s.id) },
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true, supervisorId: true },
        })
      : [];

  const altriGruppi: GruppoInfoAltro[] = altriGruppiRaw.map((sup) => ({
    id: sup.id,
    name: sup.name,
    gruppoNome: sup.gruppoNome,
    operators: altriGruppiOperatori
      .filter((o) => o.supervisorId === sup.id)
      .map((o) => ({ id: o.id, name: o.name })),
  }));

  return {
    supervisorId,
    membri: gruppo.members,
    gruppoNome: gruppo.gruppoNome,
    gruppoMandanti: gruppo.gruppoMandanti,
    mandanti,
    tuttiOperatori,
    altriGruppi,
  };
}
