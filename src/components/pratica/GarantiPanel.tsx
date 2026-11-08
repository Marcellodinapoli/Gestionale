"use client";

import { AnagraficaRecapiti } from "@/components/pratica/AnagraficaRecapiti";
import type { SmsPreset } from "@/lib/smsPreimpostati";
import type { PagamentiIntestazioniPerimetro } from "@/lib/mandantePerimetri";
import {
  AnagraficaField,
  AnagraficaNomeRiga,
  anagraficaDatiRecapitiGridClassName,
  anagraficaSplitCellClass,
  indirizzoCompleto,
} from "@/components/pratica/anagraficaUi";

type Garante = {
  id: string;
  nome: string;
  cognome: string;
  codiceFiscale?: string | null;
  telefono?: string | null;
  telefonoStato?: string | null;
  email?: string | null;
  indirizzo?: string | null;
  citta?: string | null;
  cap?: string | null;
  provincia?: string | null;
  recapiti?: Array<{ id: string; tipo: string; valore: string; stato?: string | null }>;
};

export function GarantiPanel({
  praticaId,
  garanti,
  canEdit,
  operatoreName,
  prefissoChiamata,
  smsPresets = [],
  importoNetto = 0,
  importoConcordatoIniziale,
  numeroPratica,
  smsPagamenti,
  rootClassName,
}: {
  praticaId: string;
  garanti: Garante[];
  canEdit: boolean;
  operatoreName?: string | null;
  prefissoChiamata?: string | null;
  smsPresets?: SmsPreset[];
  importoNetto?: number;
  importoConcordatoIniziale?: number | null;
  numeroPratica?: string | null;
  smsPagamenti?: PagamentiIntestazioniPerimetro | null;
  rootClassName?: string;
}) {
  return (
    <div
      className={
        rootClassName ??
        "min-w-0 border-b border-[var(--line)] lg:col-span-4 lg:border-b-0 lg:border-r"
      }
    >
      <div className="bg-[#c5d4e3] px-2 py-1 text-[11px] font-bold uppercase text-[#1a365d]">
        Garanti
      </div>
      <div className="p-1">
        {garanti.length === 0 ? (
          <p className="border border-[var(--line)] bg-white px-2 py-2 text-xs italic text-[var(--muted)]">
            Nessun garante registrato
          </p>
        ) : (
          <ul className="space-y-1">
            {garanti.map((g, i) => (
              <li
                key={g.id}
                className="border border-[var(--line)] bg-white px-1 py-1"
              >
                <div className={anagraficaDatiRecapitiGridClassName}>
                  <AnagraficaNomeRiga>
                    {i + 1}. {g.cognome} {g.nome}
                  </AnagraficaNomeRiga>
                  <div className={anagraficaSplitCellClass(2, 1)}>
                    <AnagraficaField
                      wide
                      compact
                      stretch
                      label="Indirizzo"
                      value={indirizzoCompleto(g)}
                    />
                  </div>
                  <div className={anagraficaSplitCellClass(3, 1)}>
                    <AnagraficaField
                      wide
                      compact
                      stretch
                      label="Cod. fiscale"
                      value={g.codiceFiscale || "—"}
                    />
                  </div>
                  <AnagraficaRecapiti
                    praticaId={praticaId}
                    garanteId={g.id}
                    telefono={g.telefono ?? null}
                    telefonoStato={g.telefonoStato ?? null}
                    email={g.email ?? null}
                    recapiti={g.recapiti || []}
                    canEdit={canEdit}
                    layout="recapiti-righe"
                    operatoreName={operatoreName}
                    prefissoChiamata={prefissoChiamata}
                    smsPresets={smsPresets}
                    importoNetto={importoNetto}
                    importoConcordatoIniziale={importoConcordatoIniziale}
                    numeroPratica={numeroPratica}
                    smsPagamenti={smsPagamenti}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
