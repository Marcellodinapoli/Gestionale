import { internoFittizio } from "@/lib/contattiInterni";
import { InviaMessaggioRapido } from "@/components/home/InviaMessaggioRapido";

export type MembroGruppo = { id: string; name: string; role: string; email: string };

function ContattiMembro({
  membro,
  showMessaggio,
}: {
  membro: MembroGruppo;
  showMessaggio?: boolean;
}) {
  const interno = internoFittizio(membro.id);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--muted)]">
      <span className="tabular-nums">Int. {interno}</span>
      <span aria-hidden className="text-[var(--line)]">
        ·
      </span>
      <a href={`mailto:${membro.email}`} className="truncate underline hover:text-[var(--accent)]">
        {membro.email}
      </a>
      {showMessaggio ? (
        <>
          <span aria-hidden className="text-[var(--line)]">
            ·
          </span>
          <InviaMessaggioRapido toUserId={membro.id} toUserName={membro.name} />
        </>
      ) : null}
    </span>
  );
}

export function MembroGruppoRiga({
  membro,
  isSelf,
  currentUserId,
}: {
  membro: MembroGruppo;
  isSelf?: boolean;
  currentUserId?: string;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        isSelf
          ? "border-[var(--accent)] bg-[#eef6fc]"
          : "border-[var(--line)] bg-white"
      }`}
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-[var(--navy)]">
            {membro.name}
            {isSelf ? (
              <span className="ml-1 text-xs font-normal text-[var(--muted)]">(tu)</span>
            ) : null}
          </span>
        </div>
        <ContattiMembro
          membro={membro}
          showMessaggio={Boolean(currentUserId && membro.id !== currentUserId)}
        />
      </div>
    </div>
  );
}

export function GruppoOperatoriLista({
  operatori,
  currentUserId,
  emptyMessage = "Nessun operatore nel gruppo.",
}: {
  operatori: MembroGruppo[];
  currentUserId?: string;
  emptyMessage?: string;
}) {
  if (!operatori.length) {
    return <p className="text-xs text-[var(--muted)]">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-2">
      {operatori.map((o) => (
        <li key={o.id}>
          <MembroGruppoRiga membro={o} isSelf={o.id === currentUserId} currentUserId={currentUserId} />
        </li>
      ))}
    </ul>
  );
}
