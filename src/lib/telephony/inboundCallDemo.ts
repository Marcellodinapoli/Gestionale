import type { InboundCallLookupResponse } from "@/lib/telephony/inboundLookupDto";

/** Dati fittizi per anteprima UI (nessuna chiamata API). */
export function buildInboundCallDemoResponse(
  numero = "3321000274"
): InboundCallLookupResponse {
  return {
    numero,
    matches: [
      {
        praticaId: "__demo_inbound__",
        numero: "DEMO-24001",
        debitore: "ROSSI MARIO",
        mandanteCodice: "MO",
        mandanteRagioneSociale: "Mandato dimostrativo",
        inLavorazione: true,
        statoLabel: "In lavorazione",
        praticaChiusa: false,
        residuo: 15420.5,
        nettoDaPagare: 13200,
        schedaApribile: true,
      },
    ],
  };
}
