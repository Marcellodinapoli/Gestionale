"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { useFormazione } from "@/components/formazione/FormazioneProvider";
import {
  CATEGORY_RECUPERO,
  CATEGORY_SOLLECITO,
  courseLabel,
} from "@/lib/formazione/courseLabels";
import { SollecitoRecuperoTabs } from "@/components/formazione/warmup/WarmupUi";
import type { CourseDoc } from "@/lib/formazione/types";

/** Parse snello per la lista: niente quiz (pesante e non mostrato in card). */
function parseCourseListItem(id: string, data: DocumentData): CourseDoc {
  const rawTags = data.tags;
  const rawContents = data.contents;
  const rawAttachments = data.attachments;

  return {
    id,
    title: String(data.title ?? "—"),
    description: String(data.description ?? ""),
    category: String(data.category ?? ""),
    tags: Array.isArray(rawTags) ? rawTags.map(String) : [],
    contents: Array.isArray(rawContents) ? rawContents.map(String) : [],
    attachments: Array.isArray(rawAttachments) ? rawAttachments : [],
    videoUrl: undefined,
    quiz: undefined,
    createdAt: data.createdAt ?? null,
  };
}

function extractFileName(url: string) {
  try {
    const decoded = decodeURIComponent(url);
    let name = decoded.split("/").pop() ?? url;
    name = name.split("?")[0] ?? name;
    name = name.replace(/^attachments%2F/, "");
    name = name.replace(/^[0-9]+_/, "");
    return decodeURIComponent(name);
  } catch {
    return url;
  }
}

function StatusPill({ text }: { text: string }) {
  return (
    <span className="rounded-2xl border-2 border-[#E91E63] bg-white px-2.5 py-1 text-xs font-bold text-[#E91E63]">
      {text}
    </span>
  );
}

function CourseCard({
  course,
  code,
  catalogCategory,
}: {
  course: CourseDoc;
  code: string;
  catalogCategory: string;
}) {
  const tags = course.tags.length ? course.tags.join(", ") : "Nessun tag";

  return (
    <article className="flex h-[480px] w-full min-w-[280px] shrink-0 flex-col rounded-2xl border border-[#E2E8F0] bg-white md:h-[520px] md:w-[380px]">
      <div className="flex h-full flex-col px-4 pt-4 pb-3">
        <div className="rounded-xl bg-[#FFA726] px-4 py-3 text-center">
          <h3 className="truncate text-xl font-extrabold text-black">{course.title}</h3>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[#607D8B]">{code}</span>
          <StatusPill text="Non iniziato" />
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1 text-sm">
          <div className="space-y-2">
            <div>
              <p className="font-bold text-[var(--navy)]">Cosa contiene:</p>
              {course.contents.length ? (
                <ul className="mt-1.5 space-y-0.5 text-[var(--muted)]">
                  {course.contents.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[var(--muted)]">—</p>
              )}
            </div>

            {course.description ? (
              <div>
                <p className="font-bold text-[var(--navy)]">Cosa vedremo:</p>
                <p className="mt-1.5 line-clamp-3 text-[var(--muted)]">
                  • {course.description}
                </p>
              </div>
            ) : null}

            {course.attachments.length ? (
              <div>
                <p className="font-bold text-[var(--navy)]">Allegati:</p>
                <ul className="mt-1.5 space-y-0.5">
                  {course.attachments.map((file, i) => {
                    const url =
                      typeof file === "string" ? file : String(file.url ?? "");
                    const name =
                      typeof file === "string"
                        ? extractFileName(url)
                        : String(
                            file.name ?? (url ? extractFileName(url) : "file")
                          );
                    return (
                      <li key={`${url}-${i}`}>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#2196F3] hover:underline"
                          >
                            📎 {name}
                          </a>
                        ) : (
                          <span className="text-[var(--muted)]">📎 {name}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {course.tags.length ? (
              <div>
                <p className="font-bold text-[var(--navy)]">Tag:</p>
                <p className="mt-1 line-clamp-2 text-[var(--muted)]">{tags}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex justify-end">
          <Link
            href={`/formazione/corsi/${course.id}?label=${encodeURIComponent(code)}&category=${encodeURIComponent(catalogCategory)}`}
            prefetch
            className="rounded-full border-2 border-[#E91E63] px-[22px] py-2.5 text-sm font-semibold text-[#E91E63] transition hover:bg-[#E91E63]/5"
          >
            Accedi
          </Link>
        </div>
      </div>
    </article>
  );
}

function CoursesBody({ category }: { category: string }) {
  const { db } = useFormazione();
  const [courses, setCourses] = useState<CourseDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    let cancelled = false;

    async function load() {
      if (!db) return;
      setLoading(true);
      setError(null);
      try {
        const q = query(
          collection(db, "courses"),
          where("category", "==", category),
          orderBy("createdAt", "asc")
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        setCourses(snap.docs.map((d) => parseCourseListItem(d.id, d.data())));
      } catch {
        try {
          const q = query(
            collection(db, "courses"),
            where("category", "==", category)
          );
          const snap = await getDocs(q);
          if (cancelled) return;
          const rows = snap.docs.map((d) => parseCourseListItem(d.id, d.data()));
          rows.sort((a, b) => {
            const ma =
              a.createdAt &&
              typeof a.createdAt === "object" &&
              "toMillis" in a.createdAt
                ? (a.createdAt as { toMillis: () => number }).toMillis()
                : 0;
            const mb =
              b.createdAt &&
              typeof b.createdAt === "object" &&
              "toMillis" in b.createdAt
                ? (b.createdAt as { toMillis: () => number }).toMillis()
                : 0;
            return ma - mb;
          });
          setCourses(rows);
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Errore caricamento");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [db, category]);

  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-[var(--muted)]">Caricamento corsi…</p>
    );
  }

  if (error) {
    return (
      <p className="py-12 text-center text-sm text-[var(--danger)]">
        Errore nel caricamento corsi: {error}
      </p>
    );
  }

  if (!courses.length) {
    return (
      <p className="py-12 text-center text-sm text-black/55">
        Nessun corso disponibile
      </p>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-wrap items-center justify-center gap-3 text-[15px]">
        <span className="font-semibold text-[var(--navy)]">{courses.length} corsi</span>
        <span className="text-black/55">Durata totale: —</span>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        {courses.map((course, index) => (
          <CourseCard
            key={course.id}
            course={course}
            code={courseLabel(category, index)}
            catalogCategory={category}
          />
        ))}
      </div>
    </div>
  );
}

export function CoursesList() {
  const [tab, setTab] = useState<"sollecito" | "recupero">("sollecito");
  const category = useMemo(
    () => (tab === "sollecito" ? CATEGORY_SOLLECITO : CATEGORY_RECUPERO),
    [tab]
  );

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm sm:p-6">
      <SollecitoRecuperoTabs active={tab} onChange={setTab} />
      <div className="mt-4">
        <CoursesBody category={category} />
      </div>
    </div>
  );
}
