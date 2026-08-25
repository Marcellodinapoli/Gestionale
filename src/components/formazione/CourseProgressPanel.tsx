"use client";

import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import { SollecitoRecuperoTabs } from "@/components/formazione/warmup/WarmupUi";
import type { CourseProgress } from "@/lib/formazione/types";

function calcProgress(value: number) {
  return Math.min(1, Math.max(0, value / 10));
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  const percent = Math.round(value * 100);
  const completed = value >= 1;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-[70px] shrink-0 font-semibold text-[var(--navy)]">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-md bg-[#E0E0E0]">
        <div
          className={`h-full rounded-md transition-all ${
            completed ? "bg-[#1565C0]" : "bg-[#9E9E9E]"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-11 shrink-0 tabular-nums text-[var(--navy)]">{percent}%</span>
    </div>
  );
}

function ProgressCard({
  course,
  detailHref,
}: {
  course: CourseProgress;
  detailHref: string;
}) {
  const quizProgress =
    course.lastScore != null
      ? Math.min(1, Math.max(0, course.lastScore / 100))
      : calcProgress(course.quizAttempts);

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
      <h3 className="text-base font-bold text-[var(--navy)]">{course.title}</h3>
      <p className="mt-1 text-sm font-semibold text-[#607D8B]">{course.code}</p>
      <div className="mt-3 space-y-2">
        <ProgressRow label="Video" value={calcProgress(course.videoViews)} />
        <ProgressRow label="Quiz" value={quizProgress} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)]">
          <Download className="h-4 w-4" />
          File scaricati: {course.downloadCount}
        </span>
        <Link
          href={detailHref}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a365d] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#132033]"
        >
          <ExternalLink className="h-4 w-4" />
          Dettagli
        </Link>
      </div>
    </article>
  );
}

function ProgressBody({
  list,
  detailHref,
}: {
  list: CourseProgress[];
  detailHref: (course: CourseProgress) => string;
}) {
  if (!list.length) {
    return (
      <p className="py-10 text-center text-sm text-black/55">Nessun progresso registrato.</p>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      {list.map((course) => (
        <ProgressCard
          key={course.courseId}
          course={course}
          detailHref={detailHref(course)}
        />
      ))}
    </div>
  );
}

export function CourseProgressPanel({
  preCourses,
  postCourses,
  loading = false,
  error = null,
  detailHref,
  showTitle = false,
  embedded = false,
}: {
  preCourses: CourseProgress[];
  postCourses: CourseProgress[];
  loading?: boolean;
  error?: string | null;
  detailHref: (course: CourseProgress) => string;
  showTitle?: boolean;
  embedded?: boolean;
}) {
  const [tab, setTab] = useState<"sollecito" | "recupero">("sollecito");
  const list = tab === "sollecito" ? preCourses : postCourses;

  const content = (
    <>
      {showTitle ? (
        <h2 className="text-lg font-bold text-[var(--navy)]">Progresso corsi</h2>
      ) : null}
      <div className={showTitle ? "mt-4" : undefined}>
        <SollecitoRecuperoTabs active={tab} onChange={setTab} />
      </div>
      <div className="mt-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-[var(--muted)]">Caricamento…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-[var(--danger)]">{error}</p>
        ) : (
          <ProgressBody list={list} detailHref={detailHref} />
        )}
      </div>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm sm:p-6">
      {content}
    </div>
  );
}
