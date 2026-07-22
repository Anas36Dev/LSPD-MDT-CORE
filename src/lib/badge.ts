import "server-only";

import { randomInt } from "node:crypto";

import { db } from "@/lib/db";

/**
 * Numéro de badge du LSPD.
 *
 * Format : les 2 chiffres du matricule de l'agent, suivis de 3 chiffres tirés
 * au hasard. Exemple : matricule 28 → badge 28597.
 *
 * Le matricule reste lisible dans le badge, ce qui permet d'identifier l'agent
 * d'un coup d'œil, tandis que les 3 chiffres aléatoires évitent que deux
 * agents partageant un matricule aient le même numéro.
 */

export const MATRICULE_PATTERN = /^\d{2}$/;

export function normalizeMatricule(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 0 || digits.length > 2) return null;
  return digits.padStart(2, "0"); // "5" → "05"
}

/**
 * Tire un badge disponible pour ce matricule.
 *
 * Le tirage est refait tant que le numéro est déjà pris. Avec 1000 combinaisons
 * par matricule, une collision reste rare ; au-delà de 40 tentatives on
 * considère le matricule saturé plutôt que de boucler indéfiniment.
 */
export async function generateBadgeNumber(matricule: string) {
  const normalized = normalizeMatricule(matricule);
  if (!normalized) {
    throw new Error("Le matricule doit comporter 1 ou 2 chiffres.");
  }

  for (let attempt = 0; attempt < 40; attempt++) {
    const suffix = String(randomInt(0, 1000)).padStart(3, "0");
    const badgeNumber = `${normalized}${suffix}`;

    const taken = await db.user.findUnique({ where: { badgeNumber } });
    if (!taken) return badgeNumber;
  }

  throw new Error(
    `Impossible de générer un badge pour le matricule ${normalized} : trop de numéros déjà attribués.`,
  );
}
