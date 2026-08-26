"use client";

import { useEffect, useState } from "react";
import {
  arrayUnion,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useFormazione } from "@/components/formazione/FormazioneProvider";
import { storageCategory } from "@/lib/formazione/courseLabels";

type AttachmentFile = {
  url: string;
  name: string;
};

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

function parseAttachments(raw: unknown): AttachmentFile[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((file) => {
    if (typeof file === "string") {
      return [{ url: file, name: extractFileName(file) }];
    }
    if (file && typeof file === "object") {
      const record = file as { url?: string; name?: string };
      const url = String(record.url ?? "");
      const name = String(
        record.name ?? (url ? extractFileName(url) : "file")
      );
      return [{ url, name }];
    }
    return [];
  });
}

function isDownloaded(fileName: string, downloadedFiles: string[]) {
  const target = fileName.trim().toLowerCase();
  return downloadedFiles.some((entry) => entry.trim().toLowerCase() === target);
}

function MaterialCheckCircleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-6 w-6 shrink-0 text-green-600"
      fill="currentColor"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}

function MaterialInsertDriveFileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-6 w-6 shrink-0 text-[#2196F3]"
      fill="currentColor"
    >
      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
    </svg>
  );
}

export function AttachmentsTab({
  courseId,
  courseTitle,
  courseLabel,
  catalogCategory,
}: {
  courseId: string;
  courseTitle: string;
  courseLabel: string;
  catalogCategory?: string;
}) {
  const { db, user } = useFormazione();
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [downloadedFiles, setDownloadedFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseMissing, setCourseMissing] = useState(false);

  useEffect(() => {
    if (!db) return;
    let cancelled = false;

    async function load() {
      if (!db) return;
      try {
        const coursePromise = getDoc(doc(db, "courses", courseId));
        const progressPromise =
          user
            ? getDoc(doc(db, "userProgress", user.uid, "courses", courseId))
            : Promise.resolve(null);

        const [courseSnap, progressSnap] = await Promise.all([
          coursePromise,
          progressPromise,
        ]);
        if (cancelled) return;

        if (!courseSnap.exists()) {
          setCourseMissing(true);
          setAttachments([]);
        } else {
          setCourseMissing(false);
          setAttachments(parseAttachments(courseSnap.data()?.attachments));
        }

        if (progressSnap?.exists()) {
          const raw = progressSnap.data()?.downloadedFiles;
          setDownloadedFiles(Array.isArray(raw) ? raw.map(String) : []);
        } else {
          setDownloadedFiles([]);
        }
      } catch {
        if (!cancelled) setCourseMissing(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [db, user, courseId]);

  async function openAttachment(file: AttachmentFile) {
    if (file.url) {
      window.open(file.url, "_blank", "noopener,noreferrer");
    }

    if (!db || !user || !file.name) return;

    setDownloadedFiles((prev) =>
      prev.includes(file.name) ? prev : [...prev, file.name]
    );

    await setDoc(
      doc(db, "userProgress", user.uid, "courses", courseId),
      {
        courseId,
        title: courseTitle,
        courseLabel,
        ...(catalogCategory
          ? { category: storageCategory(catalogCategory) }
          : {}),
        downloadCount: increment(1),
        downloadedFiles: arrayUnion(file.name),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  if (loading) {
    return (
      <p className="py-16 text-center text-sm text-black/55">Caricamento allegati…</p>
    );
  }

  if (courseMissing) {
    return (
      <p className="py-16 text-center text-sm text-black/55">❌ Corso non trovato</p>
    );
  }

  if (!attachments.length) {
    return (
      <p className="py-16 text-center text-sm text-black/55">
        ⚠️ Nessun allegato disponibile per questo corso
      </p>
    );
  }

  return (
    <ul className="p-4">
      {attachments.map((file) => {
        const done = isDownloaded(file.name, downloadedFiles);

        return (
          <li key={`${file.url}-${file.name}`} className="my-2">
            <button
              type="button"
              onClick={() => void openAttachment(file)}
              className="flex min-h-[56px] w-full items-center gap-4 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-2 text-left transition hover:bg-black/[0.02]"
            >
              {done ? <MaterialCheckCircleIcon /> : <MaterialInsertDriveFileIcon />}
              <div className="min-w-0 flex-1">
                <p className="text-base font-normal leading-snug text-black/87">
                  {file.name}
                </p>
                {done ? (
                  <p className="mt-0.5 text-sm leading-snug text-green-600">
                    ✅ Già scaricato
                  </p>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
