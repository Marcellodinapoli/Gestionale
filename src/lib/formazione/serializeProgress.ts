import type { CollaboratorProgressSnapshot } from "@/lib/formazione/collaboratorProgress";
import type { CourseProgress } from "@/lib/formazione/types";

export type CourseProgressJson = {
  courseId: string;
  title: string;
  code: string;
  category: string;
  videoViews: number;
  lastVideoDate: string | null;
  quizAttempts: number;
  lastQuizDate: string | null;
  lastScore?: number | null;
  lastQuizTime?: number | null;
  downloadCount: number;
  downloadedFiles: string[];
};

function courseToJson(p: CourseProgress): CourseProgressJson {
  return {
    ...p,
    lastVideoDate: p.lastVideoDate?.toISOString() ?? null,
    lastQuizDate: p.lastQuizDate?.toISOString() ?? null,
  };
}

export function progressSnapshotToJson(snapshot: CollaboratorProgressSnapshot) {
  return {
    preCourses: snapshot.preCourses.map(courseToJson),
    postCourses: snapshot.postCourses.map(courseToJson),
    telefonata: snapshot.telefonata,
    contestazioni: snapshot.contestazioni,
    roleplayLastSeenMs: snapshot.roleplayLastSeenMs,
    lastRoleplay: snapshot.lastRoleplay
      ? {
          ...snapshot.lastRoleplay,
          completedAt: snapshot.lastRoleplay.completedAt?.toISOString() ?? null,
        }
      : null,
  };
}

export function courseProgressFromJson(raw: CourseProgressJson): CourseProgress {
  return {
    ...raw,
    lastVideoDate: raw.lastVideoDate ? new Date(raw.lastVideoDate) : null,
    lastQuizDate: raw.lastQuizDate ? new Date(raw.lastQuizDate) : null,
  };
}
