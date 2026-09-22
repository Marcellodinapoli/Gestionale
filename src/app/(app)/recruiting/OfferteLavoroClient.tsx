"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Briefcase, CalendarClock, CheckCircle2, ChevronDown, ChevronRight, Inbox, Plus, Timer, UserCheck, UserRound, Users } from "lucide-react";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/ui";
import { SectionTabNav, sectionTabClass } from "@/components/ui/SectionTabNav";
import {
  aggiornaOffertaLavoroAction,
  chiudiOffertaLavoroAction,
  creaOffertaLavoroAction,
  syncIndeedApplicationsAction,
} from "@/actions/recruiting";
import {
  DICITURA_PARI_OPPORTUNITA,
  MODALITA_LAVORO,
  MODALITA_LAVORO_LABELS,
  ORARI_LAVORO,
  ORARIO_LAVORO_LABELS,
  STATO_OFFERTA_LAVORO_LABELS,
  TIPI_CONTRATTO,
  TIPO_CONTRATTO_LABELS,
  type ModalitaLavoro,
  type OrarioLavoro,
  type StatoOffertaLavoro,
  type TipoContratto,
} from "@/lib/recruiting/offerte";
import {
  STATO_CANDIDATURA_LABELS,
  anagraficaCandidato,
  type StatoCandidatura,
} from "@/lib/recruiting/candidature";
import {
  ESITO_COLLOQUIO_LABELS,
  STATO_COLLOQUIO_LABELS,
  type EsitoColloquio,
  type StatoColloquio,
} from "@/lib/recruiting/colloqui";
import {
  listCandidatureViste,
  markCandidaturaVista,
} from "@/lib/recruiting/candidatureVisteStorage";

type OffertaRow = {
  id: string;
  titolo: string;
  luogo: string;
  modalitaLavoro: ModalitaLavoro;
  tipoContratto: TipoContratto | "";
  orario: OrarioLavoro | "";
  numeroPosizioni: number;
  descrizione: string;
  attivitaPrincipali: string;
  requisiti: string;
  competenze: string;
  retribuzione: string;
  benefit: string;
  stato: StatoOffertaLavoro;
  updatedAt: string;
  candidatureCount: number;
};

type CandidaturaHome = {
  id: string;
  offertaId: string;
  stato: StatoCandidatura;
  source: string | null;
  receivedAt: string;
  cognome: string;
  nome: string;
};

type ColloquioHome = {
  id: string;
  candidaturaId: string;
  round: number;
  stato: StatoColloquio;
  scheduledAt: string;
  esito: EsitoColloquio | null;
  valutazioneStelle: number | null;
  intervistatoreNome: string;
};

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";
const labelCls = "text-[10px] font-semibold uppercase text-[var(--muted)]";

const STATO_COLORS: Record<StatoOffertaLavoro, string> = {
  BOZZA: "bg-slate-100 text-slate-700",
  PUBBLICATA: "bg-emerald-100 text-emerald-800",
  CHIUSA: "bg-stone-200 text-stone-700",
};

const STATO_CAND_COLORS: Record<StatoCandidatura, string> = {
  RICEVUTA: "bg-slate-100 text-slate-700",
  IN_VALUTAZIONE: "bg-amber-100 text-amber-900",
  COLLOQUIO: "bg-sky-100 text-sky-800",
  PROVA: "bg-teal-100 text-teal-900",
  ASSUNTA: "bg-emerald-100 text-emerald-800",
  ARCHIVIATA: "bg-stone-200 text-stone-800",
};

const STATO_COLL_COLORS: Record<StatoColloquio, string> = {
  PROGRAMMATO: "bg-amber-100 text-amber-900",
  SVOLTO: "bg-sky-100 text-sky-900",
  ESITATO: "bg-emerald-100 text-emerald-800",
  ANNULLATO: "bg-stone-200 text-stone-700",
};

/** Percorso in home: Candidature (tutte) + Nuove (non ancora aperte) + stati. */
const PERCORSO_HOME = [
  { id: "CANDIDATURE", label: "Candidature", icon: Users },
  { id: "NUOVE", label: "Nuove", icon: Inbox },
  { id: "COLLOQUIO_PROGRAMMATO", label: "Colloquio programmato", icon: CalendarClock },
  { id: "COLLOQUIO_SVOLTO", label: "Colloquio svolto", icon: CheckCircle2 },
  { id: "PROVA", label: STATO_CANDIDATURA_LABELS.PROVA, icon: Timer },
  { id: "ASSUNTA", label: STATO_CANDIDATURA_LABELS.ASSUNTA, icon: UserCheck },
] as const;

type PercorsoHomeId = (typeof PERCORSO_HOME)[number]["id"];

/** Bucket colloquio: programmato ha priorità se convivono round diversi. */
function bucketColloquioCandidatura(
  candidaturaId: string,
  colloqui: ColloquioHome[]
): "PROGRAMMATO" | "SVOLTO" | null {
  const cols = colloqui.filter(
    (x) => x.candidaturaId === candidaturaId && x.stato !== "ANNULLATO"
  );
  if (cols.some((x) => x.stato === "PROGRAMMATO")) return "PROGRAMMATO";
  if (cols.some((x) => x.stato === "SVOLTO" || x.stato === "ESITATO")) return "SVOLTO";
  return null;
}

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT");
}

function StelleDisplay({ value }: { value: number | null }) {
  if (!value || value < 1) return null;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-amber-500"
      aria-label={`${value} su 5`}
      title={`${value}/5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < value ? "opacity-100" : "opacity-25"}>
          ★
        </span>
      ))}
    </span>
  );
}

function PercorsoHomeMenu({
  active,
  onSelect,
  counts,
}: {
  active: PercorsoHomeId;
  onSelect: (id: PercorsoHomeId) => void;
  counts: Record<PercorsoHomeId, number>;
}) {
  return (
    <SectionTabNav label="Percorso candidature">
      {PERCORSO_HOME.map((step) => {
        const current = step.id === active;
        const Icon = step.icon;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelect(step.id)}
            aria-current={current ? "page" : undefined}
            className={sectionTabClass(current)}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" />
            {step.label}
            <span className="tabular-nums opacity-70">{counts[step.id]}</span>
          </button>
        );
      })}
    </SectionTabNav>
  );
}

export function OfferteLavoroClient({
  offerte,
  canManage,
  candidature = [],
  colloqui = [],
  userId,
}: {
  offerte: OffertaRow[];
  canManage: boolean;
  candidature?: CandidaturaHome[];
  colloqui?: ColloquioHome[];
  userId: string;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<OffertaRow | null>(null);
  const [chiudi, setChiudi] = useState<OffertaRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [percorso, setPercorso] = useState<PercorsoHomeId>("CANDIDATURE");
  const [aperte, setAperte] = useState<Record<string, boolean>>({});
  const [viste, setViste] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    function syncViste() {
      setViste(listCandidatureViste(userId));
    }
    syncViste();
    window.addEventListener("focus", syncViste);
    return () => window.removeEventListener("focus", syncViste);
  }, [userId]);

  // Aggiornamento quasi istantaneo quando arrivano candidature dal Receiver
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 3000);
    return () => window.clearInterval(id);
  }, [router]);

  function marcaVista(candidaturaId: string) {
    markCandidaturaVista(userId, candidaturaId);
    setViste((prev) => {
      if (prev.has(candidaturaId)) return prev;
      const next = new Set(prev);
      next.add(candidaturaId);
      return next;
    });
  }

  function isNuova(c: CandidaturaHome) {
    return (
      (c.stato === "RICEVUTA" || c.stato === "IN_VALUTAZIONE") && !viste.has(c.id)
    );
  }

  function inPercorsoColloquio(
    c: CandidaturaHome,
    bucket: "PROGRAMMATO" | "SVOLTO"
  ) {
    if (c.stato !== "COLLOQUIO") return false;
    const b = bucketColloquioCandidatura(c.id, colloqui);
    if (bucket === "PROGRAMMATO") return b === "PROGRAMMATO" || b === null;
    return b === "SVOLTO";
  }

  const percorsoCounts: Record<PercorsoHomeId, number> = {
    CANDIDATURE: candidature.length,
    NUOVE: candidature.filter((c) => isNuova(c)).length,
    COLLOQUIO_PROGRAMMATO: candidature.filter((c) =>
      inPercorsoColloquio(c, "PROGRAMMATO")
    ).length,
    COLLOQUIO_SVOLTO: candidature.filter((c) =>
      inPercorsoColloquio(c, "SVOLTO")
    ).length,
    PROVA: candidature.filter((c) => c.stato === "PROVA").length,
    ASSUNTA: candidature.filter((c) => c.stato === "ASSUNTA").length,
  };

  function candidatureFiltrate(list: CandidaturaHome[]) {
    if (percorso === "CANDIDATURE") return list;
    if (percorso === "NUOVE") {
      return list.filter((c) => isNuova(c));
    }
    if (percorso === "COLLOQUIO_PROGRAMMATO") {
      return list.filter((c) => inPercorsoColloquio(c, "PROGRAMMATO"));
    }
    if (percorso === "COLLOQUIO_SVOLTO") {
      return list.filter((c) => inPercorsoColloquio(c, "SVOLTO"));
    }
    return list.filter((c) => c.stato === percorso);
  }

  function run(fn: () => Promise<void>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        onOk?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Operazione non riuscita");
      }
    });
  }

  return (
    <div className="space-y-4">
      <PercorsoHomeMenu
        active={percorso}
        onSelect={(id) => {
          setPercorso(id);
          setAperte({});
        }}
        counts={percorsoCounts}
      />
      <PageHeader
        title="Recruiting"
        subtitle="Offerte di lavoro, candidature e colloqui ricevuti."
      />

      {canManage ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setCreateOpen(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Nuova offerta
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {offerte.length === 0 ? (
        <p className="rounded-xl border border-[var(--line)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
          Nessuna offerta di lavoro.
        </p>
      ) : percorso !== "CANDIDATURE" && percorsoCounts[percorso] === 0 ? (
        <p className="rounded-xl border border-[var(--line)] bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
          Nessuna candidatura in «
          {PERCORSO_HOME.find((s) => s.id === percorso)?.label}».
        </p>
      ) : (
        <div className="space-y-3">
          {offerte.map((o) => {
            const tutte = candidature.filter((c) => c.offertaId === o.id);
            const cands = candidatureFiltrate(tutte);
            if (percorso !== "CANDIDATURE" && cands.length === 0) return null;
            const ordered = [...cands].sort((a, b) => {
              const db = new Date(b.receivedAt).getTime();
              const da = new Date(a.receivedAt).getTime();
              if (db !== da) return db - da;
              return b.id.localeCompare(a.id);
            });
            const open =
              percorso !== "CANDIDATURE"
                ? aperte[o.id] !== false
                : Boolean(aperte[o.id]);
            const etichettaElenco =
              percorso === "CANDIDATURE"
                ? "Candidature"
                : PERCORSO_HOME.find((s) => s.id === percorso)?.label || "Candidature";
            const hrefOfferta = `/recruiting/offerte/${o.id}`;
            function toggleElenco() {
              setAperte((prev) => {
                const isOpen =
                  percorso !== "CANDIDATURE"
                    ? prev[o.id] !== false
                    : Boolean(prev[o.id]);
                return { ...prev, [o.id]: !isOpen };
              });
            }
            return (
              <article
                key={o.id}
                className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm"
              >
                <div
                  className={
                    canManage
                      ? "grid cursor-pointer grid-cols-[minmax(12rem,1.4fr)_6.5rem_7.5rem_6.5rem_minmax(14rem,1.6fr)_6.5rem_10.5rem_2rem] items-center gap-x-4 gap-y-2 border-l-4 border-[var(--navy)] bg-[var(--navy)]/5 px-4 py-3 hover:bg-[var(--navy)]/10 max-xl:grid-cols-[minmax(10rem,1fr)_6rem_7rem_6rem_minmax(12rem,1.4fr)_6rem_10.5rem_2rem] max-lg:flex max-lg:flex-wrap"
                      : "grid cursor-pointer grid-cols-[minmax(12rem,1.4fr)_6.5rem_7.5rem_6.5rem_minmax(14rem,1.6fr)_6.5rem_2rem] items-center gap-x-4 gap-y-2 border-l-4 border-[var(--navy)] bg-[var(--navy)]/5 px-4 py-3 hover:bg-[var(--navy)]/10 max-xl:grid-cols-[minmax(10rem,1fr)_6rem_7rem_6rem_minmax(12rem,1.4fr)_6rem_2rem] max-lg:flex max-lg:flex-wrap"
                  }
                  onClick={() => {
                    router.push(`/recruiting/offerte/${o.id}`);
                  }}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--navy)]">
                      <Briefcase className="h-3.5 w-3.5" />
                      Inserzione
                    </p>
                    <Link
                      href={hrefOfferta}
                      className="text-base font-semibold text-[var(--navy)] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {o.titolo}
                    </Link>
                  </div>
                  <div className="min-w-0 text-sm">
                    <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                      Sede
                    </p>
                    <p className="truncate">{o.luogo || "—"}</p>
                  </div>
                  <div className="min-w-0 text-sm">
                    <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                      Modalità
                    </p>
                    <p className="truncate">
                      {MODALITA_LAVORO_LABELS[o.modalitaLavoro]}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                      Stato
                    </p>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATO_COLORS[o.stato]}`}
                    >
                      {STATO_OFFERTA_LAVORO_LABELS[o.stato]}
                    </span>
                  </div>
                  <div className="min-w-0 text-sm">
                    <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                      Candidature
                    </p>
                    {(() => {
                      const byStato = (s: StatoCandidatura) =>
                        tutte.filter((c) => c.stato === s).length;
                      const nuove = tutte.filter((c) => isNuova(c)).length;
                      const items: Array<{
                        label: string;
                        n: number;
                        emphasis?: boolean;
                        alert?: boolean;
                      }> = [
                        { label: "Tot", n: tutte.length, emphasis: true },
                        {
                          label: "Nuove",
                          n: nuove,
                          alert: nuove > 0,
                        },
                        { label: "Colloquio", n: byStato("COLLOQUIO") },
                        { label: "In prova", n: byStato("PROVA") },
                        { label: "Assunte", n: byStato("ASSUNTA") },
                        { label: "Archiv.", n: byStato("ARCHIVIATA") },
                      ];
                      return (
                        <div className="mt-0.5 flex flex-nowrap gap-x-2.5 overflow-x-auto">
                          {items.map((it) => (
                            <span
                              key={it.label}
                              className={
                                it.alert
                                  ? "shrink-0 tabular-nums font-semibold text-emerald-700"
                                  : it.emphasis
                                    ? "shrink-0 tabular-nums font-semibold text-[var(--navy)]"
                                    : it.n > 0
                                      ? "shrink-0 tabular-nums text-slate-700"
                                      : "shrink-0 tabular-nums text-slate-400"
                              }
                              title={
                                it.label === "Nuove"
                                  ? `Nuove non ancora visualizzate: ${it.n}`
                                  : `${it.label}: ${it.n}`
                              }
                            >
                              <span
                                className={
                                  it.alert
                                    ? "text-[10px] font-semibold uppercase text-emerald-600"
                                    : "text-[10px] font-medium uppercase text-[var(--muted)]"
                                }
                              >
                                {it.label}
                              </span>{" "}
                              {it.n}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="min-w-0 text-sm text-[var(--muted)]">
                    <p className="text-[10px] font-semibold uppercase">Aggiornata</p>
                    <p className="tabular-nums">{formatData(o.updatedAt)}</p>
                  </div>
                  {canManage ? (
                    <div
                      className="flex w-full shrink-0 items-center justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          startTransition(async () => {
                            try {
                              const res = await syncIndeedApplicationsAction(o.id);
                              if (res.received === 0) {
                                setError(
                                  "Nessuna candidatura Indeed sul ricevitore per questa offerta."
                                );
                              } else if (res.errors > 0) {
                                setError(
                                  `Sync: ${res.created} nuove, ${res.updated} aggiornate, ${res.errors} errori.`
                                );
                              } else {
                                setError(null);
                              }
                              router.refresh();
                            } catch (e) {
                              setError(
                                e instanceof Error
                                  ? e.message
                                  : "Sincronizzazione non riuscita"
                              );
                            }
                          });
                        }}
                        className="text-xs font-semibold text-[var(--navy)] underline"
                      >
                        Sincronizza
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          setEdit(o);
                        }}
                        className="text-xs font-semibold text-[var(--accent)] underline"
                      >
                        Modifica
                      </button>
                      {o.stato !== "CHIUSA" ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            setError(null);
                            setChiudi(o);
                          }}
                          className="text-xs font-semibold text-rose-700 underline"
                        >
                          Chiudi offerta
                        </button>
                      ) : (
                        <span
                          className="invisible pointer-events-none text-xs font-semibold"
                          aria-hidden
                        >
                          Chiudi offerta
                        </span>
                      )}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-label={open ? "Chiudi elenco candidature" : "Apri elenco candidature"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleElenco();
                    }}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-[var(--navy)] hover:bg-slate-50"
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {open ? (
                <div className="border-t border-[var(--line)] bg-slate-50 px-4 py-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
                    <UserRound className="h-3.5 w-3.5" />
                    {etichettaElenco}
                  </p>
                  {ordered.length === 0 ? (
                    <p className="ml-6 text-sm text-[var(--muted)]">
                      Nessuna candidatura
                      {percorso === "CANDIDATURE" ? "." : ` in «${etichettaElenco}».`}
                    </p>
                  ) : (
                    <ul className="ml-2 space-y-1.5 border-l-2 border-slate-300 pl-4">
                      {ordered.map((c) => {
                        const candidato = anagraficaCandidato(c);
                        const coll = colloqui
                          .filter((x) => x.candidaturaId === c.id)
                          .sort(
                            (a, b) =>
                              new Date(b.scheduledAt).getTime() -
                              new Date(a.scheduledAt).getTime()
                          );
                        return (
                          <li
                            key={c.id}
                            className="rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                              <Link
                                href={`/recruiting/offerte/${o.id}/${c.id}`}
                                className="font-medium text-slate-700 hover:underline"
                                onClick={() => marcaVista(c.id)}
                              >
                                {candidato.label}
                              </Link>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATO_CAND_COLORS[c.stato]}`}
                              >
                                {STATO_CANDIDATURA_LABELS[c.stato]}
                              </span>
                              <span className="text-[var(--muted)]">
                                {c.source || "—"}
                              </span>
                              <span className="tabular-nums text-[var(--muted)]">
                                {new Date(c.receivedAt).toLocaleString("it-IT")}
                              </span>
                            </div>
                            {coll.length > 0 ? (
                              <ul className="mt-1.5 ml-3 space-y-1 border-l border-slate-200 pl-3">
                                {coll.map((col) => (
                                  <li
                                    key={col.id}
                                    className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]"
                                  >
                                    <Link
                                      href={`/recruiting/offerte/${o.id}/${c.id}#colloquio-${col.id}`}
                                      className="font-medium hover:underline"
                                    >
                                      {col.round}° colloquio
                                    </Link>
                                    <span
                                      className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${STATO_COLL_COLORS[col.stato]}`}
                                    >
                                      {STATO_COLLOQUIO_LABELS[col.stato]}
                                    </span>
                                    {col.esito ? (
                                      <span className="font-medium text-slate-700">
                                        {ESITO_COLLOQUIO_LABELS[col.esito]}
                                      </span>
                                    ) : null}
                                    <StelleDisplay value={col.valutazioneStelle} />
                                    {col.intervistatoreNome ? (
                                      <span title="Intervistatore">
                                        {col.intervistatoreNome}
                                      </span>
                                    ) : null}
                                    <span className="tabular-nums">
                                      {new Date(col.scheduledAt).toLocaleString("it-IT")}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        title="Nuova offerta"
        wide
        onClose={() => !pending && setCreateOpen(false)}
      >
        <form
          className="grid gap-3 p-4 text-sm"
          action={(fd) =>
            run(
              () => creaOffertaLavoroAction(fd),
              () => setCreateOpen(false)
            )
          }
        >
          <OffertaFields />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => setCreateOpen(false)}
              className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Salvataggio…" : "Crea"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(edit)}
        title="Modifica offerta"
        wide
        onClose={() => !pending && setEdit(null)}
      >
        {edit ? (
          <form
            className="grid gap-3 p-4 text-sm"
            action={(fd) =>
              run(
                () => aggiornaOffertaLavoroAction(fd),
                () => setEdit(null)
              )
            }
          >
            <input type="hidden" name="id" value={edit.id} />
            <OffertaFields
              offerta={edit}
              allowBozza={edit.stato !== "PUBBLICATA" && edit.stato !== "CHIUSA"}
              lockedChiusa={edit.stato === "CHIUSA"}
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => setEdit(null)}
                className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={pending}
                className="h-9 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Salvataggio…" : "Salva"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(chiudi)}
        title="Chiudi offerta"
        onClose={() => !pending && setChiudi(null)}
      >
        {chiudi ? (
          <div className="grid gap-3 p-4 text-sm">
            <p>
              Dopo la chiusura non sarà possibile creare nuove candidature su questa
              offerta. Confermi?
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => setChiudi(null)}
                className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("id", chiudi.id);
                  run(() => chiudiOffertaLavoroAction(fd), () => setChiudi(null));
                }}
                className="h-9 rounded-lg bg-rose-800 px-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Salvataggio…" : "Chiudi offerta"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function OffertaFields({
  offerta,
  allowBozza = true,
  lockedChiusa = false,
}: {
  offerta?: OffertaRow | null;
  allowBozza?: boolean;
  lockedChiusa?: boolean;
}) {
  const defaultStato = offerta?.stato === "PUBBLICATA" ? "PUBBLICATA" : "BOZZA";
  return (
    <>
      {lockedChiusa ? <input type="hidden" name="stato" value="CHIUSA" /> : null}
      <p className="text-xs text-[var(--muted)]">
        Campi allineati alla scheda offerta Indeed (titolo, sede, modalità, contratto,
        descrizione, retribuzione, benefit). Le offerte Pubblicate sono sincronizzate su CreditCore (catalogo candidati).
      </p>

      <fieldset className="grid gap-3">
        <legend className="text-[11px] font-bold uppercase tracking-wide text-[var(--navy)]">
          Posizione
        </legend>
        <label>
          <span className={labelCls}>Titolo *</span>
          <input
            name="titolo"
            required
            maxLength={200}
            defaultValue={offerta?.titolo || ""}
            className={inputCls}
            placeholder="es. Operatore call center"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={labelCls}>Modalità di lavoro *</span>
            <select
              name="modalitaLavoro"
              required
              defaultValue={offerta?.modalitaLavoro || "PRESENZA"}
              className={inputCls}
            >
              {MODALITA_LAVORO.map((m) => (
                <option key={m} value={m}>
                  {MODALITA_LAVORO_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Sede *</span>
            <input
              name="luogo"
              required
              maxLength={200}
              defaultValue={offerta?.luogo || ""}
              className={inputCls}
              placeholder="es. Napoli"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-[11px] font-bold uppercase tracking-wide text-[var(--navy)]">
          Contratto
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className={labelCls}>Tipo contratto</span>
            <select
              name="tipoContratto"
              defaultValue={offerta?.tipoContratto || ""}
              className={inputCls}
            >
              <option value="">—</option>
              {TIPI_CONTRATTO.map((t) => (
                <option key={t} value={t}>
                  {TIPO_CONTRATTO_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Orario</span>
            <select name="orario" defaultValue={offerta?.orario || ""} className={inputCls}>
              <option value="">—</option>
              {ORARI_LAVORO.map((o) => (
                <option key={o} value={o}>
                  {ORARIO_LAVORO_LABELS[o]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Numero posizioni</span>
            <input
              name="numeroPosizioni"
              type="number"
              min={1}
              max={999}
              defaultValue={offerta?.numeroPosizioni || 1}
              className={inputCls}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-[11px] font-bold uppercase tracking-wide text-[var(--navy)]">
          Descrizione
        </legend>
        <label>
          <span className={labelCls}>Descrizione *</span>
          <textarea
            name="descrizione"
            required
            maxLength={20000}
            rows={5}
            defaultValue={offerta?.descrizione || ""}
            className={`${inputCls} h-auto py-2`}
            placeholder="Descrizione del ruolo (minimo 30 caratteri per pubblicare)"
          />
        </label>
        <label>
          <span className={labelCls}>Attività principali</span>
          <textarea
            name="attivitaPrincipali"
            maxLength={20000}
            rows={3}
            defaultValue={offerta?.attivitaPrincipali || ""}
            className={`${inputCls} h-auto py-2`}
          />
        </label>
        <label>
          <span className={labelCls}>Requisiti</span>
          <textarea
            name="requisiti"
            maxLength={20000}
            rows={3}
            defaultValue={offerta?.requisiti || ""}
            className={`${inputCls} h-auto py-2`}
          />
        </label>
        <label>
          <span className={labelCls}>Competenze / esperienza</span>
          <textarea
            name="competenze"
            maxLength={20000}
            rows={3}
            defaultValue={offerta?.competenze || ""}
            className={`${inputCls} h-auto py-2`}
          />
        </label>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-[11px] font-bold uppercase tracking-wide text-[var(--navy)]">
          Condizioni
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={labelCls}>Retribuzione</span>
            <input
              name="retribuzione"
              maxLength={500}
              defaultValue={offerta?.retribuzione || ""}
              className={inputCls}
              placeholder="es. 1.400–1.600 € mese"
            />
          </label>
          <label>
            <span className={labelCls}>Benefit</span>
            <textarea
              name="benefit"
              maxLength={20000}
              rows={2}
              defaultValue={offerta?.benefit || ""}
              className={`${inputCls} h-auto py-2`}
              placeholder="Un benefit per riga"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-[11px] font-bold uppercase tracking-wide text-[var(--navy)]">
          Pubblicazione
        </legend>
        {lockedChiusa ? (
          <p className="rounded-lg border border-[var(--line)] bg-slate-50 px-3 py-2 text-sm text-[var(--muted)]">
            Offerta chiusa: puoi aggiornare i testi, lo stato resta Chiusa.
          </p>
        ) : (
          <label>
            <span className={labelCls}>Stato</span>
            <select name="stato" defaultValue={defaultStato} className={inputCls}>
              {allowBozza ? <option value="BOZZA">Bozza</option> : null}
              <option value="PUBBLICATA">Pubblicata</option>
            </select>
          </label>
        )}
        <p className="rounded-lg border border-[var(--line)] bg-slate-50 px-3 py-2 text-sm text-[var(--navy)]">
          {DICITURA_PARI_OPPORTUNITA}
        </p>
      </fieldset>
    </>
  );
}
