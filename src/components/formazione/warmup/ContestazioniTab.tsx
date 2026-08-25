"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
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
    const ref = doc(db, "settings", "warmup_contestazioni_training");
    return onSnapshot(ref, (snap) => {
      const rawItems = snap.data()?.items;
      const map =
        rawItems && typeof rawItems === "object"
          ? (rawItems as Record<string, Record<string, unknown>>)
          : undefined;

      const resolved = resolveContestazioneItems(map);
      setItems(orderedContestazioni(resolved, context));
      setLoading(false);
    });
  }, [db, context]);

  useEffect(() => {
    if (!db || !user) return;
    const ref = doc(db, "listening_progress", user.uid);
    return onSnapshot(ref, (snap) => {
      const raw = snap.data()?.contestazioni;
      if (raw && typeof raw === "object") {
        const map: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(raw)) {
          map[k] = v === true;
        }
        setCompleted(map);
      }
    });
  }, [db, user]);

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
