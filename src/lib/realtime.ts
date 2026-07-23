import "server-only";

import { EventEmitter } from "node:events";

/**
 * Bus temps réel en mémoire.
 *
 * Chaque mutation invalide déjà le cache serveur via `revalidatePath`
 * (cf. `@/lib/revalidate`). Mais `revalidatePath` ne rafraîchit que l'onglet de
 * l'agent qui a agi : les autres navigateurs ne sont jamais prévenus, d'où le
 * F5. Ce bus diffuse un signal « quelque chose a changé » que l'endpoint SSE
 * (`/api/realtime`) relaie à tous les onglets connectés ; chacun rappelle alors
 * `router.refresh()` pour re-fetcher sa page.
 *
 * Le bus vit dans le processus Node (`next start` = serveur long-running), donc
 * un simple EventEmitter suffit tant qu'il n'y a **qu'une seule instance**. En
 * cas de scaling horizontal, remplacer l'émission/abonnement ci-dessous par un
 * pub/sub Redis — le reste de l'application n'a pas à changer.
 */
export type RealtimeEvent = { paths: string[]; at: number };

const CHANNEL = "change";

// En développement, Next recharge les modules : sans ce cache global, chaque
// rechargement créerait un nouvel EventEmitter et les abonnés existants
// cesseraient de recevoir les événements.
const globalForBus = globalThis as unknown as { __lspdRealtimeBus?: EventEmitter };

function bus(): EventEmitter {
  if (!globalForBus.__lspdRealtimeBus) {
    const emitter = new EventEmitter();
    // Autant d'abonnés que d'onglets connectés : pas de plafond artificiel.
    emitter.setMaxListeners(0);
    globalForBus.__lspdRealtimeBus = emitter;
  }
  return globalForBus.__lspdRealtimeBus;
}

/** Signale qu'un ou plusieurs chemins viennent d'être invalidés. */
export function publishChange(paths: string[]): void {
  const event: RealtimeEvent = { paths, at: Date.now() };
  bus().emit(CHANNEL, event);
}

/** Abonne un flux SSE aux changements. Retourne la fonction de désabonnement. */
export function subscribeChange(
  listener: (event: RealtimeEvent) => void,
): () => void {
  bus().on(CHANNEL, listener);
  return () => bus().off(CHANNEL, listener);
}
