"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Check, X, Pencil } from "lucide-react";
import { Trash2 } from "lucide-react";
import {
  updateAcronimoAction,
  resetPasswordAmministrazioneAction,
  deleteOperatoreAction,
  updateRuoloAction,
} from "@/actions/operatoriAdmin";

type Utente = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  acronimo: string | null;
  lastLoginAt: string | null;
  lastLogoutAt: string | null;
  postazione: string | null;
  interno: string | null;
  supervisorName: string | null;
};

function fmtOra(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OperatoriGestione({ utenti }: { utenti: Utente[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-[var(--muted)]">
          <tr>
            <th className="py-2">Nome</th>
            <th>Email</th>
            <th>Ruolo</th>
            <th>Team</th>
            <th>Acronimo</th>
            <th>Postazione</th>
            <th>Interno</th>
            <th>Login</th>
            <th>Logout</th>
            <th>Password</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {utenti.map((u) => (
            <RigaOperatore key={u.id} utente={u} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RigaOperatore({ utente }: { utente: Utente }) {
  const router = useRouter();
  const [editAcr, setEditAcr] = useState(false);
  const [acronimo, setAcronimo] = useState(utente.acronimo || "");
  const [savingAcr, setSavingAcr] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  async function salvaAcronimo() {
    setSavingAcr(true);
    try {
      const fd = new FormData();
      fd.set("userId", utente.id);
      fd.set("acronimo", acronimo.trim().toUpperCase());
      await updateAcronimoAction(fd);
      setEditAcr(false);
      router.refresh();
    } catch {
      /* ignore */
    } finally {
      setSavingAcr(false);
    }
  }

  async function resetPassword() {
    if (pwd.length < 6) {
      setPwdMsg("Min 6 caratteri");
      return;
    }
    try {
      const fd = new FormData();
      fd.set("userId", utente.id);
      fd.set("newPassword", pwd);
      await resetPasswordAmministrazioneAction(fd);
      setPwdMsg("Resettata!");
      setPwd("");
      setTimeout(() => {
        setResetOpen(false);
        setPwdMsg(null);
      }, 1500);
    } catch (e) {
      setPwdMsg(e instanceof Error ? e.message : "Errore");
    }
  }

  return (
    <tr className="border-t border-[var(--line)]">
      <td className="py-2 font-medium">{utente.name}</td>
      <td className="text-xs text-[var(--muted)]">{utente.email}</td>
      <td>
        <select
          defaultValue={utente.role}
          onChange={async (e) => {
            const fd = new FormData();
            fd.set("userId", utente.id);
            fd.set("role", e.target.value);
            await updateRuoloAction(fd);
            router.refresh();
          }}
          className="h-7 rounded border border-[var(--line)] bg-transparent px-1 text-xs"
        >
          <option value="OPERATOR">Operatore</option>
          <option value="BACK_OFFICE">Back office</option>
          <option value="SUPERVISOR">Supervisor</option>
          <option value="AMMINISTRAZIONE">Amministrazione</option>
          <option value="ADMIN">Amministratore</option>
        </select>
      </td>
      <td>{utente.supervisorName || "—"}</td>
      <td>
        {editAcr ? (
          <span className="flex items-center gap-1">
            <input
              value={acronimo}
              onChange={(e) => setAcronimo(e.target.value)}
              maxLength={6}
              className="h-7 w-20 rounded border border-[var(--line)] px-1 text-xs uppercase"
              autoFocus
            />
            <button
              onClick={salvaAcronimo}
              disabled={savingAcr}
              className="text-emerald-600 hover:text-emerald-800"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setEditAcr(false);
                setAcronimo(utente.acronimo || "");
              }}
              className="text-[var(--muted)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-xs">
              {utente.acronimo || <span className="text-[var(--muted)]">—</span>}
            </span>
            <button
              onClick={() => setEditAcr(true)}
              className="text-[var(--muted)] hover:text-[var(--accent)]"
              title="Modifica acronimo"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </span>
        )}
      </td>
      <td className="text-xs">{utente.postazione || <span className="text-[var(--muted)]">—</span>}</td>
      <td className="font-mono text-xs font-semibold text-[var(--accent)]">
        {utente.interno || <span className="font-normal text-[var(--muted)]">—</span>}
      </td>
      <td className="text-xs text-[var(--muted)] whitespace-nowrap">
        {fmtOra(utente.lastLoginAt)}
      </td>
      <td className="text-xs text-[var(--muted)] whitespace-nowrap">
        {fmtOra(utente.lastLogoutAt)}
      </td>
      <td>
        {resetOpen ? (
          <span className="flex items-center gap-1">
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Nuova pwd"
              className="h-7 w-28 rounded border border-[var(--line)] px-1 text-xs"
            />
            <button
              onClick={resetPassword}
              className="rounded bg-[var(--navy)] px-2 py-0.5 text-[10px] text-white"
            >
              OK
            </button>
            <button
              onClick={() => {
                setResetOpen(false);
                setPwdMsg(null);
                setPwd("");
              }}
              className="text-[var(--muted)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {pwdMsg && (
              <span className="text-[10px] font-semibold text-emerald-600">
                {pwdMsg}
              </span>
            )}
          </span>
        ) : (
          <button
            onClick={() => setResetOpen(true)}
            className="flex items-center gap-1 rounded bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700 hover:bg-amber-200"
            title={`Reset password di ${utente.name}`}
          >
            <KeyRound className="h-3 w-3" /> Reset
          </button>
        )}
      </td>
      <td>
        <button
          onClick={async () => {
            if (!confirm(`Eliminare ${utente.name}?`)) return;
            const fd = new FormData();
            fd.set("userId", utente.id);
            await deleteOperatoreAction(fd);
            router.refresh();
          }}
          className="flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-200"
          title={`Elimina ${utente.name}`}
        >
          <Trash2 className="h-3 w-3" /> Elimina
        </button>
      </td>
    </tr>
  );
}
