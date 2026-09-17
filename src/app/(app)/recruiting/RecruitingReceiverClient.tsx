"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import {
  eliminaReceiverConfigAction,
  salvaReceiverConfigAction,
  verificaReceiverConfigAction,
} from "@/actions/recruiting";
import {
  STATO_RECEIVER_CONFIG_LABELS,
  type StatoReceiverConfig,
} from "@/lib/recruiting/receiver";

type ReceiverRow = {
  baseUrl: string;
  status: StatoReceiverConfig;
  sourceName: string;
};

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";
const labelCls = "text-[10px] font-semibold uppercase text-[var(--muted)]";

const STATUS_COLORS: Record<StatoReceiverConfig, string> = {
  DISCONNECTED: "bg-slate-100 text-slate-700",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  ERROR: "bg-rose-100 text-rose-800",
};

export function RecruitingReceiverClient({
  config,
  canManage,
}: {
  config: ReceiverRow | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<void>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        onOk?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Operazione non riuscita");
      }
    });
  }

  const status: StatoReceiverConfig = config?.status ?? "DISCONNECTED";

  return (
    <section className="rounded-lg border border-dashed border-[var(--line)] bg-slate-50/80 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Configurazione ricevitore
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            URL HTTPS del ricevitore aziendale. Nessun CV o dato candidato.
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[status]}`}
        >
          {STATO_RECEIVER_CONFIG_LABELS[status]}
        </span>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <dl className="mt-3 grid gap-2 text-sm">
        <div>
          <dt className={labelCls}>URL configurato</dt>
          <dd className="mt-0.5 break-all text-[var(--navy)]">
            {config?.baseUrl || "—"}
          </dd>
        </div>
        {config?.sourceName ? (
          <div>
            <dt className={labelCls}>Etichetta</dt>
            <dd className="mt-0.5 text-[var(--navy)]">{config.sourceName}</dd>
          </div>
        ) : null}
      </dl>

      {canManage ? (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {config ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => verificaReceiverConfigAction())}
                className="h-8 rounded-lg border border-[var(--line)] px-3 text-xs"
              >
                Verifica connessione
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Rimuovere la configurazione del ricevitore?")) return;
                  run(() => eliminaReceiverConfigAction());
                }}
                className="h-8 rounded-lg border border-rose-200 px-3 text-xs text-rose-700"
              >
                Disconnetti
              </button>
            </>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
            className="h-8 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold disabled:opacity-50"
          >
            {config ? "Modifica" : "Configura"}
          </button>
        </div>
      ) : null}

      <Modal
        open={open}
        title="Ricevitore aziendale"
        onClose={() => !pending && setOpen(false)}
      >
        <form
          className="grid gap-3 p-4 text-sm"
          action={(fd) =>
            run(
              () => salvaReceiverConfigAction(fd),
              () => setOpen(false)
            )
          }
        >
          <label>
            <span className={labelCls}>URL HTTPS *</span>
            <input
              name="baseUrl"
              type="url"
              required
              maxLength={500}
              defaultValue={config?.baseUrl || ""}
              placeholder="https://recruiting.azienda.example/receiver"
              className={inputCls}
            />
          </label>
          <label>
            <span className={labelCls}>Etichetta (opzionale)</span>
            <input
              name="sourceName"
              maxLength={80}
              defaultValue={config?.sourceName || ""}
              placeholder="es. receiver-prod"
              className={inputCls}
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => setOpen(false)}
              className="h-9 rounded-lg border border-[var(--line)] px-3 text-sm"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-9 rounded-lg bg-[var(--navy)] px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Salvataggio…" : "Salva"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
