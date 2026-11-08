"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PhoneIncoming } from "lucide-react";
import { mostraDemoInboundScreenPop, notificaChiamataEntrante } from "@/lib/inboundCallScreenPop";

/** Solo sviluppo: anteprima rapida del popup su qualsiasi pagina loggata. */
export function InboundCallScreenPopDevFab() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (process.env.NODE_ENV === "production" || !mounted) return null;

  const fab = (
    <div
      className="fixed bottom-24 right-4 z-[199] flex flex-col gap-1.5 print:hidden"
      aria-label="Strumenti demo chiamata in entrata"
    >
      <button
        type="button"
        onClick={() => mostraDemoInboundScreenPop("3321000274")}
        className="flex items-center gap-1.5 rounded-full border-2 border-[var(--navy)] bg-white px-3 py-2 text-[11px] font-bold text-[var(--navy)] shadow-lg hover:bg-[#eef4f8]"
      >
        <PhoneIncoming className="h-4 w-4" aria-hidden />
        Demo popup inbound
      </button>
      <button
        type="button"
        onClick={() => notificaChiamataEntrante("3321000274")}
        className="rounded-full bg-[var(--navy)] px-3 py-1.5 text-[10px] font-semibold text-white shadow hover:bg-[#1a365d]"
      >
        Lookup 3321000274
      </button>
    </div>
  );

  return createPortal(fab, document.body);
}
