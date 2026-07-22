import "server-only";

import { db } from "@/lib/db";

/**
 * Référence d'un casier judiciaire : `CASIER-2026-0001`.
 * Séquence annuelle sur l'ensemble des fiches.
 */
export async function nextCasierReference(): Promise<string> {
  const year = new Date().getFullYear();
  const base = `CASIER-${year}-`;
  const last = await db.civilian.findFirst({
    where: { reference: { startsWith: base } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const lastSeq = last ? Number(last.reference.slice(base.length)) : 0;
  return `${base}${String(lastSeq + 1).padStart(4, "0")}`;
}

/**
 * Sous-référence d'une infraction, dérivée du casier : `CASIER-2026-0001-01`.
 * Séquence propre à la fiche.
 */
export async function nextInfractionReference(
  civilianId: number,
  civilianReference: string,
): Promise<string> {
  const base = `${civilianReference}-`;
  const last = await db.criminalRecord.findFirst({
    where: { civilianId, reference: { startsWith: base } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const lastSeq =
    last?.reference != null ? Number(last.reference.slice(base.length)) : 0;
  return `${base}${String(lastSeq + 1).padStart(2, "0")}`;
}
