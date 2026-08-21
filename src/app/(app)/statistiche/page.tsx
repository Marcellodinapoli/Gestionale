import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { dataIt } from "@/lib/domain";
import { getGruppoLavoro } from "@/lib/gruppoLavoro";
import { parseGruppoMandanti } from "@/lib/gruppoMandanti";
import { isManutenzione } from "@/lib/permissions";
import { buildStatisticheGruppo } from "@/lib/statisticheGruppo";
import { PageHeader } from "@/components/ui";
import { StatisticheGriglia } from "@/components/statistiche/StatisticheGriglia";
import { StatisticheFiltriForm } from "@/components/statistiche/StatisticheFiltriForm";

function defaultAffidoDa() {
  return "2026-08-04";
}

function defaultAffidoA() {
  return "2026-08-31";
}

function parseDateInput(value?: string | null) {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function StatistichePage({
  searchParams,
}: {
  searchParams: Promise<{
    affidoDa?: string;
    affidoA?: string;
    mandanteId?: string;
    lotto?: string;
    gruppo?: string;
  }>;
}) {
  const user = await requirePermission("statistiche:view");
  const sp = await searchParams;
  const affidoDaStr = sp.affidoDa || defaultAffidoDa();
  const affidoAStr = sp.affidoA || defaultAffidoA();
  const affidoDa = parseDateInput(affidoDaStr);
  const affidoA = parseDateInput(affidoAStr);
  if (affidoA) affidoA.setHours(23, 59, 59, 999);

  const canFilterGruppo = ["ADMIN", "AMMINISTRAZIONE"].includes(user.role);
  const supervisori = canFilterGruppo
    ? await prisma.user.findMany({
        where: { tenantId: user.tenantId, role: "SUPERVISOR", active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, gruppoNome: true },
      })
    : [];

  let gruppo: Awaited<ReturnType<typeof getGruppoLavoro>>;

  if (canFilterGruppo && sp.gruppo) {
    const supId = sp.gruppo;
    const operators = await prisma.user.findMany({
      where: { tenantId: user.tenantId, supervisorId: supId, active: true, role: "OPERATOR" },
      select: { id: true, name: true, role: true, email: true },
      orderBy: { name: "asc" },
    });
    const sup = await prisma.user.findFirst({
      where: { id: supId, tenantId: user.tenantId },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        gruppoNome: true,
        gruppoMandanti: true,
      },
    });
    const members = [
      ...(sup ? [{ id: sup.id, name: sup.name, role: sup.role, email: sup.email }] : []),
      ...operators,
    ];
    gruppo = {
      supervisorId: supId,
      supervisorName: sup?.name ?? null,
      gruppoNome: sup?.gruppoNome ?? null,
      gruppoMandanti: parseGruppoMandanti(sup?.gruppoMandanti),
      members,
      memberIds: members.map((m) => m.id),
    };
  } else if (canFilterGruppo && !sp.gruppo) {
    const allOps = await prisma.user.findMany({
      where: { tenantId: user.tenantId, role: { in: ["OPERATOR", "SUPERVISOR"] }, active: true },
      select: { id: true, name: true, role: true, email: true },
      orderBy: { name: "asc" },
    });
    gruppo = {
      supervisorId: null,
      supervisorName: null,
      gruppoNome: null,
      gruppoMandanti: [],
      members: allOps,
      memberIds: allOps.map((o) => o.id),
    };
  } else {
    gruppo = await getGruppoLavoro(user);
  }

  const mandanti = isManutenzione(user)
    ? []
    : await prisma.mandante.findMany({ where: { tenantId: user.tenantId }, orderBy: { codice: "asc" } });

  const tutteLePratiche = canFilterGruppo && !sp.gruppo;
  const { righe, totale, praticheCount } = await buildStatisticheGruppo(
    gruppo,
    {
      affidoDa,
      affidoA,
      mandanteId: sp.mandanteId,
      lotto: sp.lotto?.trim(),
    },
    tutteLePratiche
      ? { tenantId: user.tenantId, tutteLePratiche: true }
      : undefined
  );

  const subtitle = canFilterGruppo
    ? sp.gruppo
      ? `Gruppo di ${gruppo.supervisorName || "—"}`
      : "Tutti i gruppi"
    : gruppo.supervisorName
      ? `Gruppo di ${gruppo.supervisorName} · ${gruppo.members.map((m) => m.name).join(", ")}`
      : `Gruppo · ${user.name}`;

  return (
    <div className="h-full min-h-0 overflow-y-auto pb-2">
      <PageHeader title="Statistiche" subtitle={subtitle} />

      <Suspense fallback={null}>
        <StatisticheFiltriForm
          mandanti={mandanti}
          affidoDa={affidoDaStr}
          affidoA={affidoAStr}
          mandanteId={sp.mandanteId}
          lotto={sp.lotto}
          gruppoId={sp.gruppo}
          supervisori={supervisori}
        />
      </Suspense>

      {praticheCount ? (
        <StatisticheGriglia
          righe={righe}
          totale={totale}
          dataReport={dataIt(new Date())}
          affidoDa={affidoDa ? dataIt(affidoDa) : affidoDaStr}
          affidoA={affidoA ? dataIt(affidoA) : affidoAStr}
        />
      ) : (
        <p className="rounded-lg border border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)]">
          Nessuna pratica nel periodo e nei filtri selezionati.
        </p>
      )}
    </div>
  );
}
