"use client";

import { useState } from "react";
import { FormazioneUnderlineTabs } from "@/components/formazione/warmup/WarmupUi";
import { TelefonataTab } from "@/components/formazione/warmup/TelefonataTab";
import { ContestazioniTab } from "@/components/formazione/warmup/ContestazioniTab";

type WarmUpTab = "telefonata" | "sollecito" | "recupero";

export function WarmUpPage() {
  const [tab, setTab] = useState<WarmUpTab>("telefonata");

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm sm:p-6">
      <FormazioneUnderlineTabs
        active={tab}
        onChange={setTab}
        equalWidth
        tabs={[
          { id: "telefonata", label: "Telefonata" },
          { id: "sollecito", label: "Contestazioni nel sollecito" },
          { id: "recupero", label: "Contestazioni nel recupero" },
        ]}
      />
      <div className="mt-4">
        {tab === "telefonata" ? <TelefonataTab /> : null}
        {tab === "sollecito" ? <ContestazioniTab /> : null}
        {tab === "recupero" ? <ContestazioniTab isRecupero /> : null}
      </div>
    </div>
  );
}
