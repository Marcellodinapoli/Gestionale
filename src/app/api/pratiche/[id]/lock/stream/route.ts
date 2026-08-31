import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { canAccessPratica } from "@/lib/domain";
import { getPraticaLockStatus, lockScopeFromUser } from "@/lib/praticaLock";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: RouteCtx) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { id } = await ctx.params;
  if (!(await canAccessPratica(user, id))) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const scope = lockScopeFromUser(user);
  const encoder = new TextEncoder();
  let lastPayload = "";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: { owned: boolean; lockedByName: string | null }) => {
        const payload = JSON.stringify(data);
        if (payload === lastPayload) {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
          return;
        }
        lastPayload = payload;
        controller.enqueue(encoder.encode(`event: lock\ndata: ${payload}\n\n`));
      };

      const poll = async () => {
        try {
          const lock = await getPraticaLockStatus(id, user.id, scope);
          send({
            owned: lock.owned,
            lockedByName: lock.lockedBy?.name ?? null,
          });
        } catch {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ message: "poll failed" })}\n\n`)
          );
        }
      };

      await poll();
      const timer = setInterval(poll, 5_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(timer);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
