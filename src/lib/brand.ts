import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Fichiers acceptés pour le logo, par ordre de préférence.
 *
 * La version 256 px est cherchée en premier : l'original fait 1500 px et pèse
 * près d'un mégaoctet, inutile pour un écusson affiché à 40 px dans le menu.
 */
const CANDIDATES = [
  "logo-256.png",
  "logo.svg",
  "logo.png",
  "logo.jpg",
  "logo.webp",
];

/**
 * Cherche un logo déposé dans `public/`.
 *
 * Tant qu'aucun fichier n'est présent, l'écusson SVG intégré prend le relais.
 * Déposer `public/logo.png` suffit donc à changer l'identité visuelle, sans
 * toucher au code.
 */
export function findLogo(): string | null {
  const publicDir = path.join(process.cwd(), "public");

  for (const name of CANDIDATES) {
    if (existsSync(path.join(publicDir, name))) return `/${name}`;
  }
  return null;
}
