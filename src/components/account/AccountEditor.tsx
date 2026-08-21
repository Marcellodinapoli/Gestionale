"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAccountTelefoniaAction } from "@/actions/account";
import { CambioPasswordForm } from "@/components/account/CambioPasswordForm";
import { Card } from "@/components/ui";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-sm";

export function AccountEditor({
  user,
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
}) {
  const router = useRouter();
  const [telefoniaMsg, setTelefoniaMsg] = useState<string | null>(null);
  const [telefoniaErr, setTelefoniaErr] = useState<string | null>(null);
  const [telefoniaPending, startTelefonia] = useTransition();

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
    <div className="grid max-w-2xl gap-4">
      <Card title="Profilo">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase text-[var(--muted)]">Nome</dt>
            <dd className="mt-0.5 font-medium text-[var(--navy)]">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[var(--muted)]">Email</dt>
            <dd className="mt-0.5 font-medium text-[var(--navy)]">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[var(--muted)]">Ruolo</dt>
            <dd className="mt-0.5 font-medium text-[var(--navy)]">
              {ROLE_LABELS[user.role] || user.role}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-[var(--muted)]">Postazione</dt>
            <dd className="mt-0.5 font-medium text-[var(--navy)]">
              {user.postazioneNome || "—"}
              {user.postazioneInterno ? (
                <span className="ml-1 font-normal text-[var(--muted)]">
                  (int. postazione {user.postazioneInterno})
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Centralino">
        <form action={salvaTelefonia} className="space-y-4 text-sm">
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
            <span className="mt-1 block text-xs text-[var(--muted)]">
              Numero interno con cui ti identifichi al centralino. Se impostato, ha priorità
              sull&apos;interno della postazione selezionata al login.
            </span>
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
            <span className="mt-1 block text-xs text-[var(--muted)]">
              Prefisso da digitare prima del numero per le chiamate in uscita tramite centralino
              (es. 9 per linea esterna). Salvato sul tuo profilo; collegamento al centralino in
              preparazione.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={telefoniaPending}
              className="h-9 rounded-lg border border-[var(--line)] bg-[var(--navy)] px-4 text-sm font-semibold text-white hover:bg-[#1a365d] disabled:opacity-50"
            >
              {telefoniaPending ? "Salvo..." : "Salva centralino"}
            </button>
            {telefoniaMsg ? (
              <span className="text-xs font-semibold text-emerald-600">{telefoniaMsg}</span>
            ) : null}
            {telefoniaErr ? (
              <span className="text-xs font-semibold text-[var(--danger)]">{telefoniaErr}</span>
            ) : null}
          </div>
        </form>
      </Card>

      <Card title="Password">
        <p
          className={`mb-3 text-sm ${
            user.giorniAllaScadenza <= 7
              ? "font-semibold text-amber-700"
              : "text-[var(--muted)]"
          }`}
        >
          {user.giorniAllaScadenza === 0
            ? "Password scaduta: aggiornala subito."
            : `Scade tra ${user.giorniAllaScadenza} giorn${user.giorniAllaScadenza === 1 ? "o" : "i"} (validità 30 giorni, niente password già usate).`}
        </p>
        <CambioPasswordForm />
      </Card>
    </div>
  );
}
