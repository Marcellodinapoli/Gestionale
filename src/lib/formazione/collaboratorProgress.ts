import type { Firestore } from "firebase-admin/firestore";
import {
  CATEGORY_RECUPERO,
  CATEGORY_SOLLECITO,
  courseLabel,
} from "@/lib/formazione/courseLabels";
import type { CourseProgress } from "@/lib/formazione/types";

export const TELEFONATA_PHASE_LABELS: Record<string, string> = {
  Approccio: "Approccio",
  Presentazione_standard: "Presentazione (standard)",
  Presentazione_privacy: "Presentazione (privacy)",
  Negoziazione: "Negoziazione",
  Chiusura: "Chiusura",
};

export const CONTESTAZIONI_PHASE_LABELS: Record<string, string> = {
  no_work: "Non sto lavorando",
  lawyer: "Ho incaricato un avvocato",
  pagamento: "Pagamento generico",
  economica: "Difficoltà economica",
};

export type QuizAnswerDetail = {
  question: string;
  selectedAnswer: string;
  correct: boolean;
};

export type RoleplayLastSimulation = {
  simulationId: string;
  title: string;
  category: string;
  practiceData: Array<{ label: string; value: string }>;
  userExchanges: number;
  totalMessages: number;
  completedAt: Date | null;
};

export type CollaboratorProgressSnapshot = {
  preCourses: CourseProgress[];
  postCourses: CourseProgress[];
  telefonata: Record<string, boolean>;
  contestazioni: Record<string, boolean>;
  roleplayLastSeenMs: number | null;
  lastRoleplay: RoleplayLastSimulation | null;
};

function tsToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const fn = (value as { toDate?: () => Date }).toDate;
    if (typeof fn === "function") return fn.call(value);
  }
  return null;
}

function boolMap(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[k] = v === true;
  }
  return out;
}

function progressFromDoc(
  id: string,
  data: Record<string, unknown>
): CourseProgress {
  const courseId = String(data.courseId ?? id);
  return {
    courseId,
    title: String(data.title ?? "Corso senza titolo"),
    code: String(data.courseLabel ?? ""),
    category: String(data.category ?? "pre"),
    videoViews: Number(data.videoViews ?? 0),
    lastVideoDate: tsToDate(data.lastVideoDate),
    quizAttempts: Number(data.quizAttempts ?? 0),
    lastQuizDate: tsToDate(data.lastQuizDate),
    lastScore:
      data.lastScore != null && !Number.isNaN(Number(data.lastScore))
        ? Number(data.lastScore)
        : null,
    lastQuizTime:
      typeof data.lastQuizTime === "number"
        ? data.lastQuizTime
        : typeof data.timeLastAttempt === "number"
          ? data.timeLastAttempt
          : null,
    downloadCount: Number(data.downloadCount ?? 0),
    downloadedFiles: Array.isArray(data.downloadedFiles)
      ? data.downloadedFiles.map(String)
      : [],
  };
}

function orderedProgress(
  catalogCategory: string,
  progressByCourseId: Map<string, CourseProgress>,
  coursesById: Map<string, Record<string, unknown>>
): CourseProgress[] {
  const catalogEntries = [...coursesById.entries()]
    .filter(([, data]) => String(data.category ?? "") === catalogCategory)
    .sort((a, b) => {
      const ma = tsToDate(a[1].createdAt)?.getTime() ?? 0;
      const mb = tsToDate(b[1].createdAt)?.getTime() ?? 0;
      return ma - mb;
    });

  const ordered: CourseProgress[] = [];
  const used = new Set<string>();

  catalogEntries.forEach(([courseId, catalogData], index) => {
    const progress = progressByCourseId.get(courseId);
    if (!progress) return;
    used.add(courseId);
    ordered.push({
      ...progress,
      courseId,
      title: String(catalogData.title ?? progress.title),
      code: courseLabel(catalogCategory, index),
      category: catalogCategory === CATEGORY_SOLLECITO ? "pre" : "post",
    });
  });

  for (const [courseId, progress] of progressByCourseId) {
    if (used.has(courseId)) continue;
    const belongs =
      catalogCategory === CATEGORY_SOLLECITO
        ? progress.category === "pre"
        : progress.category === "post";
    if (!belongs) continue;

    const catalogData = coursesById.get(courseId);
    const storedLabel = progress.code.trim();
    const label =
      storedLabel.startsWith("Corso") && storedLabel.length > 5
        ? storedLabel
        : courseLabel(catalogCategory, ordered.length);

    ordered.push({
      ...progress,
      courseId,
      title: catalogData ? String(catalogData.title ?? progress.title) : progress.title,
      code: label,
    });
  }

  return ordered;
}

function parseRoleplayLast(data: Record<string, unknown> | undefined): RoleplayLastSimulation | null {
  if (!data) return null;
  const title = String(data.title ?? "").trim();
  if (!title) return null;

  const practiceData: RoleplayLastSimulation["practiceData"] = [];
  if (Array.isArray(data.practiceData)) {
    for (const item of data.practiceData) {
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        practiceData.push({
          label: String(row.label ?? ""),
          value: String(row.value ?? row.text ?? ""),
        });
      } else if (typeof item === "string") {
        practiceData.push({ label: "", value: item });
      }
    }
  }

  return {
    simulationId: String(data.simulationId ?? ""),
    title,
    category: String(data.category ?? ""),
    practiceData,
    userExchanges: Number(data.userExchanges ?? 0),
    totalMessages: Number(data.totalMessages ?? 0),
    completedAt: tsToDate(data.completedAt),
  };
}

export async function loadCollaboratorProgress(
  db: Firestore,
  firebaseUid: string
): Promise<CollaboratorProgressSnapshot> {
  const [coursesSnap, catalogSnap, listeningSnap, userSnap, roleplaySnap] =
    await Promise.all([
      db.collection("userProgress").doc(firebaseUid).collection("courses").get(),
      db.collection("courses").get(),
      db.collection("listening_progress").doc(firebaseUid).get(),
      db.collection("users").doc(firebaseUid).get(),
      db.collection("roleplay_progress").doc(firebaseUid).get(),
    ]);

  const coursesById = new Map<string, Record<string, unknown>>();
  catalogSnap.docs.forEach((d) => coursesById.set(d.id, d.data() as Record<string, unknown>));

  const progressByCourseId = new Map<string, CourseProgress>();
  coursesSnap.docs.forEach((d) => {
    const p = progressFromDoc(d.id, d.data());
    progressByCourseId.set(p.courseId || d.id, p);
  });

  const listening = listeningSnap.data() ?? {};
  const readState = userSnap.data()?.readState;
  const roleplayLastSeenMs =
    readState && typeof readState === "object" && readState !== null
      ? Number((readState as Record<string, unknown>).roleplayLastSeenMs ?? 0) || null
      : null;

  return {
    preCourses: orderedProgress(CATEGORY_SOLLECITO, progressByCourseId, coursesById),
    postCourses: orderedProgress(CATEGORY_RECUPERO, progressByCourseId, coursesById),
    telefonata: boolMap(listening.telefonata),
    contestazioni: boolMap(listening.contestazioni),
    roleplayLastSeenMs,
    lastRoleplay: parseRoleplayLast(roleplaySnap.data()),
  };
}

export async function loadCollaboratorCourseDetail(
  db: Firestore,
  firebaseUid: string,
  courseId: string
): Promise<(CourseProgress & { answerDetails: QuizAnswerDetail[] }) | null> {
  let doc = await db
    .collection("userProgress")
    .doc(firebaseUid)
    .collection("courses")
    .doc(courseId)
    .get();

  if (!doc.exists) {
    const byCourseId = await db
      .collection("userProgress")
      .doc(firebaseUid)
      .collection("courses")
      .where("courseId", "==", courseId)
      .limit(1)
      .get();
    doc = byCourseId.docs[0] ?? doc;
  }

  if (!doc.exists) return null;

  const data = doc.data()!;
  const progress = progressFromDoc(doc.id, data);

  const catalog = await db.collection("courses").doc(progress.courseId || courseId).get();
  if (catalog.exists) {
    progress.title = String(catalog.data()?.title ?? progress.title);
  }

  const answerDetails: QuizAnswerDetail[] = [];
  if (Array.isArray(data.answerDetails)) {
    for (const item of data.answerDetails) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      answerDetails.push({
        question: String(row.question ?? ""),
        selectedAnswer: String(row.selectedAnswer ?? row.answer ?? ""),
        correct: row.correct === true || row.isCorrect === true,
      });
    }
  }

  return { ...progress, answerDetails };
}

export function courseSummaryParts(course: CourseProgress): string {
  const parts: string[] = [];
  if (course.videoViews > 0) parts.push(`Video: ${course.videoViews} visualizzazioni`);
  if (course.quizAttempts > 0 || course.lastScore != null) {
    parts.push(
      course.lastScore != null
        ? `Quiz: ${course.lastScore}%`
        : `Quiz: ${course.quizAttempts} tentativi`
    );
  }
  if (course.downloadCount > 0) parts.push(`File: ${course.downloadCount}`);
  return parts.length ? parts.join(" · ") : "Attività registrata";
}

export function parseFormazioneDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : new Date(ms);
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const fn = (value as { toDate?: () => Date }).toDate;
    if (typeof fn === "function") return fn.call(value);
  }
  return null;
}

export function formatFormazioneDateTime(value: unknown): string {
  const date = parseFormazioneDate(value);
  if (!date) return "—";
  return date.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatQuizDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m <= 0) return `${s} sec`;
  return `${m} min ${String(s).padStart(2, "0")} sec`;
}
