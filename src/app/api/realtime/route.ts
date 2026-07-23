import { getCurrentUser } from "@/lib/auth";
import { subscribeChange } from "@/lib/realtime";

// Flux permanent : jamais mis en cache, jamais prérendu.
export const dynamic = "force-dynamic";

/**
 * Endpoint Server-Sent Events. Chaque agent connecté ouvre un flux ; dès qu'une
 * mutation invalide un chemin (via `@/lib/revalidate`), un événement `change`
 * est poussé et le client rappelle `router.refresh()`.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // déjà fermé
        }
      };

      const send = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          cleanup();
        }
      };

      // Délai de reconnexion conseillé au navigateur + accusé d'ouverture.
      send("retry: 3000\n\n");
      send("event: ready\ndata: {}\n\n");

      unsubscribe = subscribeChange((event) => {
        send(`event: change\ndata: ${JSON.stringify(event)}\n\n`);
      });

      // Battement de cœur : garde la connexion ouverte à travers les proxies
      // qui coupent les flux inactifs.
      heartbeat = setInterval(() => send(": ping\n\n"), 25000);

      // Fin de connexion côté client (onglet fermé, navigation).
      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Désactive le buffering côté proxy (nginx) pour une diffusion immédiate.
      "X-Accel-Buffering": "no",
    },
  });
}
