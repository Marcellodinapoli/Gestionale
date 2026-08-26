import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";

export type NormativeSearchLogEntry = {
  id: string;
  question: string;
  answer: string;
  answerPreview: string;
  createdAt?: Date;
};

function parseEntry(id: string, data: Record<string, unknown>): NormativeSearchLogEntry {
  const createdAt = data.createdAt;
  let date: Date | undefined;
  if (createdAt && typeof createdAt === "object" && "toDate" in createdAt) {
    date = (createdAt as Timestamp).toDate();
  }
  return {
    id,
    question: String(data.question ?? ""),
    answer: String(data.answer ?? ""),
    answerPreview: String(data.answerPreview ?? ""),
    createdAt: date,
  };
}

function sortEntries(entries: NormativeSearchLogEntry[]) {
  entries.sort(
    (a, b) =>
      (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  );
  return entries;
}

/** Una lettura (senza listener): usata all'apertura della cronologia. */
export async function loadMyNormativeSearchLogsOnce(
  db: Firestore,
  uid: string,
  max = 40
): Promise<NormativeSearchLogEntry[]> {
  try {
    const q = query(
      collection(db, "normative_search_logs"),
      where("userId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => parseEntry(d.id, d.data()));
  } catch {
    // Fallback se manca l'indice composto
    const q = query(
      collection(db, "normative_search_logs"),
      where("userId", "==", uid)
    );
    const snap = await getDocs(q);
    return sortEntries(snap.docs.map((d) => parseEntry(d.id, d.data()))).slice(
      0,
      max
    );
  }
}

export function watchMyNormativeSearchLogs(
  db: Firestore,
  uid: string,
  onChange: (entries: NormativeSearchLogEntry[]) => void,
  max = 40
) {
  const q = query(collection(db, "normative_search_logs"), where("userId", "==", uid));
  return onSnapshot(q, (snap) => {
    onChange(
      sortEntries(snap.docs.map((d) => parseEntry(d.id, d.data()))).slice(0, max)
    );
  });
}

export function formatLogDate(value?: Date) {
  if (!value) return "—";
  const dd = String(value.getDate()).padStart(2, "0");
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const yy = value.getFullYear();
  const hh = String(value.getHours()).padStart(2, "0");
  const min = String(value.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy}  ${hh}:${min}`;
}
