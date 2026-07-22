import "server-only";

import { cookies } from "next/headers";

import type { SessionUser } from "@/lib/permissions";

export const PREVIEW_COOKIE = "lspd_preview";

/**
 * Mode aperçu.
 *
 * Le chef du département peut visualiser le terminal tel que le verrait un
 * autre grade, afin de contrôler le cloisonnement sans créer de faux comptes.
 *
 * Deux garde-fous non négociables :
 *   1. L'aperçu ne modifie RIEN en base — il vit dans un cookie et ne fait que
 *      réécrire le profil de session en mémoire.
 *   2. Toute action d'écriture est refusée pendant l'aperçu. Sans cela, le
 *      journal d'audit attribuerait à un Rookie des actes commis par le Chief.
 */
export type PreviewSpec = {
  rankCode: string;
  divisionCodes: string[];
  divisionRoleCodes: string[];
  subDivisionCodes: string[];
  certificationCodes: string[];
  unionRole: "REPRESENTATIVE" | "MEMBER" | null;
};

export async function readPreview(): Promise<PreviewSpec | null> {
  const raw = (await cookies()).get(PREVIEW_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PreviewSpec;
    if (typeof parsed?.rankCode !== "string") return null;

    return {
      rankCode: parsed.rankCode,
      divisionCodes: Array.isArray(parsed.divisionCodes) ? parsed.divisionCodes : [],
      divisionRoleCodes: Array.isArray(parsed.divisionRoleCodes)
        ? parsed.divisionRoleCodes
        : [],
      subDivisionCodes: Array.isArray(parsed.subDivisionCodes)
        ? parsed.subDivisionCodes
        : [],
      certificationCodes: Array.isArray(parsed.certificationCodes)
        ? parsed.certificationCodes
        : [],
      unionRole:
        parsed.unionRole === "REPRESENTATIVE" || parsed.unionRole === "MEMBER"
          ? parsed.unionRole
          : null,
    };
  } catch {
    return null;
  }
}

/** Données de référence nécessaires pour reconstituer un profil d'aperçu. */
export type PreviewCatalog = {
  ranks: { code: string; name: string; level: number; category: string }[];
  divisions: { id: number; code: string; name: string }[];
  divisionRoles: {
    code: string;
    name: string;
    divisionCode: string;
    subDivisionCode: string | null;
    isDivisionChief: boolean;
    isUnitLead: boolean;
    canTrain: boolean;
  }[];
};

/**
 * Réécrit le profil de session selon l'aperçu demandé.
 *
 * `isSuperAdmin` est forcé à faux : un aperçu qui conserverait les pleins
 * pouvoirs ne montrerait rien d'utile.
 */
export function applyPreview(
  user: SessionUser,
  spec: PreviewSpec,
  catalog: PreviewCatalog,
): SessionUser {
  const rank = catalog.ranks.find((r) => r.code === spec.rankCode);
  if (!rank) return user;

  const divisions = catalog.divisions
    .filter((d) => spec.divisionCodes.includes(d.code))
    .map((d, i) => ({ ...d, isPrimary: i === 0 }));

  const divisionRoles = catalog.divisionRoles.filter((r) =>
    spec.divisionRoleCodes.includes(r.code),
  );

  return {
    ...user,
    isSuperAdmin: false,
    rank: {
      code: rank.code,
      name: rank.name,
      level: rank.level,
      category: rank.category,
    },
    divisions,
    divisionRoles,
    subDivisionCodes: spec.subDivisionCodes,
    certificationCodes: spec.certificationCodes,
    unionRole: spec.unionRole,
    preview: {
      active: true,
      realRankName: user.rank.name,
      realName: `${user.firstName} ${user.lastName}`,
    },
  };
}
