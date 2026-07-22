import { cookies, headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { audit, createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  DISCORD_STATE_COOKIE,
  discordAvatarUrl,
  discordConfig,
  discordDisplayName,
  type DiscordUser,
} from "@/lib/discord";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
const fail = (reason: string) =>
  NextResponse.redirect(new URL(`/login?error=${reason}`, appUrl()));

export async function GET(request: NextRequest) {
  const config = discordConfig();
  if (!config) return fail("discord_failed");

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return fail("discord_denied");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return fail("discord_failed");

  const store = await cookies();
  const expectedState = store.get(DISCORD_STATE_COOKIE)?.value;
  store.delete(DISCORD_STATE_COOKIE);
  if (!expectedState || expectedState !== state) return fail("state_mismatch");

  // --- Échange du code contre un token -------------------------------------
  const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
    cache: "no-store",
  });
  if (!tokenRes.ok) return fail("discord_failed");

  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return fail("discord_failed");

  const userRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${access_token}` },
    cache: "no-store",
  });
  if (!userRes.ok) return fail("discord_failed");

  const discordUser = (await userRes.json()) as DiscordUser;

  // --- Rattachement à un compte agent existant -----------------------------
  // Aucune auto-inscription : le compte doit avoir été créé par la hiérarchie
  // et son identifiant Discord renseigné. Sans cela, n'importe qui pourrait
  // se créer un accès au MDT depuis un compte Discord quelconque.
  const user = await db.user.findUnique({
    where: { discordId: discordUser.id },
  });

  if (!user) {
    await audit({
      action: "LOGIN_DISCORD_UNLINKED",
      detail: `Tentative de connexion Discord non rattachée : ${discordUser.username} (${discordUser.id})`,
    });
    return fail("discord_unlinked");
  }

  if (user.status === "SUSPENDED" || user.status === "DISCHARGED") {
    return fail("discord_suspended");
  }

  // Synchronisation du pseudo et de l'avatar à chaque connexion.
  await db.user.update({
    where: { id: user.id },
    data: {
      discordUsername: discordDisplayName(discordUser),
      discordAvatarUrl: discordAvatarUrl(discordUser),
      discordSyncedAt: new Date(),
    },
  });

  const h = await headers();
  await createSession(user.id, {
    ip: h.get("x-forwarded-for") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  });
  await audit({
    userId: user.id,
    action: "LOGIN",
    detail: `Connexion via Discord (${discordUser.username})`,
  });

  return NextResponse.redirect(new URL("/dashboard", appUrl()));
}
