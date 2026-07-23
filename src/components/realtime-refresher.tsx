"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Écoute le flux SSE `/api/realtime` et rafraîchit la page (`router.refresh()`)
 * dès qu'une mutation survient côté serveur — pour n'importe quel agent, sans
 * F5. Monté une seule fois dans le layout du MDT.
 *
 * - Les rafraîchissements sont dé-bouncés : une rafale de changements ne
 *   provoque qu'un seul refresh.
 * - Onglet caché : on ne rafraîchit pas (inutile), mais on retient qu'un
 *   changement a eu lieu pour rafraîchir au retour de l'agent.
 * - `EventSource` se reconnecte automatiquement en cas de coupure réseau.
 */
export function RealtimeRefresher() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let missedWhileHidden = false;

    const refreshSoon = () => {
      if (document.hidden) {
        missedWhileHidden = true;
        return;
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };

    const onVisibility = () => {
      if (!document.hidden && missedWhileHidden) {
        missedWhileHidden = false;
        router.refresh();
      }
    };

    const source = new EventSource("/api/realtime");
    source.addEventListener("change", refreshSoon);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer.current) clearTimeout(timer.current);
      source.close();
    };
  }, [router]);

  return null;
}
