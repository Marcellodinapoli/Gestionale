"use client";



import { AnagraficaRecapiti } from "@/components/pratica/AnagraficaRecapiti";
import type { SmsPreset } from "@/lib/smsPreimpostati";

import {

  AnagraficaField,

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
}: {
  praticaId: string;
  garanti: Garante[];
  canEdit: boolean;
  operatoreName?: string | null;
  prefissoChiamata?: string | null;
  smsPresets?: SmsPreset[];
  importoNetto?: number;
  importoConcordatoIniziale?: number | null;
}) {

  return (

    <div className="min-w-0 border-b border-[var(--line)] lg:col-span-4 lg:border-b-0 lg:border-r">

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

                className="border border-[var(--line)] bg-white px-1.5 py-1"

              >

                <p className="mb-1 text-xs font-semibold uppercase">

                  {i + 1}. {g.cognome} {g.nome}

                </p>

                <div className="grid grid-cols-1 gap-0">

                  <AnagraficaField

                    wide

                    compact

                    label="Indirizzo"

                    value={indirizzoCompleto(g)}

                  />

                  <AnagraficaRecapiti

                    praticaId={praticaId}

                    garanteId={g.id}

                    telefono={g.telefono ?? null}

                    telefonoStato={g.telefonoStato ?? null}

                    email={g.email ?? null}

                    recapiti={g.recapiti || []}

                    canEdit={canEdit}

                    layout="debitore"

                    codiceFiscale={g.codiceFiscale}
                    operatoreName={operatoreName}
                    prefissoChiamata={prefissoChiamata}
                    smsPresets={smsPresets}
                    importoNetto={importoNetto}
                    importoConcordatoIniziale={importoConcordatoIniziale}
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


