"use client";

import { useState } from "react";
import Link from "next/link";
import { LavorateDataPicker } from "@/components/home/LavorateDataPicker";
import { Modal } from "@/components/Modal";
import type { OperatoreLavorateGiorno, PraticaCambioCodiceGiorno } from "@/lib/lavorateOggi";

const base =
  "flex h-full flex-col rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 shadow-sm border-l-[3px] border-l-[var(--accent)]";

const countClass = "shrink-0 tabular-nums text-lg font-bold text-[var(--navy)]";

type TipologiaCambio = {
  key: string;
  da: string;
  a: string;
  count: number;
  pratiche: PraticaCambioCodiceGiorno[];
};

function raggruppaPerTipologia(items: PraticaCambioCodiceGiorno[]): TipologiaCambio[] {
  const map = new Map<string, TipologiaCambio>();
  for (const p of items) {
    const key = `${p.da}\0${p.a}`;
    const row = map.get(key);
    if (row) {
      row.count += 1;
      row.pratiche.push(p);
    } else {
      map.set(key, { key, da: p.da, a: p.a, count: 1, pratiche: [p] });
    }
  }
  return [...map.values()].sort(
    (x, y) => y.count - x.count || x.da.localeCompare(y.da, "it") || x.a.localeCompare(y.a, "it")
  );
}

function CodCountButton({
  count,
  onClick,
  compact = false,
}: {
  count: number;
  onClick: () => void;
  compact?: boolean;
}) {
  const cls = compact
    ? `${countClass} w-8 text-center text-base`
    : countClass;

  if (count <= 0) {
    return <span className={cls}>0</span>;
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={`${cls} cursor-pointer underline decoration-[var(--accent)]/40 underline-offset-2 hover:cursor-pointer hover:text-[var(--accent)]`}
      title="Apri tipologie di cambio codice"
    >
      {count}
    </button>
  );
}

function CambiCodiceModal({
  open,
  title,
  pratiche,
  onClose,
}: {
  open: boolean;
  title: string;
  pratiche: PraticaCambioCodiceGiorno[];
  onClose: () => void;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const tipologie = raggruppaPerTipologia(pratiche);
  const totale = pratiche.length;

  function close() {
    setExpandedKey(null);
    onClose();
  }

  function toggleTipologia(key: string) {
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  return (
    <Modal open={open} title={title} onClose={close}>
      <div className="space-y-3 p-4">
        <p className="text-sm text-[var(--muted)]">
          {totale === 0
            ? "Nessun cambio codice nel giorno selezionato."
            : `${totale} pratich${totale === 1 ? "a" : "e"} · ${tipologie.length} tipolog${tipologie.length === 1 ? "ia" : "ie"} di cambio. Clicca sul numero per vedere le pratiche.`}
        </p>
        {tipologie.length ? (
          <ul className="space-y-2">
            {tipologie.map((t) => {
              const expanded = expandedKey === t.key;
              return (
                <li
                  key={t.key}
                  className="rounded-lg border border-[var(--line)] bg-[#f8fafc] px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-0.5 text-sm ring-1 ring-[var(--line)]">
                      <span className="text-[var(--muted)]">{t.da}</span>
                      <span className="text-[10px] font-semibold text-[var(--accent)]" aria-hidden>
                        →
                      </span>
                      <span className="font-semibold text-[var(--navy)]">{t.a}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleTipologia(t.key)}
                      className="cursor-pointer tabular-nums text-sm font-bold text-[var(--navy)] underline decoration-[var(--accent)]/40 underline-offset-2 hover:cursor-pointer hover:text-[var(--accent)]"
                      title={
                        expanded
                          ? "Nascondi pratiche"
                          : `Mostra ${t.count} pratich${t.count === 1 ? "a" : "e"}`
                      }
                    >
                      {t.count}
                    </button>
                  </div>
                  {expanded ? (
                    <ul className="mt-1.5 space-y-0.5 pl-0.5 text-xs text-[var(--muted)]">
                      {t.pratiche.map((p) => (
                        <li key={p.praticaId}>
                          <Link
                            href={`/pratiche/${p.praticaId}`}
                            className="text-[var(--accent)] underline hover:opacity-80"
                            onClick={close}
                          >
                            {p.numero}
                          </Link>
                          <span className="ml-1.5">{p.debitore}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="flex justify-end border-t border-[var(--line)] pt-3">
          <button
            type="button"
            onClick={close}
            className="h-9 rounded-lg border border-[var(--line)] bg-white px-4 text-sm hover:bg-[#eef4f8]"
          >
            Chiudi
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function LavorateGiornoKpi({
  title,
  hint,
  href,
  dataIso,
  operatori,
  praticheCambioCodice,
  vistaGruppo = false,
  totaleLavorateGruppo,
}: {
  title: string;
  hint: string;
  href: string;
  dataIso: string;
  operatori: OperatoreLavorateGiorno[];
  praticheCambioCodice: PraticaCambioCodiceGiorno[];
  vistaGruppo?: boolean;
  totaleLavorateGruppo?: number;
}) {
  const [popup, setPopup] = useState<{ title: string; userId: string | null } | null>(null);
  const totaleLavorate =
    totaleLavorateGruppo ?? operatori.reduce((sum, op) => sum + op.count, 0);
  const totaleCambi = operatori.reduce((sum, op) => sum + op.cambiCodice, 0);

  function apriCambi(userId: string | null, operatoreName?: string) {
    setPopup({
      userId,
      title: operatoreName ? `Codice cambiato · ${operatoreName}` : "Codice cambiato · gruppo",
    });
  }

  const pratichePopup = popup
    ? popup.userId
      ? praticheCambioCodice.filter((p) => p.userId === popup.userId)
      : praticheCambioCodice
    : [];

  return (
    <div className={base}>
      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        <Link href={href} className="hover:opacity-90">
          {title}
        </Link>
      </p>
      <div className="mt-2 space-y-2">
        <div>
          {operatori.length ? (
            <ul className="space-y-1">
              {vistaGruppo ? (
                <li className="flex items-baseline justify-end gap-3 pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  <span className="w-8 text-center" title="Pratiche lavorate">
                    Lav.
                  </span>
                  <span className="w-8 text-center" title="Codice cambiato">
                    Cod.
                  </span>
                </li>
              ) : null}
              {operatori.map((op) => (
                <li
                  key={op.userId}
                  className={
                    vistaGruppo
                      ? "flex items-baseline justify-between gap-2 text-sm leading-tight"
                      : "flex flex-wrap items-baseline gap-x-1.5 text-sm leading-tight"
                  }
                >
                  <Link href={href} className="min-w-0 flex-1 truncate hover:opacity-90">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Operatore:
                    </span>{" "}
                    <span className="font-medium text-[var(--navy)]">{op.sigla}</span>{" "}
                    <span className="font-bold text-[var(--navy)]">{op.name}</span>
                  </Link>
                  {vistaGruppo ? (
                    <span className="flex shrink-0 items-baseline gap-3">
                      <Link
                        href={href}
                        className={`${countClass} w-8 text-center text-base hover:opacity-90`}
                      >
                        {op.count}
                      </Link>
                      <CodCountButton
                        compact
                        count={op.cambiCodice}
                        onClick={() => apriCambi(op.userId, op.name)}
                      />
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-tight text-[var(--muted)]">
              <span className="text-[10px] font-semibold uppercase tracking-wide">Operatore:</span>
              <span className="ml-1.5">—</span>
            </p>
          )}
        </div>
        {!vistaGruppo ? (
          <div>
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm leading-tight">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Pratiche lavorate oggi:
              </span>
              <Link href={href} className={`${countClass} hover:opacity-90`}>
                {totaleLavorate}
              </Link>
            </p>
          </div>
        ) : (
          <div className="border-t border-[var(--line)] pt-2">
            <p className="flex items-baseline justify-between gap-x-1.5 text-sm leading-tight">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Totale gruppo
              </span>
              <span className="flex shrink-0 items-baseline gap-3">
                <Link
                  href={href}
                  className={`${countClass} w-8 text-center hover:opacity-90`}
                >
                  {totaleLavorate}
                </Link>
                <CodCountButton compact count={totaleCambi} onClick={() => apriCambi(null)} />
              </span>
            </p>
          </div>
        )}
      </div>

      {!vistaGruppo ? (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-sm leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Codice cambiato:
          </span>
          <CodCountButton
            count={totaleCambi}
            onClick={() =>
              apriCambi(operatori[0]?.userId ?? null, operatori[0]?.name)
            }
          />
        </div>
      ) : null}

      <CambiCodiceModal
        key={popup ? `${popup.userId ?? "gruppo"}-${popup.title}` : "closed"}
        open={popup !== null}
        title={popup?.title ?? "Codice cambiato"}
        pratiche={pratichePopup}
        onClose={() => setPopup(null)}
      />

      <p className="mt-2 truncate text-[11px] text-[var(--muted)]">{hint}</p>
      <LavorateDataPicker value={dataIso} home />
    </div>
  );
}
