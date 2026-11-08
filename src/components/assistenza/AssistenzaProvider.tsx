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
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, onAuthStateChanged, type Auth, type User } from "firebase/auth";
import { getFunctions, type Functions } from "firebase/functions";
import { firebaseConfig, FIREBASE_FUNCTIONS_REGION } from "@/lib/firebase/config";
import { refreshAssistenzaFirebaseSession } from "@/lib/assistenza/refreshAssistenzaSession";

type AssistenzaContextValue = {
  ready: boolean;
  loading: boolean;
  error: string | null;
  user: User | null;
  functions: Functions | null;
  retry: () => void;
};

const AssistenzaContext = createContext<AssistenzaContextValue | null>(null);

function getOrInitApp(): FirebaseApp {
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp(firebaseConfig);
}

export function AssistenzaProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [attempt, setAttempt] = useState(0);

  const app = useMemo(() => getOrInitApp(), []);
  const auth = useMemo(() => getAuth(app), [app]);
  const functions = useMemo(
    () => getFunctions(app, FIREBASE_FUNCTIONS_REGION),
    [app],
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

        setLoading(true);
        setReady(false);

        await refreshAssistenzaFirebaseSession(auth);
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Errore assistenza Credixa Suite");
          setReady(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
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
    () => ({ ready, loading, error, user, functions, retry }),
    [ready, loading, error, user, functions, retry],
  );

  return (
    <AssistenzaContext.Provider value={value}>{children}</AssistenzaContext.Provider>
  );
}

export function useAssistenza() {
  const ctx = useContext(AssistenzaContext);
  if (!ctx) {
    throw new Error("useAssistenza richiede AssistenzaProvider");
  }
  return ctx;
}
