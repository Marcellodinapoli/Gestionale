import type { GruppoLavoro } from "@/lib/gruppoLavoroUi";
import type { GruppoEditorData } from "@/lib/gruppoEditor/loadGruppoEditorData";
import {
  GruppoOperatoriLista,
  MembroGruppoRiga,
} from "@/components/affidi/GruppoOperatoriLista";
import { GruppoLavoroHomeManageButton } from "@/components/home/GruppoLavoroHomeManageButton";

export function GruppoLavoroHomeCard({
  gruppo,
  currentUserId,
  canManage,
  sectionTitle,
  readOnly,
  gruppoEditor,
  supervisorNameForHint,
}: {
  gruppo: GruppoLavoro;
  currentUserId: string;
  canManage?: boolean;
  /** Titolo sezione (es. home operatore). */
  sectionTitle?: string;
  /** Solo consultazione (es. operatore). */
  readOnly?: boolean;
  /** Popup gestione gruppo (supervisor). */
  gruppoEditor?: GruppoEditorData | null;
  /** Nome del supervisor del gruppo mostrato (per hint nel modale). */
  supervisorNameForHint?: string;
}) {
  const supervisor = gruppo.members.find((m) => m.role === "SUPERVISOR");
  const operatori = gruppo.members.filter((m) => m.role === "OPERATOR");

  if (!supervisor && !readOnly) return null;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          className={`text-[11px] font-semibold tracking-wider text-[var(--muted)] ${
            sectionTitle ? "" : "uppercase"
          }`}
        >
          {sectionTitle ??
            (gruppo.gruppoNome
              ? `Gruppo di lavoro · ${gruppo.gruppoNome}`
              : "Gruppo di lavoro")}
        </h2>
        {!readOnly && canManage && gruppoEditor ? (
          <GruppoLavoroHomeManageButton
            editor={gruppoEditor}
            supervisorName={
              gruppo.supervisorName ?? supervisorNameForHint ?? "il supervisor del gruppo"
            }
            canCreateGroup={gruppoEditor.supervisorId === currentUserId}
          />
        ) : !readOnly ? (
          <p className="text-xs text-[var(--muted)]">
            Composizione definita dal supervisor del gruppo.
          </p>
        ) : null}
      </div>
      <section className="min-h-0 flex-1 rounded-lg border-2 border-[var(--accent)]/30 bg-[#f8fbfd] px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
          <div className="min-w-0 shrink-0 sm:min-w-[280px]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Supervisor
            </p>
            <div className="mt-1.5">
              {supervisor ? (
                <MembroGruppoRiga
                  membro={supervisor}
                  isSelf={supervisor.id === currentUserId}
                  currentUserId={currentUserId}
                />
              ) : (
                <p className="text-xs text-[var(--muted)]">
                  Nessun supervisor assegnato al tuo profilo.
                </p>
              )}
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
