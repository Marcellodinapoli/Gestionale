"use client";

import { CheckCircle2, Circle, Lock } from "lucide-react";
import type { ReactNode } from "react";

export function PhaseCard({
  title,
  subtitle,
  color,
  completed,
  enabled,
  onClick,
  trailing,
}: {
  title: string;
  subtitle: string;
  color: string;
  completed: boolean;
  enabled: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  const effectiveColor = enabled ? color : "#9CA3AF";

  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={enabled ? onClick : undefined}
      className={`w-full rounded-2xl border text-left shadow-sm transition ${
        enabled
          ? "border-[var(--line)] bg-white hover:shadow-md"
          : "cursor-not-allowed border-transparent bg-[#F3F4F6] shadow-none"
      }`}
    >
      <div className="flex items-stretch gap-4 p-5">
        <div
          className="w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: effectiveColor, minHeight: 60 }}
        />
        <div className="min-w-0 flex-1">
          <h3
            className="text-lg font-extrabold"
            style={{ color: effectiveColor }}
          >
            {title}
          </h3>
          <p
            className={`mt-2 text-sm leading-relaxed ${
              enabled ? "text-black/55" : "text-black/25"
            }`}
          >
            {subtitle}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-center">
          {trailing}
          {completed ? (
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          ) : enabled ? (
            <Circle className="h-7 w-7 text-black/25" />
          ) : (
            <Lock className="h-7 w-7 text-black/25" />
          )}
        </div>
      </div>
    </button>
  );
}

export function FormazioneUnderlineTabs<T extends string>({
  tabs,
  active,
  onChange,
  centered = false,
  equalWidth = false,
  accent = "orange",
}: {
  tabs: Array<{ id: T; label: string }>;
  active: T;
  onChange: (id: T) => void;
  centered?: boolean;
  /** Due tab a larghezza piena, come TabAlignment.fill in CreditForm */
  equalWidth?: boolean;
  /** Colore sottolineatura tab attiva */
  accent?: "orange" | "blue";
}) {
  const activeBorder =
    accent === "blue" ? "border-[#1565C0]" : "border-[#FFA726]";

  return (
    <div className="border-b border-[var(--line)]">
      <div
        className={`flex w-full flex-wrap ${
          equalWidth
            ? ""
            : centered
              ? "justify-center gap-6"
              : "justify-start gap-6"
        }`}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`-mb-px border-b-[3px] pb-3 text-sm transition ${
                equalWidth ? "flex-1 text-center" : ""
              } ${
                isActive
                  ? `${activeBorder} font-semibold text-black/87`
                  : "border-transparent font-normal text-black/55 hover:text-black/87"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TrainingMaterialTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: T; label: string }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="border-b border-[#E2E8F0]">
      <div className="flex w-full">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`-mb-px flex-1 border-b-2 py-3 text-sm transition ${
                isActive
                  ? "border-[#1565C0] font-semibold text-black/87"
                  : "border-transparent font-normal text-black/55 hover:text-black/87"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SollecitoRecuperoTabs({
  active,
  onChange,
}: {
  active: "sollecito" | "recupero";
  onChange: (value: "sollecito" | "recupero") => void;
}) {
  return (
    <FormazioneUnderlineTabs
      active={active}
      onChange={onChange}
      equalWidth
      tabs={[
        { id: "sollecito", label: "Sollecito" },
        { id: "recupero", label: "Recupero" },
      ]}
    />
  );
}
