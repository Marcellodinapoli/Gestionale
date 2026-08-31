import { usersDbFromUser } from "@/lib/usersRepo";
import { prisma } from "@/lib/prisma";
import { registrazioniDbFromUser } from "@/lib/registrazioniRepo";
import { requirePermission } from "@/lib/guard";
import { dataOraIt } from "@/lib/domain";
import { getGruppoLavoro } from "@/lib/gruppoLavoro";
import { registrazioniWhere } from "@/lib/registrazioniScope";
import { esitoContattoLabel } from "@/lib/contatto";
import { isManutenzione } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import { PlayerRegistrazione } from "@/components/report/PlayerRegistrazione";
import {
  direzioneChiamataLabel,
  formatDurata,
} from "@/lib/registrazioneAudio";
import Link from "next/link";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ operatore?: string; q?: string; da?: string; a?: string }>;
}) {
  const user = await requirePermission("report:view");
  const { operatore, q, da, a } = await searchParams;
  const query = (q || "").trim();

  const isSupervisor = user.role === "SUPERVISOR";
  const gruppo = isSupervisor ? await getGruppoLavoro(user) : null;
  const memberIds = gruppo?.memberIds ?? [];
  const memberIdSet = new Set(memberIds);

  const allOperatori = isManutenzione(user)
    ? []
    : await usersDbFromUser(user).findMany({
        where: {
          tenantId: user.tenantId,
          role: { in: ["OPERATOR", "SUPERVISOR"] },
          active: true,
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });

  const operatoriGruppo = isSupervisor
    ? allOperatori.filter((o) => memberIdSet.has(o.id))
    : allOperatori;
  const operatoriAltri = isSupervisor
    ? allOperatori.filter((o) => !memberIdSet.has(o.id))
    : [];

  const externalOperatore = Boolean(
    operatore && isSupervisor && !memberIdSet.has(operatore)
  );

  const oggi = new Date().toISOString().slice(0, 10);
  const effDa = da ?? (isSupervisor && !operatore && !q ? oggi : undefined);
  const effA = a ?? (isSupervisor && !operatore && !q ? oggi : undefined);

  const where = await registrazioniWhere(user, {
    operatore,
    q: query,
    da: effDa,
    a: effA,
    memberIds,
    externalOperatore,
  });

  const rows = await registrazioniDbFromUser(user).findMany({
    where,
    include: {
      operatore: { select: { id: true, name: true } },
      pratica: {
        select: {
          id: true,
          numero: true,
          debitore: { select: { nome: true, cognome: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="h-full min-h-0 space-y-4 overflow-y-auto pb-4">
      <PageHeader
        title="Registrazioni"
        subtitle={
          user.role === "BACK_OFFICE"
            ? "Registrazioni evidenziate dagli operatori per il back office"
            : isSupervisor
              ? "Ascolta le telefonate del tuo gruppo o cerca un altro operatore"
              : "Ascolta le telefonate registrate dagli operatori"
        }
      />

      <Card>
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[var(--muted)]">Cerca</span>
            <input
              name="q"
              defaultValue={query}
              placeholder="Pratica, debitore, operatore"
              className="h-9 w-52 rounded-lg border border-[var(--line)] px-2 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[var(--muted)]">Operatore</span>
            <select
              name="operatore"
              defaultValue={operatore || ""}
              className="h-9 min-w-[160px] rounded-lg border border-[var(--line)] px-2 text-sm"
            >
              <option value="">
                {user.role === "BACK_OFFICE"
                  ? "Tutti i segnalati"
                  : isSupervisor
                    ? "Tutto il gruppo"
                    : "Tutti"}
              </option>
              {isSupervisor ? (
                <>
                  {operatoriGruppo.length ? (
                    <optgroup label="Il mio gruppo">
                      {operatoriGruppo.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {operatoriAltri.length ? (
                    <optgroup label="Altri operatori">
                      {operatoriAltri.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </>
              ) : (
                allOperatori.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[var(--muted)]">Dal</span>
            <input
              type="date"
              name="da"
              defaultValue={da ?? (isSupervisor ? oggi : "")}
              className="h-9 rounded-lg border border-[var(--line)] px-2 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[var(--muted)]">Al</span>
            <input
              type="date"
              name="a"
              defaultValue={a ?? (isSupervisor ? oggi : "")}
              className="h-9 rounded-lg border border-[var(--line)] px-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="h-9 rounded-lg bg-[var(--navy)] px-3 text-sm text-white"
          >
            Filtra
          </button>
        </form>
      </Card>

      <Card title={`${rows.length} telefonat${rows.length === 1 ? "a" : "e"}`}>
        {!rows.length ? (
          <p className="text-sm text-[var(--muted)]">Nessuna registrazione da ascoltare.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="text-left text-[var(--muted)]">
                <tr>
                  <th className="py-2">Data</th>
                  <th>Operatore</th>
                  <th>Pratica</th>
                  <th>Debitore</th>
                  <th>Numero</th>
                  <th>Dir.</th>
                  <th>Esito</th>
                  <th>Durata</th>
                  <th>Stato</th>
                  <th>Ascolta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--line)]">
                    <td className="py-2 whitespace-nowrap">{dataOraIt(r.createdAt)}</td>
                    <td>{r.operatore.name}</td>
                    <td>
                      <Link
                        className="text-[var(--accent)] underline"
                        href={`/pratiche/${r.pratica.id}`}
                      >
                        {r.pratica.numero}
                      </Link>
                    </td>
                    <td>
                      {r.pratica.debitore.cognome} {r.pratica.debitore.nome}
                    </td>
                    <td className="font-mono text-xs">{r.numero}</td>
                    <td>{direzioneChiamataLabel(r.direzione)}</td>
                    <td>{esitoContattoLabel(r.esito)}</td>
                    <td>{formatDurata(r.durataSec)}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1">
                        {r.evidenzaBackOffice ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            BK OFF
                          </span>
                        ) : null}
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                          {r.stato === "CONFERMATA_CONTINUA"
                            ? "Confermata continua"
                            : r.stato === "CONFERMATA_MANUALE"
                              ? "Confermata manuale"
                              : r.stato}
                        </span>
                      </div>
                    </td>
                    <td className="py-2">
                      {r.fileName ? (
                        <PlayerRegistrazione src={`/api/registrazioni/${r.id}`} />
                      ) : (
                        <span className="text-xs text-[var(--muted)]">
                          In attesa file audio
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
