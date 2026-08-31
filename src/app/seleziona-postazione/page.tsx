import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { postazioniDbFromUser } from "@/lib/postazioniRepo";
import { getCurrentUser } from "@/lib/auth";
import { isUserPasswordExpired } from "@/lib/passwordPolicy";
import { canImpostarePostazioneFissa, mustChoosePostazioneAlLogin, requiresPostazione } from "@/lib/permissions";
import { logoutAction } from "@/actions/core";
import { SelezionaPostazioneForm } from "./SelezionaPostazioneForm";

export default async function SelezionaPostazionePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (await isUserPasswordExpired(user.id)) redirect("/cambia-password");

  if (!requiresPostazione(user) || !mustChoosePostazioneAlLogin(user)) {
    redirect("/");
  }

  const postazioni = await postazioniDbFromUser(user).findMany({
    where: { active: true, tenantId: user.tenantId },
    orderBy: [{ sedeRef: { nome: "asc" } }, { nome: "asc" }],
    include: {
      sedeRef: { select: { nome: true } },
      occupanti: {
        where: { active: true, id: { not: user.id }, tenantId: user.tenantId },
        select: { id: true, name: true },
      },
    },
  });

  const lista = postazioni.map((p) => ({
    id: p.id,
    nome: p.nome,
    interno: p.interno,
    email: p.email,
    numeroFisso: p.numeroFisso,
    sede: p.sedeRef?.nome || null,
    occupante: p.occupanti[0]?.name || null,
  }));

  return (
    <div className="page-gutter flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 py-4">
      <div className="w-full max-w-xl rounded-2xl border border-[var(--line)] bg-white p-8 shadow-lg">
        <h1 className="mb-1 text-xl font-bold text-[var(--navy)]">
          Seleziona la tua postazione
        </h1>
        <p className="mb-6 text-sm text-[var(--muted)]">
          Ciao <span className="font-semibold">{user.name}</span>, scegli dove
          lavori oggi.
        </p>

        {lista.length === 0 ? (
          <div className="space-y-4">
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Nessuna postazione configurata per questa azienda. Chiedi a un
              amministratore di crearne almeno una in <strong>Gestione → Postazioni</strong>.
            </p>
            <form action={logoutAction}>
              <button
                type="submit"
                className="h-10 w-full rounded-lg border border-[var(--line)] bg-white text-sm font-semibold text-[var(--navy)] hover:bg-slate-50"
              >
                Esci e torna al login
              </button>
            </form>
          </div>
        ) : lista.every((p) => p.occupante) ? (
          <div className="space-y-4">
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Ci sono {lista.length} postazione/i, ma <strong>tutte occupate</strong> in
              questo momento. Attendi che qualcuno esca o chiedi all&apos;amministratore di
              aggiungerne altre in <strong>Gestione → Postazioni</strong>.
            </p>
            <ul className="space-y-2 text-sm">
              {lista.map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border border-[var(--line)] bg-slate-50 px-3 py-2"
                >
                  <span className="font-semibold text-[var(--navy)]">{p.nome}</span>
                  {p.occupante ? (
                    <span className="text-[var(--muted)]"> — occupata da {p.occupante}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <form action={logoutAction}>
              <button
                type="submit"
                className="h-10 w-full rounded-lg border border-[var(--line)] bg-white text-sm font-semibold text-[var(--navy)] hover:bg-slate-50"
              >
                Esci e torna al login
              </button>
            </form>
          </div>
        ) : (
          <SelezionaPostazioneForm
            postazioni={lista}
            showPostazioneFissa={canImpostarePostazioneFissa(user.role)}
          />
        )}
      </div>
    </div>
  );
}
