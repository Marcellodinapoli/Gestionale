"use client";

import {
  createContext,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Lock, Unlock } from "lucide-react";
import { logoutAction } from "@/actions/core";
import { sbloccaPrivacyAction, type SbloccoPrivacyState } from "@/actions/privacyLock";

const STORAGE_KEY = "gestionale_privacy_lock";

const initialState: SbloccoPrivacyState = { ok: false };

type PrivacyLockContextValue = {
  locked: boolean;
  lock: () => void;
};

const PrivacyLockContext = createContext<PrivacyLockContextValue>({
  locked: false,
  lock: () => {},
});

export function usePrivacyLock() {
  return useContext(PrivacyLockContext);
}

function SbloccoForm({ userName, onUnlocked }: { userName: string; onUnlocked: () => void }) {
  const [state, formAction, pending] = useActionState(sbloccaPrivacyAction, initialState);

  useEffect(() => {
    if (state.ok) onUnlocked();
  }, [state.ok, onUnlocked]);

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white p-6 shadow-2xl">
      <div className="mb-4 flex items-center gap-2 text-[var(--navy)]">
        <Lock className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Credixa bloccato</h2>
      </div>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Sessione di <span className="font-semibold text-[var(--navy)]">{userName}</span>.
        Reinserisci la password per continuare.
      </p>
      <form action={formAction} className="space-y-3">
        <label className="block text-sm">
          <span className="font-semibold text-[var(--navy)]">Password</span>
          <input
            name="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            placeholder="Reinserisci la password"
            className="mt-1 h-10 w-full rounded-lg border border-[var(--line)] px-3"
            required
          />
        </label>
        {state.error ? <p className="text-sm text-[var(--danger)]">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--navy)] text-sm font-semibold text-white disabled:opacity-50"
        >
          <Unlock className="h-4 w-4" />
          {pending ? "Verifico..." : "Sblocca con password"}
        </button>
      </form>
      <form action={logoutAction} className="mt-3">
        <button
          type="submit"
          className="w-full text-center text-sm text-[var(--muted)] underline-offset-2 hover:underline"
        >
          Esci dall&apos;account
        </button>
      </form>
    </div>
  );
}

export function PrivacyLockProvider({
  userName,
  children,
}: {
  userName: string;
  children: ReactNode;
}) {
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setLocked(sessionStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const lock = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setLocked(true);
  }, []);

  const unlock = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setLocked(false);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      if (e.key.toLowerCase() !== "l") return;
      if (locked) return;
      e.preventDefault();
      lock();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lock, locked]);

  return (
    <PrivacyLockContext.Provider value={{ locked, lock }}>
      {children}
      {ready && locked ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0f1a2a]/95 backdrop-blur-md print:hidden">
          <SbloccoForm userName={userName} onUnlocked={unlock} />
        </div>
      ) : null}
    </PrivacyLockContext.Provider>
  );
}

export function PrivacyLockButton() {
  const { lock, locked } = usePrivacyLock();
  if (locked) return null;

  return (
    <button
      type="button"
      onClick={lock}
      title="Blocca schermo (Ctrl+Shift+L)"
      className="flex items-center gap-1 rounded-lg border border-white/20 px-2 py-1 text-white/75 hover:bg-white/10 hover:text-white"
    >
      <Lock className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Blocca</span>
    </button>
  );
}
