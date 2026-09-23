import { NextResponse } from "next/server";
import { requireApiModule, requireApiUser } from "@/lib/guard";
import { assertCan } from "@/lib/permissions";
import {
  generateRoleplayReply,
  type RoleplayStepInput,
} from "@/lib/formazione/roleplayLocalEngine";

export async function POST(req: Request) {
  const userOrRes = await requireApiUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  try {
    assertCan(userOrRes, "formazione:view");
  } catch {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }
  const moduleDenied = await requireApiModule(userOrRes, "formazione");
  if (moduleDenied) return moduleDenied;

  let body: RoleplayStepInput = {};
  try {
    body = (await req.json()) as RoleplayStepInput;
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const reply = generateRoleplayReply(body).trim();
  if (!reply) {
    return NextResponse.json({ error: "Risposta vuota" }, { status: 500 });
  }

  return NextResponse.json({ reply, role: "assistant", source: "local" });
}
