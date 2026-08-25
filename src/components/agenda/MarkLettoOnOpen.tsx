"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { markMessaggioInternoLettoAction } from "@/actions/core";
import {
  markMessaggioAgendaLettoAction,
  markMessaggiPraticaLettiAction,
} from "@/actions/agendaMessaggi";

type LinkProps = Omit<ComponentProps<typeof Link>, "href" | "onClick">;

function fire(action: (fd: FormData) => Promise<void>, entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  void action(fd);
}

/** Apre la pratica e segna i messaggi agenda della pratica come letti. */
export function LinkPraticaSegnaLetto({
  praticaId,
  children,
  ...rest
}: LinkProps & { praticaId: string; children: ReactNode }) {
  return (
    <Link
      href={`/pratiche/${praticaId}`}
      onClick={() => fire(markMessaggiPraticaLettiAction, { praticaId })}
      {...rest}
    >
      {children}
    </Link>
  );
}

/** Apre la pratica e segna il messaggio interno come letto. Solo con pratica collegata. */
export function LinkMessaggioInternoSegnaLetto({
  messageId,
  praticaId,
  children,
  className,
}: {
  messageId: string;
  praticaId: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={`/pratiche/${praticaId}`}
      className={className}
      onClick={() => fire(markMessaggioInternoLettoAction, { messageId })}
    >
      {children}
    </Link>
  );
}

/** Apre la pratica e segna il messaggio agenda come letto. */
export function LinkMessaggioAgendaSegnaLetto({
  messageId,
  praticaId,
  children,
  className,
}: {
  messageId: string;
  praticaId: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={`/pratiche/${praticaId}`}
      className={className}
      onClick={() => fire(markMessaggioAgendaLettoAction, { messageId })}
    >
      {children}
    </Link>
  );
}
