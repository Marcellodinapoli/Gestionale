import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS, isManutenzione, type Role } from "@/lib/permissions";
import { operatorSigla } from "@/lib/noteFormat";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ users: [] }, { status: 401 });
  if (isManutenzione(user)) return NextResponse.json({ users: [] });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() || "";
  const ruolo = url.searchParams.get("ruolo") || "";
  const elenco = url.searchParams.get("elenco") === "1";

  const all = await prisma.user.findMany({
    where: { active: true, id: { not: user.id }, tenantId: user.tenantId },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  const users = all
    .filter((u) => {
      if (ruolo && u.role !== ruolo) return false;
      if (!elenco && q.length < 1) return false;
      if (q) {
        const sigla = operatorSigla(u.name).toLowerCase();
        return u.name.toLowerCase().includes(q) || sigla.includes(q);
      }
      return true;
    })
    .map((u) => ({
      id: u.id,
      name: u.name,
      sigla: operatorSigla(u.name),
      ruolo: ROLE_LABELS[u.role as Role] || u.role,
      role: u.role,
    }));

  return NextResponse.json({ users });
}
