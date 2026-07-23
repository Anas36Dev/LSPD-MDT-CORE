import "server-only";

import {
  revalidatePath as nextRevalidatePath,
  revalidateTag as nextRevalidateTag,
} from "next/cache";

import { publishChange } from "./realtime";

/**
 * Remplaçants de `revalidatePath` / `revalidateTag` de `next/cache` qui, en
 * plus d'invalider le cache serveur, diffusent le changement sur le bus temps
 * réel. Les fichiers d'actions importent ces versions au lieu de `next/cache` :
 * ainsi chaque mutation existante prévient automatiquement tous les onglets
 * connectés, sans toucher aux 190+ appels déjà en place.
 */
export function revalidatePath(
  ...args: Parameters<typeof nextRevalidatePath>
): void {
  nextRevalidatePath(...args);
  publishChange([String(args[0])]);
}

export function revalidateTag(
  ...args: Parameters<typeof nextRevalidateTag>
): void {
  nextRevalidateTag(...args);
  publishChange([`tag:${String(args[0])}`]);
}
