import "server-only";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import {
  canViewModule,
  isPreviewing,
  type ModuleKey,
  type SessionUser,
} from "@/lib/permissions";

/**
 * Garde-fous côté serveur.
 *
 * À appeler dans CHAQUE page et CHAQUE Server Action protégée — jamais
 * uniquement dans un layout : un layout Next ne se re-rend pas à chaque
 * navigation, et les Server Actions sont joignables par POST direct sans
 * jamais traverser le layout.
 */

/** Exige un agent connecté, sinon renvoie vers la page de connexion. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Exige l'accès à un module donné, sinon renvoie vers le tableau de bord. */
export async function requireModule(key: ModuleKey): Promise<SessionUser> {
  const user = await requireUser();
  if (!canViewModule(user, key)) redirect("/dashboard?denied=" + key);
  return user;
}

/** Exige qu'un prédicat de permission soit satisfait. */
export async function requirePermission(
  check: (u: SessionUser) => boolean,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!check(user)) redirect("/dashboard?denied=1");
  return user;
}

/**
 * Variante pour les Server Actions : lève une erreur au lieu de rediriger,
 * afin que l'action retourne un message exploitable par le formulaire.
 */
export async function assertPermission(
  check: (u: SessionUser) => boolean,
  message = "Vous n'avez pas les droits nécessaires pour cette action.",
): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Session expirée. Reconnectez-vous.");

  // Le mode aperçu est strictement consultatif. Autoriser une écriture
  // reviendrait à attribuer au grade simulé un acte commis par le chef du
  // département — le journal d'audit deviendrait mensonger.
  if (isPreviewing(user)) {
    throw new Error(
      "Mode aperçu : aucune modification n'est possible. Quittez l'aperçu pour agir.",
    );
  }

  if (!check(user)) throw new Error(message);
  return user;
}
