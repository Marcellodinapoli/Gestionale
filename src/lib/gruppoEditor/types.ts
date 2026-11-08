import type { PerimetroListItem } from "@/lib/mandantePerimetri";

export type OperatoreAnagraficaGruppo = {
  id: string;
  name: string;
  supervisorId: string | null;
  supervisorName: string | null;
};

export type GruppoInfoAltro = {
  id: string;
  name: string;
  gruppoNome: string | null;
  operators: Array<{ id: string; name: string }>;
};

export type MandanteOptionGruppo = {
  id: string;
  codice: string;
  ragioneSociale: string;
  perimetri: PerimetroListItem[];
};
