import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LspdShield } from "@/components/brand/lspd-shield";
import { getCurrentUser } from "@/lib/auth";
import { findLogo } from "@/lib/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { error } = await searchParams;
  const logoUrl = findLogo();
  const discordEnabled = Boolean(
    process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET,
  );

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Los Santos Police Department"
              className="h-28 w-28 object-contain drop-shadow-[0_0_24px_rgba(21,101,216,0.35)]"
            />
          ) : (
            <LspdShield className="h-20 w-auto drop-shadow-[0_0_20px_rgba(21,101,216,0.35)]" />
          )}
          <h1 className="mt-5 text-lg font-semibold tracking-wide text-mist-100">
            Mobile Data Terminal
          </h1>
          <p className="mt-1 text-xs tracking-widest text-gold-500 uppercase">
            Station 9 · Los Santos Police Department
          </p>
        </div>

        <div className="rounded-xl border border-ink-700 bg-ink-900/80 p-6 backdrop-blur-sm">
          {error ? (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-alert-500/40 bg-alert-600/15 px-3.5 py-2.5 text-xs text-alert-500"
            >
              {DISCORD_ERRORS[error] ?? "Échec de la connexion."}
            </p>
          ) : null}

          <LoginForm discordEnabled={discordEnabled} />
        </div>

        <p className="mt-6 text-center text-[0.68rem] leading-relaxed text-mist-500">
          Accès strictement réservé au personnel du LSPD du{" "}
          <span className="text-mist-300">CORE France Project</span>. Toute
          connexion est journalisée. La reproduction de ce terminal est
          strictement interdite.
        </p>

        <footer className="mt-8 border-t border-ink-700/60 pt-4 text-center">
          <p className="text-[0.62rem] leading-relaxed text-mist-600">
            © CORE France Project
          </p>
          <Link
            href="/legal"
            className="mt-2 inline-block text-[0.62rem] text-mist-500 underline decoration-mist-700 underline-offset-2 transition-colors hover:text-mist-300"
          >
            Mentions légales &amp; Conditions Générales d&apos;Utilisation
          </Link>
        </footer>
      </div>
    </main>
  );
}

const DISCORD_ERRORS: Record<string, string> = {
  discord_denied: "Autorisation Discord refusée.",
  discord_failed: "La connexion Discord a échoué. Réessayez.",
  discord_unlinked:
    "Ce compte Discord n'est rattaché à aucun agent. Demandez à votre hiérarchie de renseigner votre identifiant Discord.",
  discord_suspended: "Compte suspendu. Contactez les Affaires Internes.",
  state_mismatch: "Session de connexion expirée. Réessayez.",
};
