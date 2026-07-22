import "server-only";

import { db } from "@/lib/db";
import {
  discordAvatarUrl,
  discordDisplayName,
  fetchDiscordUserAsBot,
} from "@/lib/discord";

// Un avatar Discord est resynchronisé au plus une fois toutes les 6 heures.
const STALE_MS = 6 * 60 * 60 * 1000;
// Nombre d'agents rafraîchis par chargement de page : étale la charge Discord
// et garantit qu'à terme tout l'effectif est à jour, sans tâche planifiée.
const BATCH = 8;

type SyncTarget = {
  id: number;
  discordId: string | null;
  discordAvatarUrl: string | null;
  discordUsername: string | null;
};

const SELECT = {
  id: true,
  discordId: true,
  discordAvatarUrl: true,
  discordUsername: true,
} as const;

/**
 * Re-tape le profil Discord via le bot et met à jour l'avatar/pseudo si besoin.
 *
 * On horodate systématiquement (`discordSyncedAt`), même en cas d'échec réseau
 * ou de profil inchangé : ainsi l'agent n'est pas re-tenté à chaque navigation.
 * L'avatar imposé par un superviseur (`avatarSource = MANUAL`) n'est pas affiché,
 * mais on garde tout de même `discordAvatarUrl` frais pour un éventuel retour à
 * la source Discord.
 */
async function refreshOne(u: SyncTarget): Promise<void> {
  if (!u.discordId) return;

  const data: {
    discordSyncedAt: Date;
    discordAvatarUrl?: string;
    discordUsername?: string;
  } = { discordSyncedAt: new Date() };

  try {
    const profile = await fetchDiscordUserAsBot(u.discordId);
    if (profile) {
      const url = discordAvatarUrl(profile);
      const name = discordDisplayName(profile);
      if (url !== u.discordAvatarUrl) data.discordAvatarUrl = url;
      if (name !== u.discordUsername) data.discordUsername = name;
    }
  } catch {
    // Erreur réseau ponctuelle : on se contente d'horodater pour throttler.
  }

  await db.user.update({ where: { id: u.id }, data }).catch(() => {});
}

/**
 * Rafraîchit l'avatar d'un agent précis s'il est périmé (> 6 h).
 * Sert à donner un retour immédiat à l'agent qui vient de charger le terminal.
 */
export async function syncDiscordAvatar(userId: number): Promise<void> {
  if (!process.env.DISCORD_BOT_TOKEN) return;

  const u = await db.user.findUnique({
    where: { id: userId },
    select: { ...SELECT, discordSyncedAt: true },
  });
  if (!u?.discordId) return;
  if (u.discordSyncedAt && u.discordSyncedAt.getTime() > Date.now() - STALE_MS) {
    return;
  }
  await refreshOne(u);
}

/**
 * Rafraîchit en tâche de fond un petit lot d'agents dont la synchro Discord
 * remonte à plus de 6 h. À appeler via `after()` (après la réponse) : jamais
 * bloquant, et sans effet une fois tout le monde à jour.
 */
export async function syncStaleDiscordAvatars(limit = BATCH): Promise<void> {
  if (!process.env.DISCORD_BOT_TOKEN) return;

  const threshold = new Date(Date.now() - STALE_MS);
  const stale = await db.user.findMany({
    where: {
      discordId: { not: null },
      OR: [{ discordSyncedAt: null }, { discordSyncedAt: { lt: threshold } }],
    },
    select: SELECT,
    orderBy: { discordSyncedAt: { sort: "asc", nulls: "first" } },
    take: limit,
  });

  for (const u of stale) {
    await refreshOne(u);
  }
}
