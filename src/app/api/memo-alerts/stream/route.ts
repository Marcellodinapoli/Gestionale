import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { loadMemoAlertsForUser } from "@/lib/agenda/loadMemoAlerts";

const STREAM_POLL_MS = 15_000;

export async function GET(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const encoder = new TextEncoder();
  let lastPayload = "";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: { alerts: unknown[]; total: number }) => {
        const payload = JSON.stringify(data);
        if (payload === lastPayload) {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
          return;
        }
        lastPayload = payload;
        controller.enqueue(encoder.encode(`event: memo\ndata: ${payload}\n\n`));
      };

      const poll = async () => {
        try {
          send(await loadMemoAlertsForUser(user));
        } catch {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ message: "poll failed" })}\n\n`)
          );
        }
      };

      await poll();
      const timer = setInterval(poll, STREAM_POLL_MS);

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
