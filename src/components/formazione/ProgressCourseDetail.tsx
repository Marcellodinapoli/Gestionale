"use client";

import Link from "next/link";
import { useFormazione } from "@/components/formazione/FormazioneProvider";
import { CollaboratorCourseDetailView } from "@/components/formazione/supervisor/CollaboratorCourseDetailView";

export function ProgressCourseDetail({
  courseId,
  courseLabel,
  catalogCategory,
}: {
  courseId: string;
  courseLabel: string;
  catalogCategory?: string;
}) {
  const { user } = useFormazione();
  const corsoQs = new URLSearchParams();
  if (courseLabel) corsoQs.set("label", courseLabel);
  if (catalogCategory) corsoQs.set("category", catalogCategory);
  const corsoHref = `/formazione/corsi/${courseId}${corsoQs.toString() ? `?${corsoQs}` : ""}`;

  if (!user) {
    return <p className="py-10 text-center text-sm text-[var(--muted)]">Caricamento…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/formazione/progressi" className="text-sm underline">
          ← I miei progressi
        </Link>
        <Link
          href={corsoHref}
          className="text-sm font-semibold text-[var(--navy)] underline"
        >
          Apri corso
        </Link>
      </div>
      <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm sm:p-6">
        <CollaboratorCourseDetailView
          firebaseUid={user.uid}
          courseId={courseId}
          ownProgress
        />
      </div>
    </div>
  );
}
