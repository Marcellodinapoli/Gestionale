import { Suspense } from "react";

import { Card } from "@/components/ui";

import { AffidiMonitorFiltri } from "@/components/affidi/AffidiMonitorFiltri";

import type { MandantePerimetriAffidi } from "@/lib/affidi/affidiMonitorPerimetri";

import type { AffidiNavParams } from "@/components/affidi/AffidiCaricoOperatori";

export function AffidiMonitoraggioPanel({
  mandanti,
  mandatoId,
  perimetro,
  searchActive,
  extraParams,
}: {
  mandanti: MandantePerimetriAffidi[];
  mandatoId?: string;
  perimetro?: string;
  searchActive?: boolean;
  extraParams?: Pick<
    AffidiNavParams,
    | "operatore"
    | "coda"
    | "sezione"
    | "caricoMandato"
    | "caricoPerimetro"
    | "caricoMese"
    | "caricoCerca"
  >;
}) {
  return (
    <Card title="Monitoraggio operativo">
      <p className="mb-3 text-xs text-[var(--muted)]">
        Imposta mandato/perimetro e premi Filtra per l&apos;elenco Affida sotto. Le card{" "}
        <strong>Allerte</strong> sopra aprono lo stesso elenco filtrato.
      </p>
      <Suspense fallback={null}>
        <AffidiMonitorFiltri
          mandanti={mandanti}
          mandatoId={mandatoId}
          perimetro={perimetro}
          searchActive={searchActive}
          extraParams={extraParams}
        />
      </Suspense>
    </Card>
  );
}
