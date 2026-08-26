"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useFormazione } from "@/components/formazione/FormazioneProvider";
import { QuizTab } from "@/components/formazione/QuizTab";
import { AttachmentsTab } from "@/components/formazione/AttachmentsTab";
import { TrainingMaterialTabs } from "@/components/formazione/warmup/WarmupUi";
import { courseLabel as getCourseLabel } from "@/lib/formazione/courseLabels";

function CourseNavButton({
  direction,
  label,
  title,
  href,
}: {
  direction: "prev" | "next";
  label: string;
  title: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      prefetch
      className="group max-w-[45%] text-[#9C27B0] transition hover:text-[#7B1FA2]"
    >
      <div
        className={`flex items-start gap-1.5 ${
          direction === "next" ? "flex-row-reverse text-right" : ""
        }`}
      >
        {direction === "prev" ? (
          <ArrowLeft className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <div>
          <p className="text-xs font-bold">{label}</p>
          <p className="text-[13px] leading-snug">{title}</p>
        </div>
      </div>
    </Link>
  );
}

export function CourseTraining({
  courseId,
  courseLabel: initialCourseLabel,
  catalogCategory,
}: {
  courseId: string;
  courseLabel: string;
  catalogCategory?: string;
}) {
  const { db, user } = useFormazione();
  const [tab, setTab] = useState<"video" | "quiz" | "allegati">("video");
  const [title, setTitle] = useState("");
  const [courseLabel, setCourseLabel] = useState(initialCourseLabel);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [neighbors, setNeighbors] = useState<{
    prev?: { id: string; title: string; label: string };
    next?: { id: string; title: string; label: string };
  }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) return;
    let cancelled = false;

    async function load() {
      if (!db) return;
      const firestore = db;

      // 1) Corso: mostra subito video/titolo
      const courseSnap = await getDoc(doc(firestore, "courses", courseId));
      if (cancelled) return;
      if (!courseSnap.exists()) {
        setLoading(false);
        return;
      }

      const data = courseSnap.data()!;
      const category = String(data.category ?? catalogCategory ?? "");
      const resolvedVideoUrl = data.videoUrl ? String(data.videoUrl) : null;
      setTitle(String(data.title ?? "Training"));
      setVideoUrl(resolvedVideoUrl);
      setLoading(false);

      // 2) Progress + catalogo vicini in parallelo (non bloccano il video)
      const progressWrite =
        user && resolvedVideoUrl
          ? setDoc(
              doc(firestore, "userProgress", user.uid, "courses", courseId),
              {
                courseId,
                title: String(data.title ?? ""),
                courseLabel: initialCourseLabel,
                videoViews: increment(1),
                lastVideoDate: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            ).catch(() => undefined)
          : Promise.resolve();

      const neighborsLoad = category
        ? (async () => {
            const q = query(
              collection(firestore, "courses"),
              where("category", "==", category),
              orderBy("createdAt", "asc")
            );
            const catalogSnap = await getDocs(q);
            if (cancelled) return;
            const docs = catalogSnap.docs;
            const idx = docs.findIndex((d) => d.id === courseId);
            if (idx < 0) return;
            const label = getCourseLabel(category, idx);
            setCourseLabel(initialCourseLabel || label);
            const prevDoc = idx > 0 ? docs[idx - 1] : undefined;
            const nextDoc = idx < docs.length - 1 ? docs[idx + 1] : undefined;
            setNeighbors({
              prev: prevDoc
                ? {
                    id: prevDoc.id,
                    title: String(prevDoc.data().title ?? ""),
                    label: getCourseLabel(category, idx - 1),
                  }
                : undefined,
              next: nextDoc
                ? {
                    id: nextDoc.id,
                    title: String(nextDoc.data().title ?? ""),
                    label: getCourseLabel(category, idx + 1),
                  }
                : undefined,
            });
          })()
        : Promise.resolve();

      await Promise.all([progressWrite, neighborsLoad]);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [db, user, courseId, initialCourseLabel, catalogCategory]);

  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-[var(--muted)]">Caricamento corso…</p>
    );
  }

  const neighborQuery = (id: string, label: string) =>
    `/formazione/corsi/${id}?label=${encodeURIComponent(label)}&category=${encodeURIComponent(catalogCategory ?? "")}`;

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-start justify-between gap-4 pt-3">
        {neighbors.prev ? (
          <CourseNavButton
            direction="prev"
            label="PRECEDENTE"
            title={neighbors.prev.title}
            href={neighborQuery(neighbors.prev.id, neighbors.prev.label)}
          />
        ) : (
          <div className="w-[100px]" />
        )}
        {neighbors.next ? (
          <CourseNavButton
            direction="next"
            label="SUCCESSIVO"
            title={neighbors.next.title}
            href={neighborQuery(neighbors.next.id, neighbors.next.label)}
          />
        ) : (
          <div className="w-[100px]" />
        )}
      </div>

      <TrainingMaterialTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "video", label: "Video corso" },
          { id: "quiz", label: "Quiz" },
          { id: "allegati", label: "Allegati" },
        ]}
      />

      <div className="pt-4">
        {tab === "video" ? (
          videoUrl && videoUrl.startsWith("http") ? (
            <div className="aspect-video overflow-hidden rounded-xl bg-black">
              <iframe
                src={videoUrl}
                title={title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-black/55">
              Contenuto video non disponibile
            </p>
          )
        ) : null}

        {tab === "quiz" ? (
          <QuizTab
            courseId={courseId}
            courseTitle={title}
            courseLabel={courseLabel}
            catalogCategory={catalogCategory}
          />
        ) : null}

        {tab === "allegati" ? (
          <AttachmentsTab
            courseId={courseId}
            courseTitle={title}
            courseLabel={courseLabel}
            catalogCategory={catalogCategory}
          />
        ) : null}
      </div>
    </div>
  );
}
