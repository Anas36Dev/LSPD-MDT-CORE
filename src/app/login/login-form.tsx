"use client";

import { useActionState, useState } from "react";

import { DiscordLogo } from "@/components/brand/lspd-shield";
import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { login, type LoginState } from "./actions";

type Mode = "email" | "badge";

export function LoginForm({ discordEnabled }: { discordEnabled: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );
  const [mode, setMode] = useState<Mode>("email");

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-ink-600 bg-ink-850 p-1">
          {(
            [
              { value: "email", label: "Identifiant de service" },
              { value: "badge", label: "Numéro de badge" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={mode === opt.value}
              onClick={() => setMode(opt.value)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                mode === opt.value
                  ? "bg-badge-600 text-white shadow-sm shadow-badge-600/30"
                  : "text-mist-400 hover:text-mist-100",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {mode === "email" ? (
          <Field label="Identifiant de service">
            <Input
              key="email"
              name="email"
              type="text"
              autoComplete="username"
              placeholder="prenom.nom@lspd.core"
              required
            />
          </Field>
        ) : (
          <Field label="Numéro de badge">
            <Input
              key="badge"
              name="email"
              type="text"
              inputMode="numeric"
              autoComplete="username"
              placeholder="00000"
              required
            />
          </Field>
        )}

        <Field label="Mot de passe">
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••"
            required
          />
        </Field>

        {state?.error ? (
          <p
            role="alert"
            className="rounded-lg border border-alert-500/40 bg-alert-600/15 px-3.5 py-2.5 text-xs text-alert-500"
          >
            {state.error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Vérification…" : "Se connecter"}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-ink-700" />
        <span className="label-tag">ou</span>
        <span className="h-px flex-1 bg-ink-700" />
      </div>

      {discordEnabled ? (
        <Button
          variant="discord"
          className="w-full"
          onClick={() => {
            window.location.href = "/api/auth/discord";
          }}
        >
          Se connecter avec Discord
          <DiscordLogo className="h-4 w-4" />
        </Button>
      ) : (
        <div className="space-y-2">
          <Button variant="discord" className="w-full" disabled>
            Se connecter avec Discord
            <DiscordLogo className="h-4 w-4" />
          </Button>
          <p className="text-center text-xs text-mist-500">
            Connexion Discord non configurée — voir DEPLOIEMENT.md
          </p>
        </div>
      )}
    </div>
  );
}
