import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { authenticateLogin, mapLoginException } from "@/lib/loginCore";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      tenantSlug?: string;
    };
    const result = await authenticateLogin(body);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
    await createSession(result.session);
    return NextResponse.json({ ok: true, href: result.href });
  } catch (e) {
    const failure = mapLoginException(e);
    return NextResponse.json({ error: failure.error }, { status: 500 });
  }
}
