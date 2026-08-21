import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { AccountEditor } from "@/components/account/AccountEditor";
import { giorniAllaScadenzaPassword } from "@/lib/passwordPolicy";
import type { Role } from "@/lib/permissions";

export default async function AccountPage() {
  const session = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      name: true,
      email: true,
      role: true,
      interno: true,
      prefissoChiamata: true,
      passwordChangedAt: true,
      postazione: { select: { nome: true, interno: true } },
    },
  });
  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl p-3 md:p-4">
      <PageHeader
        title="Account"
        subtitle="Password, interno e prefisso chiamata per il centralino"
      />
      <AccountEditor
        user={{
          name: user.name,
          email: user.email,
          role: user.role as Role,
          interno: user.interno?.trim() || user.postazione?.interno || "",
          prefissoChiamata: user.prefissoChiamata || "",
          postazioneNome: user.postazione?.nome ?? null,
          postazioneInterno: user.postazione?.interno ?? null,
          giorniAllaScadenza: giorniAllaScadenzaPassword(user.passwordChangedAt),
        }}
      />
    </div>
  );
}
