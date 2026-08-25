"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteLavorazionePianoAction } from "@/actions/lavorazioneSuggerita";
import { LavorazioneSuggeritaBar } from "@/components/lavorazione/LavorazioneSuggeritaBar";
import type { PerimetroRigaLavorazione, VoceLavorazioneConConteggi } from "@/lib/lavorazioneSuggerita";

export type PianoLavorazioneSalvato = {
  data: string;
  voci: VoceLavorazioneConConteggi[];
};

function buildModificaHref(giorno: string, gruppoId?: string) {
  const sp = new URLSearchParams();
  sp.set("giorno", giorno);
  sp.set("modifica", "1");
  if (gruppoId) sp.set("gruppo", gruppoId);
  return `/lavorazione?${sp.toString()}`;
}

function labelGiorno(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function LavorazionePianiSalvati({
  piani,
  operatoriGruppo,
  supervisorId,
  supervisorName,
  gruppoNome,
  gruppoId,
  dataCorrente,
  inModifica,
  mandanti,
  lotti,
  perimetriRiga,
}: {
  piani: PianoLavorazioneSalvato[];
  operatoriGruppo: Array<{ id: string; name: string; role: string }>;
  supervisorId: string;
  supervisorName?: string | null;
  gruppoNome?: string | null;
  gruppoId?: string;
  dataCorrente?: string;
  inModifica?: boolean;
  mandanti?: Array<{ id: string; codice: string; ragioneSociale: string }>;
  lotti?: string[];
  perimetriRiga?: PerimetroRigaLavorazione[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!piani.length) return null;

  function eliminaPiano(data: string) {
    const ok = window.confirm(
      `Eliminare il piano di lavorazione del ${labelGiorno(data)}?\nL'operazione non può essere annullata.`
    );
    if (!ok) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("supervisorId", supervisorId);
      fd.set("dataPiano", data);
      await deleteLavorazionePianoAction(fd);
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 border-t border-[var(--line)] pt-6">
      <div>
        <h2 className="text-sm font-semibold text-[var(--navy)]">Lavorazioni salvate</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Anteprima dei piani pubblicati. Modifica o elimina ogni giorno salvato.
        </p>
      </div>

      <div className="space-y-6">
        {piani.map((piano) => {
          const isCorrente = piano.data === dataCorrente;
          return (
            <div
              key={piano.data}
              className={`rounded-xl border bg-[#fafbfc] p-3 shadow-sm ${
                isCorrente ? "border-[var(--navy)] ring-1 ring-[var(--navy)]/20" : "border-[var(--line)]"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[var(--muted)]">
                  {labelGiorno(piano.data)}
                  {isCorrente ? (
                    <span className="ml-2 font-medium text-[var(--navy)]">· in modifica sopra</span>
                  ) : null}
                </p>
                <div className="flex items-center gap-2">
                  <Link
                    href={buildModificaHref(piano.data, gruppoId)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--navy)] hover:bg-slate-50"
                  >
                    <Pencil className="h-3 w-3" /> Modifica
                  </Link>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => eliminaPiano(piano.data)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" /> Elimina
                  </button>
                </div>
              </div>
              <LavorazioneSuggeritaBar
                voci={piano.voci}
                operatoriGruppo={operatoriGruppo}
                mostraOperatori
                canEdit={false}
                supervisorId={supervisorId}
                dataPiano={piano.data}
                pianoSalvato
                supervisorName={supervisorName}
                gruppoNome={gruppoNome}
                mandanti={mandanti}
                lotti={lotti}
                perimetriRiga={perimetriRiga}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
