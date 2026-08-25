"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  type DocumentData,
} from "firebase/firestore";
import { useFormazione } from "@/components/formazione/FormazioneProvider";
import { CourseProgressPanel } from "@/components/formazione/CourseProgressPanel";
import {
  CATEGORY_RECUPERO,
  CATEGORY_SOLLECITO,
  courseLabel,
} from "@/lib/formazione/courseLabels";
import type { CourseProgress } from "@/lib/formazione/types";

function tsToDate(value: unknown): Date | null {
  if (!value || typeof value !== "object") return null;
  if ("toDate" in value && typeof value.toDate === "function") {
    return value.toDate() as Date;
  }
  return null;
}

function progressFromDoc(id: string, data: DocumentData): CourseProgress {
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
      typeof data.lastQuizTime === "number" ? data.lastQuizTime : null,
    downloadCount: Number(data.downloadCount ?? 0),
    downloadedFiles: Array.isArray(data.downloadedFiles)
      ? data.downloadedFiles.map(String)
      : [],
  };
}

function orderedProgress(
  catalogCategory: string,
  progressByCourseId: Map<string, CourseProgress>,
  coursesById: Map<string, DocumentData>
) {
  const catalogEntries = [...coursesById.entries()]
    .filter(([, data]) => String(data.category ?? "") === catalogCategory)
    .sort((a, b) => {
      const ma =
        a[1].createdAt && typeof a[1].createdAt === "object" && "toMillis" in a[1].createdAt
          ? (a[1].createdAt as { toMillis: () => number }).toMillis()
          : 0;
      const mb =
        b[1].createdAt && typeof b[1].createdAt === "object" && "toMillis" in b[1].createdAt
          ? (b[1].createdAt as { toMillis: () => number }).toMillis()
          : 0;
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

export function ProgressList() {
  const { db, user } = useFormazione();
  const [pre, setPre] = useState<CourseProgress[]>([]);
  const [post, setPost] = useState<CourseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !user) return;

    let cancelled = false;

    async function load() {
      if (!db || !user) return;
      const firestore = db;
      const uid = user.uid;

      setLoading(true);
      setError(null);
      try {
        const [progressSnap, coursesSnap] = await Promise.all([
          getDocs(collection(firestore, "userProgress", uid, "courses")),
          getDocs(collection(firestore, "courses")),
        ]);

        const coursesById = new Map<string, DocumentData>();
        coursesSnap.docs.forEach((d) => coursesById.set(d.id, d.data()));

        const progressByCourseId = new Map<string, CourseProgress>();
        progressSnap.docs.forEach((d) => {
          const p = progressFromDoc(d.id, d.data());
          progressByCourseId.set(p.courseId || d.id, p);
        });

        if (cancelled) return;
        setPre(
          orderedProgress(CATEGORY_SOLLECITO, progressByCourseId, coursesById)
        );
        setPost(
          orderedProgress(CATEGORY_RECUPERO, progressByCourseId, coursesById)
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Errore caricamento");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [db, user]);

  return (
    <CourseProgressPanel
      preCourses={pre}
      postCourses={post}
      loading={loading}
      error={error}
      showTitle
      detailHref={(course) =>
        `/formazione/corsi/${course.courseId}?label=${encodeURIComponent(course.code)}`
      }
    />
  );
}
