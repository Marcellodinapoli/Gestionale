"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Check, Download, Eye, X } from "lucide-react";
import {
  formatFormazioneDateTime,
  formatQuizDuration,
  type QuizAnswerDetail,
} from "@/lib/formazione/collaboratorProgress";
import type { CourseProgress } from "@/lib/formazione/types";

type CourseDetail = CourseProgress & { answerDetails: QuizAnswerDetail[] };

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-bold text-[var(--navy)]">{title}</h2>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[11rem_1fr] gap-3 text-sm">
      <span className="font-semibold text-[var(--navy)]">{label}</span>
      <span className="text-[var(--muted)]">{value}</span>
    </div>
  );
}

export function CollaboratorCourseDetailView({
  firebaseUid,
  courseId,
}: {
  firebaseUid: string;
  courseId: string;
}) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/formazione/collaboratori/${firebaseUid}/courses/${encodeURIComponent(courseId)}`
        );
        const data = (await res.json()) as { course?: CourseDetail; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Errore caricamento");
        if (!cancelled) setCourse(data.course ?? null);
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
  }, [firebaseUid, courseId]);

  const correct = course?.answerDetails.filter((a) => a.correct).length ?? 0;
  const wrong = course?.answerDetails.filter((a) => !a.correct).length ?? 0;

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="py-10 text-center text-sm text-[var(--muted)]">Caricamento…</p>
      ) : error || !course ? (
        <p className="py-10 text-center text-sm text-[var(--danger)]">{error ?? "Corso non trovato"}</p>
      ) : (
        <>
          <div>
            <h1 className="text-lg font-bold text-[var(--navy)]">{course.title}</h1>
            {course.code ? (
              <p className="mt-1 text-sm font-semibold text-[#607D8B]">{course.code}</p>
            ) : null}
          </div>

          <InfoCard title="Video">
            <Kv label="Numero visualizzazioni" value={String(course.videoViews)} />
            <Kv
              label="Ultima visualizzazione"
              value={formatFormazioneDateTime(course.lastVideoDate)}
            />
          </InfoCard>

          <InfoCard title="Quiz">
            <Kv label="Numero tentativi" value={String(course.quizAttempts)} />
            <Kv
              label="Ultima esecuzione"
              value={formatFormazioneDateTime(course.lastQuizDate)}
            />
            <Kv
              label="Ultimo punteggio"
              value={course.lastScore != null ? `${course.lastScore}%` : "—"}
            />
            <Kv
              label="Tempo ultimo tentativo"
              value={formatQuizDuration(course.lastQuizTime)}
            />
            <Kv label="Risposte corrette" value={correct > 0 ? String(correct) : "—"} />
            <Kv label="Risposte errate" value={wrong > 0 ? String(wrong) : "—"} />
            {course.answerDetails.length ? (
              <button
                type="button"
                onClick={() => setShowAnswers(true)}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy)] hover:bg-slate-50"
              >
                <Eye className="h-4 w-4" />
                Dettaglio risposte
              </button>
            ) : null}
          </InfoCard>

          <InfoCard title="File scaricati">
            <Kv label="Totale" value={String(course.downloadCount)} />
            {course.downloadedFiles.length ? (
              <ul className="mt-1 space-y-2">
                {course.downloadedFiles.map((file) => (
                  <li
                    key={file}
                    className="flex items-start gap-2 text-sm text-[var(--navy)]"
                  >
                    <Download className="mt-0.5 h-4 w-4 shrink-0 text-[#607D8B]" />
                    <span>{file}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </InfoCard>
        </>
      )}

      {showAnswers && course?.answerDetails.length ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowAnswers(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[var(--line)] px-5 py-4">
              <h3 className="text-lg font-bold text-[var(--navy)]">Dettaglio risposte quiz</h3>
            </div>
            <ul className="max-h-[70vh] overflow-y-auto divide-y divide-[var(--line)]">
              {course.answerDetails.map((row, i) => (
                <li key={i} className="flex gap-3 px-5 py-3 text-sm">
                  {row.correct ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  )}
                  <div>
                    <p className="font-semibold text-[var(--navy)]">{row.question}</p>
                    <p className="mt-1 text-[var(--muted)]">{row.selectedAnswer || "—"}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-[var(--line)] px-5 py-3 text-right">
              <button
                type="button"
                onClick={() => setShowAnswers(false)}
                className="rounded-lg bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
