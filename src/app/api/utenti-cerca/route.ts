import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { usersDbFromUser } from "@/lib/usersRepo";
import { ROLE_LABELS, isManutenzione, type Role } from "@/lib/permissions";
import { operatorSigla } from "@/lib/noteFormat";

export async function GET(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (isManutenzione(user)) return NextResponse.json({ users: [] });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() || "";
  const ruolo = url.searchParams.get("ruolo") || "";
  const elenco = url.searchParams.get("elenco") === "1";

  // Destinatari: tutti i ruoli operativi, esclusa manutenzione (e se stessi).
  const all = await usersDbFromUser(user).findMany({
    where: {
      active: true,
      id: { not: user.id },
      tenantId: user.tenantId,
      role: { not: "MANUTENZIONE" },
    },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const users = all
    .filter((u) => {
      if (ruolo === "OPERATOR" || ruolo === "BACK_OFFICE") {
        if (u.role !== ruolo) return false;
      } else if (ruolo && u.role !== ruolo) {
        return false;
      }
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
