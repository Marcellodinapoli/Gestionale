import Link from "next/link";

/** Filtro sede (solo Admin) per pagine rendimento. */
export function SedeRendimentoFilter({
  sedi,
  sedeId,
  basePath,
  keepParams,
}: {
  sedi: Array<{ id: string; nome: string }>;
  sedeId?: string | null;
  basePath: string;
  keepParams?: Record<string, string | undefined>;
}) {
  if (!sedi.length) return null;

  function hrefFor(id: string) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(keepParams || {})) {
      if (v) qs.set(k, v);
    }
    if (id) qs.set("sede", id);
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs font-semibold uppercase text-[var(--muted)]">Sede</span>
      <Link
        href={hrefFor("")}
        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
          !sedeId
            ? "border-[var(--navy)] bg-[var(--navy)] text-white"
            : "border-[var(--line)] bg-white text-[var(--navy)] hover:bg-slate-50"
        }`}
      >
        Tutte
      </Link>
      {sedi.map((s) => (
        <Link
          key={s.id}
          href={hrefFor(s.id)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            sedeId === s.id
              ? "border-[var(--navy)] bg-[var(--navy)] text-white"
              : "border-[var(--line)] bg-white text-[var(--navy)] hover:bg-slate-50"
          }`}
        >
          {s.nome}
        </Link>
      ))}
    </div>
  );
}
