import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { canAccessPratica } from "@/lib/domain";
import { fingerprintNote, loadPraticaNote } from "@/lib/praticaNoteLoad";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Poll server-side: le note dall'app compaiono quasi subito sulla scheda PC. */
const STREAM_POLL_MS = 700;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { id } = await ctx.params;
  if (!(await canAccessPratica(user, id))) {
    return NextResponse.json({ error: "Pratica non visibile" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let lastFp = "";

  const stream = new ReadableStream({
    async start(controller) {
      const sendNotes = async () => {
        try {
          const attivita = await loadPraticaNote(user, id);
          const fp = fingerprintNote(attivita);
          if (fp === lastFp) {
            controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
            return;
          }
          lastFp = fp;
          controller.enqueue(
            encoder.encode(
              `event: notes\ndata: ${JSON.stringify({ attivita })}\n\n`
            )
          );
        } catch {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ message: "poll failed" })}\n\n`
            )
          );
        }
      };

      await sendNotes();
      const timer = setInterval(() => {
        void sendNotes();
      }, STREAM_POLL_MS);

      req.signal.addEventListener("abort", () => {
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
