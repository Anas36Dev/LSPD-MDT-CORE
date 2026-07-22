import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";

const EXTS = ["png", "webp", "svg", "jpg", "jpeg"];

/** Fichier image associé à chaque médaille, dans `public/medals/`. */
const FILE_BY_CODE: Record<string, string> = {
  MOH: "Medal_medal_of_honor",
  DSM: "Medal_Distinguished_Service_Medal",
  MSM: "Medal_Police_Meritorious_Service_Medal",
  ESM: "Medal_Exemplary_Service_Medal",
  PS: "Medal_Police_Star",
};

/**
 * Chemin public de l'image d'une médaille, si le fichier existe.
 * Renvoie null si la médaille n'a pas d'image — on retombe alors sur l'icône
 * vectorielle (`Medal.icon`) et sa couleur.
 */
export function medalImage(code: string): string | null {
  const base = FILE_BY_CODE[code];
  if (!base) return null;
  for (const ext of EXTS) {
    const rel = `medals/${base}.${ext}`;
    if (existsSync(path.join(process.cwd(), "public", rel))) {
      return `/${rel}`;
    }
  }
  return null;
}
