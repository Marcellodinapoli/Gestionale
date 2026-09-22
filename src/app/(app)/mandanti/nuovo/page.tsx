import { canManageMandantePerimetriWithNav, requireNavPage } from "@/lib/guard";
import { MandanteSchedaEditor } from "@/components/mandanti/MandanteSchedaEditor";

export default async function NuovaMandantePage() {
  const user = await requireNavPage("mandanti");
  const canManagePerimetri = await canManageMandantePerimetriWithNav(user);

  return (
    <MandanteSchedaEditor
      ruolo={user.role}
      canManagePerimetri={canManagePerimetri}
      isNew
      mandante={{
        id: "",
        codice: "",
        ragioneSociale: "",
        email: null,
        telefono: null,
        referente: null,
        referenteTelefono: null,
        referenteEmail: null,
        pec: null,
        indirizzo: null,
        citta: null,
        cap: null,
        provincia: null,
        provvigionePerc: null,
        provvigioniMetodo: null,
        incentivoTipo: null,
        incentivoValore: null,
        incentivoSoglia: null,
        incentivoNote: null,
        codiciScarico: null,
        smsPreimpostati: null,
        perimetri: null,
        pratiche: 0,
      }}
    />
  );
}
