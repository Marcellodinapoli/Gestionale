export type MessaggioInternoSerialized = {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromName: string;
  toName: string;
  testo: string;
  createdAt: string;
  letto: boolean;
  lettoAt: string | null;
  praticaId: string | null;
  praticaNumero: string | null;
  debitore: string | null;
};
