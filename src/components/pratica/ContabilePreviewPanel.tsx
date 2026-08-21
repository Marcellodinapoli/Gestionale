"use client";

import { useState } from "react";
import { EstrattoContoPreview } from "@/components/pratica/EstrattoContoPreview";
import { IncassiPreview } from "@/components/pratica/IncassiPreview";

type Vista = "estratto" | "incassi";

const ZOOM_MIN = 0.75;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;
type Props = {
  debitore: {
    ndg?: string | null;
    codiceFiscale?: string | null;
    nome: string;
    cognome: string;
    telefono?: string | null;
    indirizzo?: string | null;
    citta?: string | null;
    cap?: string | null;
    provincia?: string | null;
  };
  numero: string;
  creditore: string;
  societa: string;
  scadenza: Date | null;
  fatture: Array<{ dataScadenza: Date; importo: number; pagato: number }>;
  incassi: Array<{
    id: string;
    data: Date;
    dataScadenza: Date | null;
    capitale: number;
    interessi: number;
    spese: number;
    speseRec: number;
    importo: number;
    modo: string | null;
    causale: string | null;
    metodo: string;
    user?: { name: string } | null;
  }>;
  affidato: number;
  definito: number;
};

export function ContabilePreviewPanel({
  debitore,
  numero,
  creditore,
  societa,
  scadenza,
  fatture,
  incassi,
  incassiRegistrati,
  affidato,
  definito,
}: Props & { incassiRegistrati: Props["incassi"] }) {
  const [vista, setVista] = useState<Vista>("estratto");
  const [zoom, setZoom] = useState(1);

  const tabCls = (active: boolean) =>
    `rounded px-1.5 py-px text-[10px] font-semibold uppercase ${
      active
        ? "bg-white text-[#1a365d] shadow-sm"
        : "text-[#1a365d]/70 hover:bg-white/60 hover:text-[#1a365d]"
    }`;

  const zoomBtnCls =
    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#1a365d]/25 bg-white text-sm font-bold leading-none text-[#1a365d] hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex min-h-[200px] min-w-0 flex-col lg:col-span-4 lg:h-0 lg:min-h-full">
      <div className="flex shrink-0 items-center gap-1 bg-[#c5d4e3] px-2 py-1">
        <button type="button" className={tabCls(vista === "estratto")} onClick={() => setVista("estratto")}>
          Estratto conto
        </button>
        <button type="button" className={tabCls(vista === "incassi")} onClick={() => setVista("incassi")}>
          Incassi registrati
        </button>
        <span className="ml-0.5 inline-flex items-center gap-0.5">
          <button
            type="button"
            className={zoomBtnCls}
            title="Riduci anteprima"
            aria-label="Riduci anteprima"
            disabled={zoom <= ZOOM_MIN + 0.001}
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
          >
            −
          </button>
          <button
            type="button"
            className={zoomBtnCls}
            title="Ingrandisci anteprima"
            aria-label="Ingrandisci anteprima"
            disabled={zoom >= ZOOM_MAX - 0.001}
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
          >
            +
          </button>
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div
          style={{ zoom }}
          className="min-w-full [&>*]:!h-auto [&>*]:overflow-visible"
        >
          {vista === "estratto" ? (
            <EstrattoContoPreview
              compact
              debitore={debitore}
              numero={numero}
              creditore={creditore}
              societa={societa}
              scadenza={scadenza}
              fatture={fatture}
              incassi={incassi}
              affidato={affidato}
              definito={definito}
            />
          ) : (
            <IncassiPreview compact incassi={incassiRegistrati} />
          )}
        </div>
      </div>
    </div>
  );
}