import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import { OperatoriGestione } from "@/components/operatori/OperatoriGestione";
import { createOperatoreAction } from "@/actions/operatoriAdmin";

export default async function OperatoriPage() {
  const user = await requirePermission("operatori:manage");

  const [users, supervisori] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, tenantId: user.tenantId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        acronimo: true,
        lastLoginAt: true,
        lastLogoutAt: true,
        postazione: { select: { nome: true, interno: true } },
        supervisor: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "SUPERVISOR", active: true, tenantId: user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const lista = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    roleLabel: ROLE_LABELS[u.role as Role] || u.role,
    acronimo: u.acronimo,
    lastLoginAt: u.lastLoginAt?.toISOString() || null,
    lastLogoutAt: u.lastLogoutAt?.toISOString() || null,
    postazione: u.postazione?.nome || null,
    interno: u.postazione?.interno || null,
    supervisorName: u.supervisor?.name || null,
  }));

  const inputCls = "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gestione operatori"
        subtitle="Acronimi, reset password e creazione utenti"
      />

      <Card title="Nuovo operatore">
        <form action={createOperatoreAction} className="flex flex-wrap items-end gap-3 text-sm">
          <label className="min-w-[150px] flex-1">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Nome</span>
            <input name="name" required className={inputCls} />
          </label>
          <label className="min-w-[180px] flex-1">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Email</span>
            <input name="email" type="email" required className={inputCls} />
          </label>
          <label className="w-32">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Password</span>
            <input name="password" type="password" required minLength={6} className={inputCls} />
          </label>
          <label className="w-28">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Acronimo</span>
            <input name="acronimo" maxLength={6} className={`${inputCls} uppercase`} />
          </label>
          <label className="w-40">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Ruolo</span>
            <select name="role" className={inputCls}>
              <option value="OPERATOR">Operatore</option>
              <option value="BACK_OFFICE">Back office</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="AMMINISTRAZIONE">Amministrazione</option>
            </select>
          </label>
          <label className="w-44">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Supervisor</span>
            <select name="supervisorId" className={inputCls}>
              <option value="">—</option>
              {supervisori.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <button className="h-9 rounded-lg bg-[var(--navy)] px-4 text-sm font-medium text-white hover:opacity-90">
            Crea
          </button>
        </form>
      </Card>

      <Card>
        <OperatoriGestione utenti={lista} />
      </Card>
    </div>
  );
}
