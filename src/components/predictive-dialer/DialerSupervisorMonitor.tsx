"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { DialerVelocitaPanel } from "@/components/predictive-dialer/DialerVelocitaPanel";
import {
  DIALER_CAMPAGNA_LABELS,
  DIALER_SESSIONE_LABELS,
} from "@/lib/predictive-dialer/constants";
import type { DialerCampagnaStatsDto, DialerMonitorOperatoreDto } from "@/lib/predictive-dialer/types";

type CampagnaRow = {
  id: string;
  nome: string;
  stato: string;
  operatoriCount: number;
  praticheCount: number;
};

type StreamPayload = {
  campagne: CampagnaRow[];
  monitor: DialerMonitorOperatoreDto[];
  stats: DialerCampagnaStatsDto | null;
  campagnaId: string | null;
};

function formatDurata(sec: number) {
  if (sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function pct(touched: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((touched / total) * 100));
}

function ProgressRow({
  label,
  touched,
  total,
  touchedLabel,
  remainingLabel,
}: {
  label: string;
  touched: number;
  total: number;
  touchedLabel: string;
  remainingLabel: string;
}) {
  const remaining = Math.max(0, total - touched);
  const percent = pct(touched, total);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-[var(--navy)]">{label}</span>
        <span className="tabular-nums text-[var(--muted)]">
          {touched} / {total} {touchedLabel}
          {remaining > 0 ? ` · ${remaining} ${remainingLabel}` : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
        <div
          className="h-full rounded-full bg-[var(--navy)] transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function KpiChip({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
        accent ?? "border-[var(--line)] bg-[var(--surface)] text-[var(--navy)]"
      }`}
    >
      <span className="font-bold tabular-nums">{value}</span>
      <span className="text-[var(--muted)]">{label}</span>
    </span>
  );
}

function MonitorTable({
  headers,
  children,
  minWidth = 640,
}: {
  headers: React.ReactNode;
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
      <table className={`w-full min-w-[${minWidth}px] text-sm`} style={{ minWidth }}>
        <thead className="bg-[var(--surface)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
          {headers}
        </thead>
        <tbody className="divide-y divide-[var(--line)]">{children}</tbody>
      </table>
    </div>
  );
}

export function DialerSupervisorMonitor({
  campagnaId,
  initialStats = null,
  initialMonitor = [],
  showCampagnaHeader = false,
}: {
  campagnaId?: string;
  initialStats?: DialerCampagnaStatsDto | null;
  initialMonitor?: DialerMonitorOperatoreDto[];
  showCampagnaHeader?: boolean;
}) {
  const [data, setData] = useState<StreamPayload>({
    campagne: [],
    monitor: initialMonitor,
    stats: initialStats,
    campagnaId: campagnaId ?? null,
  });

  useEffect(() => {
    const url = campagnaId
      ? `/api/predictive-dialer/stream?campagnaId=${encodeURIComponent(campagnaId)}`
      : "/api/predictive-dialer/stream";
    const es = new EventSource(url);
    es.addEventListener("dialer", (ev) => {
      try {
        setData(JSON.parse((ev as MessageEvent).data) as StreamPayload);
      } catch {
        /* ignore */
      }
    });
    return () => es.close();
  }, [campagnaId]);

  const stats = data.stats;
  const activeId = campagnaId ?? data.campagnaId;
  const campagnaAttiva = activeId ? data.campagne.find((c) => c.id === activeId) : null;

  return (
    <div className="space-y-5">
      {showCampagnaHeader && activeId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Campagna monitorata
            </p>
            <p className="text-lg font-bold text-[var(--navy)]">
              {campagnaAttiva?.nome ?? "Campagna attiva"}
            </p>
            {campagnaAttiva ? (
              <p className="text-xs text-[var(--muted)]">
                {DIALER_CAMPAGNA_LABELS[campagnaAttiva.stato as keyof typeof DIALER_CAMPAGNA_LABELS] ??
                  campagnaAttiva.stato}
                {" · "}
                {campagnaAttiva.operatoriCount} operatori · {campagnaAttiva.praticheCount} pratiche
              </p>
            ) : null}
          </div>
          <Link
            href={`/predictive-dialer/campagne/${activeId}`}
            className="text-sm font-semibold text-[var(--navy)] underline"
          >
            Apri dettaglio campagna
          </Link>
        </div>
      ) : null}

      {!stats ? (
        <Card title="Monitor">
          <p className="text-sm text-[var(--muted)]">
            Nessuna campagna attiva da monitorare. Attiva una campagna dalla sezione Campagne.
          </p>
        </Card>
      ) : (
        <>
          <Card title="Avanzamento campagna">
            <div className="space-y-4">
              <ProgressRow
                label="Clienti (pratiche)"
                touched={stats.clientiToccati}
                total={stats.clientiTotali}
                touchedLabel="toccati"
                remainingLabel="da contattare"
              />
              <ProgressRow
                label="Numeri telefonici"
                touched={stats.numeriToccati}
                total={stats.numeriTotali}
                touchedLabel="chiamati"
                remainingLabel="rimanenti"
              />
              <div className="grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-4">
                {[
                  { label: "Risposte", value: stats.chiamateRisposta },
                  { label: "Non risposte", value: stats.chiamateNoRisposta },
                  { label: "Occupati", value: stats.chiamateOccupato },
                  { label: "Errori", value: stats.chiamateErrore },
                ].map((k) => (
                  <div key={k.label} className="text-center sm:text-left">
                    <p className="text-2xl font-bold tabular-nums text-[var(--navy)]">{k.value}</p>
                    <p className="text-xs text-[var(--muted)]">{k.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {activeId ? (
            <DialerVelocitaPanel campagnaId={activeId} stats={stats} compact />
          ) : null}

          <Card title="Operatori">
            <div className="mb-4 flex flex-wrap gap-2">
              <KpiChip label="disponibili" value={stats.operatoriDisponibili} accent="border-emerald-200 bg-emerald-50" />
              <KpiChip label="connecting" value={stats.operatoriConnecting} accent="border-sky-200 bg-sky-50" />
              <KpiChip label="in chiamata" value={stats.operatoriInChiamata} accent="border-blue-200 bg-blue-50" />
              <KpiChip label="post-call" value={stats.operatoriPostCall} accent="border-amber-200 bg-amber-50" />
              <KpiChip label="in pausa" value={stats.operatoriInPausa} />
              <KpiChip label="fuori" value={stats.operatoriFuori} />
            </div>

            {!data.monitor.length ? (
              <p className="text-sm text-[var(--muted)]">
                Nessun operatore ha ancora accettato la campagna.
              </p>
            ) : (
              <MonitorTable
                minWidth={720}
                headers={
                  <tr>
                    <th className="px-3 py-2.5">Operatore</th>
                    <th className="px-3 py-2.5">Stato</th>
                    <th className="px-3 py-2.5 text-right">Pratiche parlate</th>
                    <th className="px-3 py-2.5 text-right">Chiamate</th>
                    <th className="px-3 py-2.5 text-right">Tempo medio</th>
                    <th className="px-3 py-2.5 text-right">Tempo totale</th>
                    <th className="px-3 py-2.5 text-right">Pausa</th>
                    <th className="px-3 py-2.5">Pratica</th>
                  </tr>
                }
              >
                {data.monitor.map((op) => (
                  <tr key={op.operatoreId} className="hover:bg-[var(--surface)]">
                    <td className="px-3 py-2.5 font-medium">{op.operatoreNome}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold">
                        {DIALER_SESSIONE_LABELS[op.sessioneStato] ?? op.sessioneStato}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[var(--navy)]">
                      {op.praticheParlate}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{op.chiamateCount}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatDurata(op.durataMediaSec)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatDurata(op.durataTotaleSec)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {op.pausaDurataSec > 0 ? formatDurata(op.pausaDurataSec) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {op.praticaCorrenteId ? (
                        <Link href={`/pratiche/${op.praticaCorrenteId}`} className="text-sm underline">
                          Apri
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </MonitorTable>
            )}
          </Card>

          {stats.perCodiceScarico.length ? (
            <Card title="Codici scarico">
              <MonitorTable
                minWidth={520}
                headers={
                  <tr>
                    <th className="px-3 py-2.5">Codice</th>
                    <th className="px-3 py-2.5 text-right">In campagna</th>
                    <th className="px-3 py-2.5 text-right">Toccati</th>
                    <th className="px-3 py-2.5 text-right">Lavorati</th>
                    <th className="px-3 py-2.5 text-right">Rimanenti</th>
                    <th className="px-3 py-2.5 text-right">Chiamate</th>
                  </tr>
                }
              >
                {stats.perCodiceScarico.map((r) => (
                  <tr key={r.codice} className="hover:bg-[var(--surface)]">
                    <td className="px-3 py-2.5 font-mono font-semibold">{r.codice}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.praticheTotali}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.praticheToccati}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.praticheLavorate}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.praticheRimanenti}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.chiamateTotali}</td>
                  </tr>
                ))}
              </MonitorTable>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

export function DialerCampagneList({ campagne }: { campagne: CampagnaRow[] }) {
  if (!campagne.length) {
    return <p className="text-sm text-[var(--muted)]">Nessuna campagna creata.</p>;
  }
  return (
    <ul className="divide-y divide-[var(--line)]">
      {campagne.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div>
            <Link href={`/predictive-dialer/campagne/${c.id}`} className="font-semibold underline">
              {c.nome}
            </Link>
            <p className="text-xs text-[var(--muted)]">
              {DIALER_CAMPAGNA_LABELS[c.stato as keyof typeof DIALER_CAMPAGNA_LABELS] ?? c.stato}
              {" · "}
              {c.operatoriCount} operatori · {c.praticheCount} pratiche
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
