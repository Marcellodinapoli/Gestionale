import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { canAccessPratica } from "@/lib/domain";
import { loadPraticheStessoDebitorePayload } from "@/lib/praticheStessoDebitore";

export async function GET(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const praticaId = new URL(req.url).searchParams.get("id") || "";
  if (!praticaId) {
    return NextResponse.json({ error: "Pratica mancante" }, { status: 400 });
  }
  if (!(await canAccessPratica(user, praticaId))) {
    return NextResponse.json({ error: "Pratica non visibile" }, { status: 404 });
  }

  const payload = await loadPraticheStessoDebitorePayload(
    user.tenantId,
    praticaId
  );
  if (!payload) {
    return NextResponse.json({ error: "Pratica non trovata" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
