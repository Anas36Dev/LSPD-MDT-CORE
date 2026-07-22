import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";

const EXTS = ["svg", "png", "webp", "jpg", "jpeg"];

/**
 * Fichier d'insigne (galon) associé à chaque grade, dans `public/ranks/`.
 * Plusieurs grades peuvent partager le même visuel (ex. tous les Captains).
 * Un grade absent de cette table (ex. Rookie) n'a pas d'insigne.
 */
const FILE_BY_CODE: Record<string, string> = {
  CHIEF_OF_POLICE: "CHIEF_OF_POLICE",
  ASSISTANT_CHIEF: "ASSISTANT_CHIEF",
  DEPUTY_CHIEF: "DEPUTY_CHIEF",
  COMMANDER: "COMMANDER",
  CAPTAIN_III: "CAPTAIN",
  CAPTAIN_II: "CAPTAIN",
  CAPTAIN_I: "CAPTAIN",
  LIEUTENANT_II: "LIEUTENANT",
  LIEUTENANT_I: "LIEUTENANT",
  SERGEANT_II: "SERGEANT_II",
  SERGEANT_I: "SERGEANT_I",
  DETECTIVE_III: "DETECTIVE_III",
  DETECTIVE_II: "DETECTIVE_II",
  DETECTIVE_I: "DETECTIVE_I",
  POLICE_OFFICER_III_1: "POLICE_OFFICER_III_1",
  POLICE_OFFICER_III: "POLICE_OFFICER_III",
  POLICE_OFFICER_II: "POLICE_LOGO",
  POLICE_OFFICER_I: "POLICE_LOGO",
  DOJ: "DOJ",
  // ROOKIE : volontairement absent — le cadet ne porte pas d'insigne de grade.
};

/**
 * Chemin public de l'insigne d'un grade, si l'image existe dans `public/ranks/`.
 * Renvoie null si le grade n'a pas d'insigne (Rookie) ou si aucun fichier n'a
 * encore été déposé — l'affichage se fait alors sans galon.
 */
export function rankInsignia(code: string): string | null {
  const base = FILE_BY_CODE[code];
  if (!base) return null;
  for (const ext of EXTS) {
    const rel = `ranks/${base}.${ext}`;
    if (existsSync(path.join(process.cwd(), "public", rel))) {
      return `/${rel}`;
    }
  }
  return null;
}
