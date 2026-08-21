"use client";

import { useState } from "react";
import { ImpegnoLiberoForm } from "@/components/agenda/ImpegnoLiberoForm";
import { ImpegnoPraticaForm } from "@/components/agenda/ImpegnoPraticaForm";

type Modo = "libero" | "pratica";

export function NuovoImpegnoAgenda({ onDone }: { onDone?: () => void }) {
  const [modo, setModo] = useState<Modo>("libero");

  return (
    <div className="p-3">
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={() => setModo("libero")}
          className={`rounded-lg px-3 py-1.5 ${
            modo === "libero" ? "bg-[#132033] text-white" : "border border-[var(--line)] bg-white"
          }`}
        >
          Impegno libero
        </button>
        <button
          type="button"
          onClick={() => setModo("pratica")}
          className={`rounded-lg px-3 py-1.5 ${
            modo === "pratica" ? "bg-[#132033] text-white" : "border border-[var(--line)] bg-white"
          }`}
        >
          Su pratica
        </button>
      </div>

      {modo === "libero" ? (
        <ImpegnoLiberoForm onDone={onDone} />
      ) : (
        <ImpegnoPraticaForm onDone={onDone} />
      )}
    </div>
  );
}
