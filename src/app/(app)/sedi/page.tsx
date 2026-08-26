import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { canManageSedi } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { SediTable } from "@/components/sedi/SediTable";
import { NuovaSedeButton } from "@/components/sedi/NuovaSedeButton";

export default async function SediPage() {
  const user = await requireUser();
  if (!canManageSedi(user)) redirect("/");

  const sedi = await prisma.sede.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { nome: "asc" },
    include: {
      _count: { select: { postazioni: true, users: true } },
    },
  });

  const lista = sedi.map((s) => ({
    id: s.id,
    nome: s.nome,
    indirizzo: s.indirizzo,
    citta: s.citta,
    cap: s.cap,
    provincia: s.provincia,
    telefono: s.telefono,
    email: s.email,
    note: s.note,
    active: s.active,
    nPostazioni: s._count?.postazioni ?? 0,
    nUtenti: s._count?.users ?? 0,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sedi"
        subtitle="Gestisci le sedi dell’azienda. Postazioni e operatori si collegano a una sede."
        action={<NuovaSedeButton />}
      />

      <Card>
        <SediTable sedi={lista} />
      </Card>
    </div>
  );
}
