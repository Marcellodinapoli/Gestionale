export type GruppoLavoro = {
  supervisorId: string | null;
  supervisorName: string | null;
  gruppoNome: string | null;
  gruppoMandanti: Array<{ mandanteId: string; perimetriIds: string[] }>;
  members: Array<{ id: string; name: string; role: string; email: string }>;
  memberIds: string[];
};
