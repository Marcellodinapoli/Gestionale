import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { loadDialerStreamPayload } from "@/lib/predictive-dialer/streamPayload";

const STREAM_POLL_MS = 5_000;

export async function GET(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const url = new URL(req.url);
  const campagnaId = url.searchParams.get("campagnaId") || undefined;

  const encoder = new TextEncoder();
  let lastPayload = "";

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        try {
          const data = await loadDialerStreamPayload(user, campagnaId);
          const payload = JSON.stringify(data);
          if (payload === lastPayload) {
            controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
            return;
          }
          lastPayload = payload;
          controller.enqueue(encoder.encode(`event: dialer\ndata: ${payload}\n\n`));
        } catch {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ message: "poll failed" })}\n\n`)
          );
        }
      };

      await send();
      const timer = setInterval(send, STREAM_POLL_MS);

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
