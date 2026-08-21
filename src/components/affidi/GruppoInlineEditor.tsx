"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, X, KeyRound } from "lucide-react";
import {
  addOperatoreAlGruppoAction,
  removeOperatoreDalGruppoAction,
  updateGruppoNomeAction,
  resetPasswordAction,
} from "@/actions/gruppoOperatori";
import { AltriGruppiToggle } from "./AltriGruppiToggle";
import { GruppoMandantiSection } from "./GruppoMandantiSection";
import {
  etichettaGruppoMandanti,
  type GruppoMandanteAssegnazione,
} from "@/lib/gruppoMandanti";

type OperatoreAnagrafica = {
  id: string;
  name: string;
  supervisorId: string | null;
  supervisorName: string | null;
};

type GruppoInfo = {
  id: string;
  name: string;
  gruppoNome: string | null;
  operators: Array<{ id: string; name: string }>;
};

type MandanteOption = {
  id: string;
  codice: string;
  ragioneSociale: string;
  perimetri: Array<{ id: string; nome: string }>;
};

export function GruppoInlineEditor({
  supervisorId,
  membri,
  tuttiOperatori,
  gruppoNome,
  gruppoMandanti,
  mandanti,
  altriGruppi,
}: {
  supervisorId: string;
  membri: Array<{ id: string; name: string; role: string }>;
  tuttiOperatori: OperatoreAnagrafica[];
  gruppoNome?: string | null;
  gruppoMandanti: GruppoMandanteAssegnazione[];
  mandanti: MandanteOption[];
  altriGruppi: GruppoInfo[];
}) {
  const [aperto, setAperto] = useState(false);

  const nelGruppo = new Set(
    membri.filter((m) => m.role === "OPERATOR").map((m) => m.id)
  );
  const operatoriGruppo = tuttiOperatori.filter((o) => nelGruppo.has(o.id));
  const etichetteMandanti = etichettaGruppoMandanti(gruppoMandanti, mandanti);

  return (
    <div className="mb-3">
      {/* Riga riepilogo + pulsante */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-[#eef4f8] px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          {gruppoNome ? (
            <span className="text-xs font-semibold text-[var(--navy)]">{gruppoNome}</span>
          ) : null}
          <span className="text-[10px] text-[var(--muted)]">
            {operatoriGruppo.length} operatori
          </span>
          {etichetteMandanti.length ? (
            <div className="flex flex-wrap gap-1">
              {etichetteMandanti.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-[#c5d4e3] bg-white px-2 py-px text-[10px] text-[var(--navy)]"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1">
            {operatoriGruppo.map((o) => (
              <Link
                key={o.id}
                href={`/affidi?operatore=${o.id}`}
                className="rounded-full border border-[var(--line)] bg-white px-2 py-px text-[10px] hover:bg-[#dceaf3] hover:border-[var(--accent)]"
                title={`Filtra su ${o.name}`}
              >
                {o.name}
              </Link>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAperto((v) => !v)}
          className="flex shrink-0 items-center gap-1 rounded border border-[var(--navy)] bg-[var(--navy)] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#1a365d]"
        >
          {aperto ? (
            <>
              <X className="h-3 w-3" /> Chiudi
            </>
          ) : (
            <>
              <Pencil className="h-3 w-3" /> Modifica gruppo
            </>
          )}
        </button>
      </div>

      {/* Pannello modifica */}
      {aperto ? (
        <div className="mt-2 space-y-3 rounded-lg border border-dashed border-[var(--accent)] bg-white p-3">
          <form action={updateGruppoNomeAction} className="flex flex-wrap items-end gap-2">
            <label className="min-w-[200px] flex-1 text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Nome del gruppo
              </span>
              <input
                name="gruppoNome"
                type="text"
                defaultValue={gruppoNome || ""}
                placeholder="es. Gruppo Milano, Team Alpha…"
                className="h-8 w-full rounded border border-[var(--line)] px-2 text-xs"
              />
            </label>
            <button
              type="submit"
              className="h-8 rounded bg-[var(--navy)] px-3 text-xs text-white"
            >
              Salva nome
            </button>
          </form>

          <form action={addOperatoreAlGruppoAction} className="flex flex-wrap items-end gap-2">
            <label className="min-w-[200px] flex-1 text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Aggiungi operatore
              </span>
              <select
                name="operatoreId"
                required
                className="h-8 w-full rounded border border-[var(--line)] px-2 text-xs"
              >
                <option value="">Tutti gli operatori…</option>
                {tuttiOperatori.map((o) => {
                  const inQuesto = o.supervisorId === supervisorId;
                  const altro =
                    o.supervisorName && !inQuesto ? ` · ${o.supervisorName}` : "";
                  return (
                    <option key={o.id} value={o.id}>
                      {o.name}
                      {inQuesto ? " (nel gruppo)" : altro}
                    </option>
                  );
                })}
              </select>
            </label>
            <button
              type="submit"
              className="h-8 rounded bg-[var(--navy)] px-3 text-xs text-white"
            >
              Aggiungi
            </button>
          </form>

          {operatoriGruppo.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {operatoriGruppo.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[#eef4f8] px-2.5 py-0.5 text-xs"
                >
                  {o.name}
                  <ResetPasswordBtn userId={o.id} userName={o.name} />
                  <form action={removeOperatoreDalGruppoAction}>
                    <input type="hidden" name="operatoreId" value={o.id} />
                    <button
                      type="submit"
                      className="text-[10px] text-[var(--muted)] underline hover:text-[var(--danger)]"
                      title={`Rimuovi ${o.name}`}
                    >
                      ×
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[10px] text-[var(--muted)]">
              Nessun operatore nel gruppo.
            </p>
          )}

          <GruppoMandantiSection initial={gruppoMandanti} mandanti={mandanti} />

          {altriGruppi.length > 0 ? (
            <AltriGruppiToggle gruppi={altriGruppi} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ResetPasswordBtn({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function handleReset() {
    if (pwd.length < 6) { setMsg("Min 6 caratteri"); return; }
    try {
      const fd = new FormData();
      fd.set("userId", userId);
      fd.set("newPassword", pwd);
      await resetPasswordAction(fd);
      setMsg("Password resettata");
      setPwd("");
      setTimeout(() => { setOpen(false); setMsg(null); }, 1500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Errore");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 hover:bg-amber-200"
        title={`Reset password di ${userName}`}
      >
        <KeyRound className="h-2.5 w-2.5" /> pwd
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <input
        type="password"
        value={pwd}
        onChange={(e) => setPwd(e.target.value)}
        placeholder="Nuova pwd"
        className="h-5 w-24 rounded border border-[var(--line)] px-1 text-[10px]"
      />
      <button
        type="button"
        onClick={handleReset}
        className="rounded bg-[var(--navy)] px-1.5 py-0.5 text-[9px] text-white"
      >
        OK
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setMsg(null); setPwd(""); }}
        className="text-[10px] text-[var(--muted)]"
      >
        ×
      </button>
      {msg && <span className="text-[9px] text-emerald-600">{msg}</span>}
    </span>
  );
}
