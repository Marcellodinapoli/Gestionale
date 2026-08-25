"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithCustomToken,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";
import {
  firebaseConfig,
  FIREBASE_FUNCTIONS_REGION,
} from "@/lib/firebase/config";

type FormazioneContextValue = {
  ready: boolean;
  loading: boolean;
  bootstrapped: boolean;
  error: string | null;
  user: User | null;
  db: Firestore | null;
  functions: Functions | null;
  retry: () => void;
};

const FormazioneContext = createContext<FormazioneContextValue | null>(null);

function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApps()[0]!;
  return initializeApp(firebaseConfig);
}

export function FormazioneProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [attempt, setAttempt] = useState(0);

  const app = useMemo(() => getFirebaseApp(), []);
  const auth = useMemo(() => getAuth(app), [app]);
  const db = useMemo(() => getFirestore(app), [app]);
  const functions = useMemo(
    () => getFunctions(app, FIREBASE_FUNCTIONS_REGION),
    [app]
  );

  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setError(null);

      try {
        await auth.authStateReady();
        if (cancelled) return;

        if (auth.currentUser) {
          setUser(auth.currentUser);
          setReady(true);
          return;
        }

        setLoading(true);
        setReady(false);

        const res = await fetch("/api/formazione/session");
        const payload = (await res.json()) as {
          token?: string;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(payload.error ?? "Sessione CreditForm non disponibile");
        }
        if (!payload.token) {
          throw new Error("Token CreditForm mancante");
        }

        await signInWithCustomToken(auth, payload.token);
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Errore CreditForm");
          setReady(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setBootstrapped(true);
        }
      }
    }

    void bootstrap();

    const unsub = onAuthStateChanged(auth, (u) => {
      if (!cancelled) setUser(u);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [auth, attempt]);

  const value = useMemo(
    () => ({ ready, loading, bootstrapped, error, user, db, functions, retry }),
    [ready, loading, bootstrapped, error, user, db, functions, retry]
  );

  return (
    <FormazioneContext.Provider value={value}>
      {children}
    </FormazioneContext.Provider>
  );
}

export function useFormazione() {
  const ctx = useContext(FormazioneContext);
  if (!ctx) {
    throw new Error("useFormazione deve essere usato dentro FormazioneProvider");
  }
  return ctx;
}

export function FormazioneGate({ children }: { children: ReactNode }) {
  const { ready, loading, bootstrapped, error, retry } = useFormazione();

  if (!bootstrapped) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-[var(--line)] bg-white p-8">
        <p className="text-sm text-[var(--muted)]">Collegamento a CreditForm…</p>
      </div>
    );
  }

  if (error || !ready) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
        <p className="font-semibold">CreditForm non disponibile</p>
        <p className="mt-2 text-amber-900/80">{error ?? "Sessione non attiva"}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 rounded-lg bg-[var(--navy)] px-4 py-2 text-xs font-semibold text-white"
        >
          Riprova
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
