import Link from "next/link";
import type { GruppoLavoro } from "@/lib/gruppoLavoroUi";
import {
  GruppoOperatoriLista,
  MembroGruppoRiga,
} from "@/components/affidi/GruppoOperatoriLista";

export function GruppoLavoroHomeCard({
  gruppo,
  currentUserId,
  canManage,
}: {
  gruppo: GruppoLavoro;
  currentUserId: string;
  canManage?: boolean;
}) {
  const supervisor = gruppo.members.find((m) => m.role === "SUPERVISOR");
  const operatori = gruppo.members.filter((m) => m.role === "OPERATOR");

  if (!supervisor) return null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          {gruppo.gruppoNome
            ? `Gruppo di lavoro · ${gruppo.gruppoNome}`
            : "Gruppo di lavoro"}
        </h2>
        {canManage ? (
          <Link href="/affidi" className="text-xs text-[var(--accent)] underline">
            Gestisci gruppo in Affidi
          </Link>
        ) : (
          <p className="text-xs text-[var(--muted)]">
            Composizione definita dal supervisor in Affidi
          </p>
        )}
      </div>
      <section className="rounded-lg border-2 border-[var(--accent)]/30 bg-[#f8fbfd] px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
          <div className="min-w-0 shrink-0 sm:min-w-[280px]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Supervisor
            </p>
            <div className="mt-1.5">
              <MembroGruppoRiga
                membro={supervisor}
                isSelf={supervisor.id === currentUserId}
                currentUserId={currentUserId}
              />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              {operatori.length === 1 ? "Operatore" : "Operatori"}
            </p>
            <div className="mt-1.5">
              <GruppoOperatoriLista
                operatori={operatori}
                currentUserId={currentUserId}
                emptyMessage="Nessun operatore assegnato al gruppo."
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
