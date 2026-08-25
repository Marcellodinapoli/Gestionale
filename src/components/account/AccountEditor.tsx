"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Phone } from "lucide-react";
import { updateAccountTelefoniaAction } from "@/actions/account";
import { CambioPasswordForm } from "@/components/account/CambioPasswordForm";
import { FormazioneAccountMenu } from "@/components/formazione/FormazioneAccountMenu";
import { StrumentiAccountMenu } from "@/components/strumenti/StrumentiAccountMenu";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

const inputCls =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm shadow-sm transition focus:border-[#1a4f7a] focus:outline-none focus:ring-2 focus:ring-[#1a4f7a]/15";

function iniziali(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Sezione({
  icon: Icon,
  titolo,
  sottotitolo,
  children,
  accent = "navy",
}: {
  icon: typeof Phone;
  titolo: string;
  sottotitolo?: string;
  children: ReactNode;
  accent?: "navy" | "amber";
}) {
  const iconBg = accent === "amber" ? "bg-amber-100 text-amber-800" : "bg-[#e8eef4] text-[#1a4f7a]";
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-[var(--line)] bg-[#fafbfc] px-4 py-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-[var(--navy)]">{titolo}</h2>
          {sottotitolo ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">{sottotitolo}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">{children}</div>
    </section>
  );
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[#fafbfc] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-[var(--navy)]">{value}</p>
    </div>
  );
}

export function AccountEditor({
  user,
  showFormazione,
  showStrumenti = true,
}: {
  user: {
    name: string;
    email: string;
    role: Role;
    interno: string;
    prefissoChiamata: string;
    postazioneNome: string | null;
    postazioneInterno: string | null;
    giorniAllaScadenza: number;
  };
  showFormazione?: boolean;
  showStrumenti?: boolean;
}) {
  const router = useRouter();
  const [telefoniaMsg, setTelefoniaMsg] = useState<string | null>(null);
  const [telefoniaErr, setTelefoniaErr] = useState<string | null>(null);
  const [telefoniaPending, startTelefonia] = useTransition();

  const passwordUrgente = user.giorniAllaScadenza <= 7;
  const passwordPct = Math.min(100, Math.round((user.giorniAllaScadenza / 30) * 100));
  const canMonitorFormazione = user.role === "SUPERVISOR" || user.role === "ADMIN";

  function salvaTelefonia(formData: FormData) {
    setTelefoniaMsg(null);
    setTelefoniaErr(null);
    startTelefonia(async () => {
      try {
        await updateAccountTelefoniaAction(formData);
        setTelefoniaMsg("Impostazioni telefonia salvate");
        router.refresh();
      } catch (e) {
        setTelefoniaErr(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm">
        <div className="bg-gradient-to-r from-[#1a365d] to-[#1a4f7a] px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-white/15 text-lg font-bold text-white backdrop-blur-sm">
              {iniziali(user.name) || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold text-white">{user.name}</h2>
              <p className="truncate text-sm text-white/80">{ROLE_LABELS[user.role] || user.role}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {showFormazione ? (
                <FormazioneAccountMenu canMonitor={canMonitorFormazione} />
              ) : null}
              {showStrumenti ? <StrumentiAccountMenu /> : null}
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <InfoItem label="Email" value={user.email} />
          <InfoItem
            label="Postazione"
            value={
              user.postazioneNome ? (
                <>
                  {user.postazioneNome}
                  {user.postazioneInterno ? (
                    <span className="ml-1 font-normal text-[var(--muted)]">
                      · int. {user.postazioneInterno}
                    </span>
                  ) : null}
                </>
              ) : (
                "—"
              )
            }
          />
          <InfoItem label="Interno attuale" value={user.interno || "—"} />
          <InfoItem label="Prefisso chiamata" value={user.prefissoChiamata || "—"} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <Sezione
          icon={Phone}
          titolo="Centralino"
          sottotitolo="Interno e prefisso per le chiamate in uscita"
        >
          <form action={salvaTelefonia} className="flex flex-1 flex-col space-y-4 text-sm">
            <div className="grid grid-cols-1 gap-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase text-[var(--muted)]">
                  Interno
                </span>
                <input
                  name="interno"
                  type="text"
                  inputMode="numeric"
                  defaultValue={user.interno}
                  placeholder="es. 201"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase text-[var(--muted)]">
                  Prefisso chiamata
                </span>
                <input
                  name="prefissoChiamata"
                  type="text"
                  defaultValue={user.prefissoChiamata}
                  placeholder="es. 9"
                  className={inputCls}
                />
              </label>
            </div>
            <p className="flex-1 rounded-lg bg-[#f8fafc] px-3 py-2 text-xs leading-relaxed text-[var(--muted)]">
              L&apos;interno personale ha priorità su quello della postazione al login. Il prefisso
              (es. 9) viene anteposto al numero per la linea esterna. Collegamento centralino in
              preparazione.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={telefoniaPending}
                className="h-10 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a365d] disabled:opacity-50"
              >
                {telefoniaPending ? "Salvo…" : "Salva centralino"}
              </button>
              {telefoniaMsg ? (
                <span className="text-xs font-semibold text-emerald-600">{telefoniaMsg}</span>
              ) : null}
              {telefoniaErr ? (
                <span className="text-xs font-semibold text-[var(--danger)]">{telefoniaErr}</span>
              ) : null}
            </div>
          </form>
        </Sezione>

        <Sezione
          icon={Lock}
          titolo="Password"
          sottotitolo="Sicurezza account e scadenza"
          accent={passwordUrgente ? "amber" : "navy"}
        >
          <div className="flex flex-1 flex-col">
          <div
            className={`mb-4 rounded-lg border px-3 py-2.5 ${
              passwordUrgente
                ? "border-amber-200 bg-amber-50"
                : "border-[var(--line)] bg-[#f8fafc]"
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span
                className={
                  passwordUrgente ? "font-semibold text-amber-900" : "text-[var(--muted)]"
                }
              >
                {user.giorniAllaScadenza === 0
                  ? "Password scaduta — aggiornala subito"
                  : `Scade tra ${user.giorniAllaScadenza} giorn${user.giorniAllaScadenza === 1 ? "o" : "i"}`}
              </span>
              <span className="font-medium tabular-nums text-[var(--navy)]">
                {user.giorniAllaScadenza}/30 gg
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/80">
              <div
                className={`h-full rounded-full transition-all ${
                  passwordUrgente ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${passwordPct}%` }}
              />
            </div>
          </div>
          <CambioPasswordForm compact />
          </div>
        </Sezione>
      </div>
    </div>
  );
}
