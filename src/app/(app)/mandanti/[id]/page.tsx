import { notFound } from "next/navigation";
import { mandantiDbFromUser } from "@/lib/mandantiRepo";
import { canManageMandantePerimetriWithNav, requireNavPage } from "@/lib/guard";
import { MandanteSchedaEditor } from "@/components/mandanti/MandanteSchedaEditor";

export default async function MandanteDettaglioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireNavPage("mandanti");
  const canManagePerimetri = await canManageMandantePerimetriWithNav(user);
  const { id } = await params;

  const mandante = await mandantiDbFromUser(user).findFirst({
    where: { id, tenantId: user.tenantId },
    include: { _count: { select: { pratiche: true } } },
  });
  if (!mandante) notFound();

  return (
    <MandanteSchedaEditor
      ruolo={user.role}
      canManagePerimetri={canManagePerimetri}
      mandante={{
        id: mandante.id,
        codice: mandante.codice,
        ragioneSociale: mandante.ragioneSociale,
        email: mandante.email,
        telefono: mandante.telefono,
        referente: mandante.referente,
        referenteTelefono: mandante.referenteTelefono,
        referenteEmail: mandante.referenteEmail,
        pec: mandante.pec,
        indirizzo: mandante.indirizzo,
        citta: mandante.citta,
        cap: mandante.cap,
        provincia: mandante.provincia,
        provvigionePerc: mandante.provvigionePerc,
        provvigioniMetodo: mandante.provvigioniMetodo,
        incentivoTipo: mandante.incentivoTipo,
        incentivoValore: mandante.incentivoValore,
        incentivoSoglia: mandante.incentivoSoglia,
        incentivoNote: mandante.incentivoNote,
        codiciScarico: mandante.codiciScarico,
        smsPreimpostati: mandante.smsPreimpostati,
        perimetri: mandante.perimetri,
        pratiche: mandante._count?.pratiche ?? 0,
      }}
    />
  );
}
