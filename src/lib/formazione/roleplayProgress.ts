import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";

export type RoleplayHistoryMessage = {
  role: string;
  content: string;
};

export type RoleplaySimulationDetail = {
  history: RoleplayHistoryMessage[];
  suggestion?: string;
  conversationAt?: Date;
  evaluatedAt?: Date;
  durationMs: number;
  userExchanges: number;
};

const MIN_SUGGESTION_DURATION_MS = 30_000;
const MIN_SUGGESTION_EXCHANGES = 1;

export function parseSimulationDetail(raw: unknown): RoleplaySimulationDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const map = raw as Record<string, unknown>;
  const historyRaw = map.history;
  const history: RoleplayHistoryMessage[] = [];
  if (Array.isArray(historyRaw)) {
    for (const item of historyRaw) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      history.push({
        role: String(row.role ?? ""),
        content: String(row.content ?? ""),
      });
    }
  }
  const suggestion = String(map.suggestion ?? "").trim();
  const conversationMs = map.conversationAtMs;
  const evaluatedMs = map.evaluatedAtMs;
  const durationMs = Number(map.durationMs ?? 0);
  const userExchanges =
    Number(map.userExchanges ?? 0) ||
    history.filter((m) => m.role === "user").length;

  return {
    history,
    suggestion: suggestion || undefined,
    conversationAt:
      typeof conversationMs === "number"
        ? new Date(conversationMs)
        : undefined,
    evaluatedAt:
      typeof evaluatedMs === "number" ? new Date(evaluatedMs) : undefined,
    durationMs,
    userExchanges,
  };
}

export function watchSimulationDetails(
  db: Firestore,
  uid: string,
  onChange: (details: Record<string, RoleplaySimulationDetail>) => void
) {
  return onSnapshot(doc(db, "roleplay_progress", uid), (snap) => {
    const raw =
      (snap.data()?.simulations as Record<string, unknown> | undefined) ?? {};
    const out: Record<string, RoleplaySimulationDetail> = {};
    for (const [id, value] of Object.entries(raw)) {
      const detail = parseSimulationDetail(value);
      if (detail) out[id] = detail;
    }
    onChange(out);
  });
}

export function formatDateTime(value: Date) {
  const dd = String(value.getDate()).padStart(2, "0");
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const yy = value.getFullYear();
  const hh = String(value.getHours()).padStart(2, "0");
  const min = String(value.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

export function formatDuration(durationMs: number) {
  if (durationMs <= 0) return "";
  const totalSec = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes <= 0) return `${seconds} sec`;
  return `${minutes} min ${String(seconds).padStart(2, "0")} sec`;
}

export function formatHistoryPreview(
  history: RoleplayHistoryMessage[],
  maxChars = 160
) {
  if (!history.length) return "";
  const text = history
    .map((m) => {
      const who = m.role === "user" ? "Tu" : "AI";
      return `${who}: ${m.content}`;
    })
    .join(" · ");
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()}…`;
}

export function hasConversation(detail?: RoleplaySimulationDetail) {
  return Boolean(detail?.history.length);
}

export function hasSuggestion(detail?: RoleplaySimulationDetail) {
  return Boolean(detail?.suggestion?.trim());
}

export function isLongEnoughForSuggestion(detail?: RoleplaySimulationDetail) {
  if (!detail) return false;
  return (
    detail.durationMs >= MIN_SUGGESTION_DURATION_MS ||
    detail.userExchanges >= MIN_SUGGESTION_EXCHANGES
  );
}

export async function saveLastSimulation(
  db: Firestore,
  uid: string,
  payload: {
    simulationId: string;
    title: string;
    category: string;
    practiceData: unknown[];
    userExchanges: number;
    totalMessages: number;
    history: RoleplayHistoryMessage[];
    durationMs: number;
  }
) {
  const nowMs = Date.now();
  const ref = doc(db, "roleplay_progress", uid);
  const snap = await getDoc(ref);
  const root = snap.data() ?? {};
  const simulations = {
    ...((root.simulations as Record<string, unknown> | undefined) ?? {}),
    [payload.simulationId]: {
      history: payload.history,
      conversationAtMs: nowMs,
      durationMs: payload.durationMs,
      userExchanges: payload.userExchanges,
      suggestion: "",
      updatedAtMs: nowMs,
    },
  };

  await setDoc(
    ref,
    {
      userId: uid,
      simulationId: payload.simulationId,
      title: payload.title,
      category: payload.category,
      practiceData: payload.practiceData,
      userExchanges: payload.userExchanges,
      totalMessages: payload.totalMessages,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      simulations,
    },
    { merge: true }
  );
}

export async function saveSimulationSuggestion(
  db: Firestore,
  uid: string,
  simulationId: string,
  suggestion: string
) {
  const text = suggestion.trim();
  if (!text) return;
  const nowMs = Date.now();
  const ref = doc(db, "roleplay_progress", uid);
  const snap = await getDoc(ref);
  const root = snap.data() ?? {};
  const simulations = {
    ...((root.simulations as Record<string, unknown> | undefined) ?? {}),
    [simulationId]: {
      ...(((root.simulations as Record<string, Record<string, unknown>> | undefined)?.[
        simulationId
      ] as Record<string, unknown> | undefined) ?? {}),
      suggestion: text,
      evaluatedAtMs: nowMs,
      updatedAtMs: nowMs,
    },
  };

  await setDoc(
    ref,
    {
      userId: uid,
      simulations,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
