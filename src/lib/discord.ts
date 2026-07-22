import "server-only";

export const DISCORD_STATE_COOKIE = "lspd_discord_state";

export type DiscordConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/** Retourne la configuration OAuth2, ou null si elle n'est pas renseignée. */
export function discordConfig(): DiscordConfig | null {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return {
    clientId,
    clientSecret,
    redirectUri:
      process.env.DISCORD_REDIRECT_URI ?? `${appUrl}/api/auth/discord/callback`,
  };
}

export type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  discriminator: string;
};

/** URL CDN de l'avatar, avec repli sur l'avatar par défaut de Discord. */
export function discordAvatarUrl(user: DiscordUser) {
  if (user.avatar) {
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=256`;
  }
  // Avatars par défaut : 5 variantes indexées sur l'ID pour les comptes récents.
  const index = Number((BigInt(user.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export const discordDisplayName = (user: DiscordUser) =>
  user.global_name ?? user.username;

/**
 * Récupère un profil Discord via le token de bot, sans intervention de l'agent.
 * Sert à renseigner l'avatar d'un agent qui ne s'est jamais connecté via Discord.
 */
export async function fetchDiscordUserAsBot(
  discordId: string,
): Promise<DiscordUser | null> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;

  const res = await fetch(`https://discord.com/api/v10/users/${discordId}`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as DiscordUser;
}
