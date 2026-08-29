"use client";

import { useEffect, useState } from "react";
import { CourseProgressPanel } from "@/components/formazione/CourseProgressPanel";
import type { CourseProgress } from "@/lib/formazione/types";
import type { CollaboratorProgressSnapshot } from "@/lib/formazione/collaboratorProgress";

export function CollaboratorProgressView({ firebaseUid }: { firebaseUid: string }) {
  const [progress, setProgress] = useState<CollaboratorProgressSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/formazione/collaboratori/${firebaseUid}/progress`);
        const data = (await res.json()) as {
          progress?: CollaboratorProgressSnapshot;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Errore caricamento");
        if (!cancelled) setProgress(data.progress ?? null);
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
  }, [firebaseUid]);

  return (
    <CourseProgressPanel
      preCourses={progress?.preCourses ?? []}
      postCourses={progress?.postCourses ?? []}
      loading={loading}
      error={error}
      embedded
      detailHref={(course: CourseProgress) =>
        `/formazione/collaboratori/${firebaseUid}/corsi/${encodeURIComponent(course.courseId)}`
      }
    />
  );
}
