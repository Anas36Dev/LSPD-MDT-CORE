import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { discordConfig, DISCORD_STATE_COOKIE } from "@/lib/discord";

/** Démarre le flux OAuth2 Discord. */
export async function GET() {
  const config = discordConfig();
  if (!config) {
    return NextResponse.redirect(
      new URL("/login?error=discord_failed", process.env.APP_URL ?? "http://localhost:3000"),
    );
  }

  // `state` anti-CSRF : rejoué au retour pour s'assurer que la redirection
  // provient bien du flux que nous avons initié.
  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(DISCORD_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url);
}
