"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { markMessaggioInternoLettoAction } from "@/actions/core";
import { markMessaggioAgendaLettoAction, markMessaggiPraticaLettiAction } from "@/actions/agendaMessaggi";

export function SegnaMessaggioInternoLettoButton({
  messageId,
  label = "Segna letto",
}: {
  messageId: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("messageId", messageId);
      await markMessaggioInternoLettoAction(fd);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded border border-[var(--line)] bg-white px-2 py-1 text-xs hover:bg-[#eef4f8] disabled:opacity-60"
    >
      {pending ? "…" : label}
    </button>
  );
}

export function SegnaMessaggioAgendaLettoButton({
  messageId,
  label = "Setta già letto",
}: {
  messageId: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("messageId", messageId);
      await markMessaggioAgendaLettoAction(fd);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded border border-[var(--line)] bg-white px-2 py-1 text-xs hover:bg-[#eef4f8] disabled:opacity-60"
    >
      {pending ? "…" : label}
    </button>
  );
}

export function SegnaPraticaAgendaLettoButton({
  praticaId,
  label = "Setta già letto",
}: {
  praticaId: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("praticaId", praticaId);
      await markMessaggiPraticaLettiAction(fd);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded border border-[var(--line)] bg-white px-2 py-1 text-xs hover:bg-[#eef4f8] disabled:opacity-60"
    >
      {pending ? "…" : label}
    </button>
  );
}
