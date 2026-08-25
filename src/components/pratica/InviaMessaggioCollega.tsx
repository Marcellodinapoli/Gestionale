"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { sendMessaggioInternoAction } from "@/actions/core";

type Hit = { id: string; name: string; sigla: string; ruolo: string; role: string };
type Filtro = "ALL" | "OPERATOR" | "BACK_OFFICE";

function etichettaGruppo(ruolo: Filtro) {
  if (ruolo === "OPERATOR") return "Tutti gli operatori";
  if (ruolo === "BACK_OFFICE") return "Tutto il back office";
  return "Tutti in azienda";
}

export function InviaMessaggioCollega({
  praticaId,
  inModal,
  standalone,
}: {
  praticaId?: string;
  inModal?: boolean;
  standalone?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("ALL");
  const [elencoAperto, setElencoAperto] = useState(Boolean(standalone || inModal));
  const [hits, setHits] = useState<Hit[]>([]);
  const [dest, setDest] = useState<Hit | null>(null);
  const [testo, setTesto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [collegata, setCollegata] = useState(Boolean(praticaId));
  const boxRef = useRef<HTMLDivElement>(null);
  const elencoInFlow = Boolean(standalone || inModal);

  const destGruppo = dest?.id === "__ALL__";
  const ruoloInvio: Filtro | "" = destGruppo
    ? ((dest?.role as Filtro) || "ALL")
    : dest
      ? ""
      : filtro === "OPERATOR" || filtro === "BACK_OFFICE"
        ? filtro
        : "";
  const showTuttiVoce =
    elencoAperto &&
    (!q.trim() || "tutti".startsWith(q.trim().toLowerCase()));

  useEffect(() => {
    if (dest || !elencoAperto) {
      if (dest) setHits([]);
      return;
    }
    const t = window.setTimeout(async () => {
      const params = new URLSearchParams();
      params.set("elenco", "1");
      if (q.trim()) params.set("q", q.trim());
      if (filtro !== "ALL") params.set("ruolo", filtro);
      const res = await fetch(`/api/utenti-cerca?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as { users: Hit[] };
      setHits(data.users);
    }, 120);
    return () => window.clearTimeout(t);
  }, [q, dest, filtro, elencoAperto]);

  useEffect(() => {
    if (elencoInFlow) return;
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) {
        setElencoAperto(false);
        setHits([]);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [elencoInFlow]);

  function apriElenco(ruolo: Filtro) {
    setDest(null);
    setFiltro(ruolo);
    setQ("");
    setOk(null);
    setElencoAperto(true);
  }

  function scegliTutti(ruolo: Filtro) {
    setDest({
      id: "__ALL__",
      name: etichettaGruppo(ruolo),
      sigla: "TUTTI",
      ruolo: "Gruppo",
      role: ruolo,
    });
    setFiltro(ruolo);
    setQ("");
    setHits([]);
    setElencoAperto(false);
    setOk(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (!dest && filtro !== "OPERATOR" && filtro !== "BACK_OFFICE") {
      setError("Seleziona un collega oppure Tutti dall'elenco aziendale");
      return;
    }
    setSending(true);
    try {
      const fd = new FormData();
      if (praticaId) fd.set("praticaId", praticaId);
      fd.set("collegata", collegata && praticaId ? "1" : "0");
      fd.set("testo", testo);
      if (dest && !destGruppo) {
        fd.set("toUserId", dest.id);
      } else {
        fd.set("toRole", ruoloInvio || "ALL");
      }
      await sendMessaggioInternoAction(fd);
      const chi = destGruppo
        ? dest?.name
        : dest
          ? dest.name
          : etichettaGruppo(filtro);
      setTesto("");
      setDest(null);
      setQ("");
      setOk(`Messaggio inviato a ${chi}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invio non riuscito");
    } finally {
      setSending(false);
    }
  }

  const elencoLista =
    !dest && elencoAperto ? (
      <ul
        className={
          elencoInFlow
            ? "mt-1 max-h-[min(50vh,22rem)] min-h-[14rem] overflow-auto rounded border border-[var(--line)] bg-white text-sm shadow-sm"
            : "absolute z-30 mt-0.5 max-h-56 w-full overflow-auto rounded border border-[var(--line)] bg-white text-sm shadow-lg"
        }
      >
        {showTuttiVoce ? (
          <li>
            <button
              type="button"
              onClick={() => scegliTutti(filtro)}
              className="flex w-full items-center justify-between border-b border-[var(--line)] bg-[#eef4f8] px-2 py-1.5 text-left font-semibold hover:bg-[#dceaf3]"
            >
              <span>
                <span className="font-mono text-xs font-bold">TUTTI</span>{" "}
                {etichettaGruppo(filtro)}
              </span>
              <span className="text-[10px] text-[var(--muted)]">Gruppo</span>
            </button>
          </li>
        ) : null}
        {hits.map((h) => (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => {
                setDest(h);
                setQ("");
                setHits([]);
                setElencoAperto(false);
              }}
              className="flex w-full items-center justify-between px-2 py-1.5 text-left hover:bg-[#eef4f8]"
            >
              <span>
                <span className="font-mono text-xs font-bold">{h.sigla}</span> {h.name}
              </span>
              <span className="text-[10px] text-[var(--muted)]">{h.ruolo}</span>
            </button>
          </li>
        ))}
        {!hits.length && !showTuttiVoce ? (
          <li className="px-2 py-1.5 text-[var(--muted)]">Nessun risultato</li>
        ) : null}
      </ul>
    ) : null;

  return (
    <form
      onSubmit={onSubmit}
      className={
        inModal
          ? "px-3 py-3"
          : standalone
            ? ""
            : "border-t border-[var(--line)] bg-[#f7f4ea] px-3 py-2"
      }
    >
      {!standalone ? (
        <p className="mb-1 text-[11px] font-bold uppercase text-[#1a365d]">
          Messaggio al collega
        </p>
      ) : null}
      {praticaId ? (
        <div className="mb-2 flex flex-wrap gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="collegata"
              checked={collegata}
              onChange={() => setCollegata(true)}
            />
            Collegata alla pratica
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="collegata"
              checked={!collegata}
              onChange={() => setCollegata(false)}
            />
            Messaggio indipendente
          </label>
        </div>
      ) : null}
      <div ref={boxRef}>
        <div className="mb-2 flex flex-wrap gap-1 text-xs">
          <button
            type="button"
            onClick={() => apriElenco("OPERATOR")}
            className={`rounded border px-2 py-1 ${
              filtro === "OPERATOR" && elencoAperto
                ? "border-[#132033] bg-[#132033] text-white"
                : "border-[var(--line)] bg-white"
            }`}
          >
            Solo operatori
          </button>
          <button
            type="button"
            onClick={() => apriElenco("BACK_OFFICE")}
            className={`rounded border px-2 py-1 ${
              filtro === "BACK_OFFICE" && elencoAperto
                ? "border-[#132033] bg-[#132033] text-white"
                : "border-[var(--line)] bg-white"
            }`}
          >
            Solo back office
          </button>
          <button
            type="button"
            onClick={() => {
              if (elencoAperto && filtro === "ALL") {
                setElencoAperto(false);
                setHits([]);
              } else {
                apriElenco("ALL");
              }
            }}
            className={`rounded border px-2 py-1 ${
              filtro === "ALL" && elencoAperto
                ? "border-[#132033] bg-[#132033] text-white"
                : "border-[var(--line)] bg-white"
            }`}
          >
            {elencoAperto && filtro === "ALL" ? "Chiudi elenco" : "Elenco aziendale"}
          </button>
        </div>
        <div
          className={
            elencoInFlow
              ? "grid gap-2"
              : "grid gap-2 md:grid-cols-[240px_1fr_auto]"
          }
        >
          <div className={elencoInFlow ? "" : "relative"}>
            <input
              value={dest ? `${dest.sigla} — ${dest.name}` : q}
              onChange={(e) => {
                setDest(null);
                setQ(e.target.value);
                setOk(null);
                setElencoAperto(true);
              }}
              onFocus={() => {
                if (!dest) setElencoAperto(true);
              }}
              placeholder="Cerca per nome…"
              className="h-9 w-full rounded border border-[var(--line)] bg-white px-2 text-sm"
            />
            {!elencoInFlow ? elencoLista : null}
          </div>
          {elencoInFlow ? elencoLista : null}
          <div
            className={
              elencoInFlow
                ? "grid gap-2 sm:grid-cols-[1fr_auto]"
                : "contents"
            }
          >
            <input
              value={testo}
              onChange={(e) => setTesto(e.target.value)}
              placeholder="Testo del messaggio"
              className="h-9 rounded border border-[var(--line)] bg-white px-2 text-sm"
            />
            <button
              type="submit"
              disabled={sending}
              className="h-9 rounded bg-[#132033] px-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {sending
                ? "…"
                : ruoloInvio === "ALL"
                  ? "Invia a tutti"
                  : ruoloInvio === "OPERATOR"
                    ? "Invia agli operatori"
                    : ruoloInvio === "BACK_OFFICE"
                      ? "Invia al back office"
                      : "Invia"}
            </button>
          </div>
        </div>
      </div>
      {destGruppo ? (
        <p className="mt-1 text-xs text-[var(--muted)]">
          Il messaggio va a {etichettaGruppo(ruoloInvio || "ALL").toLowerCase()}.
        </p>
      ) : null}
      {error ? <p className="mt-1 text-xs text-[var(--danger)]">{error}</p> : null}
      {ok ? <p className="mt-1 text-xs text-emerald-700">{ok}</p> : null}
    </form>
  );
}
