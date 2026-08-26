"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useFormazione } from "@/components/formazione/FormazioneProvider";
import { categoryColor } from "@/lib/formazione/warmupDefaults";
import {
  orderedContestazioni,
  resolveContestazioneItems,
  type ContestazioneTrainingItem,
} from "@/lib/formazione/contestazioniDefaults";
import { ContestationTrainingModal } from "@/components/formazione/warmup/ContestationTrainingModal";
import { PhaseCard } from "@/components/formazione/warmup/WarmupUi";

export function ContestazioniTab({ isRecupero = false }: { isRecupero?: boolean }) {
  const { db, user } = useFormazione();
  const [items, setItems] = useState<ContestazioneTrainingItem[]>([]);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<ContestazioneTrainingItem | null>(null);
  const context = isRecupero ? "recupero" : "sollecito";

  useEffect(() => {
    if (!db) return;
    let cancelled = false;

    async function load() {
      if (!db) return;
      try {
        const settingsPromise = getDoc(
          doc(db, "settings", "warmup_contestazioni_training")
        );
        const progressPromise = user
          ? getDoc(doc(db, "listening_progress", user.uid))
          : Promise.resolve(null);

        const [settingsSnap, progressSnap] = await Promise.all([
          settingsPromise,
          progressPromise,
        ]);
        if (cancelled) return;

        const rawItems = settingsSnap.data()?.items;
        const map =
          rawItems && typeof rawItems === "object"
            ? (rawItems as Record<string, Record<string, unknown>>)
            : undefined;
        setItems(orderedContestazioni(resolveContestazioneItems(map), context));

        const raw = progressSnap?.data()?.contestazioni;
        if (raw && typeof raw === "object") {
          const done: Record<string, boolean> = {};
          for (const [k, v] of Object.entries(raw)) {
            done[k] = v === true;
          }
          setCompleted(done);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [db, user, context]);

  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-[var(--muted)]">Caricamento…</p>
    );
  }

  if (!items.length) {
    return (
      <p className="py-12 text-center text-sm text-[var(--muted)]">
        Nessuna contestazione configurata per {context}.
      </p>
    );
  }

  return (
    <div className="w-full space-y-4 py-2">
      {items.map((item, index) => {
        const enabled = index === 0 || completed[items[index - 1]!.id] === true;
        return (
          <PhaseCard
            key={item.id}
            title={item.title}
            subtitle={item.subtitle || item.declared}
            color={categoryColor(item.category)}
            completed={completed[item.id] === true}
            enabled={enabled}
            onClick={() => setActiveItem(item)}
          />
        );
      })}

      {activeItem ? (
        <ContestationTrainingModal
          item={activeItem}
          onClose={() => setActiveItem(null)}
          onComplete={() => {
            setCompleted((prev) => ({ ...prev, [activeItem.id]: true }));
          }}
        />
      ) : null}
    </div>
  );
}
