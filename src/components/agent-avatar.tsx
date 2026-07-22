import { cn, initials } from "@/lib/utils";

export type AvatarAgent = {
  firstName: string;
  lastName: string;
  manualAvatarUrl?: string | null;
  discordAvatarUrl?: string | null;
  avatarSource?: "DISCORD" | "MANUAL";
};

/**
 * Photo de profil d'un agent.
 *
 * Priorité : avatar imposé par un superviseur > avatar Discord > initiales.
 * On utilise `<img>` et non `next/image` car les avatars Discord proviennent
 * d'un CDN externe et changent à chaque connexion — l'optimisation d'image
 * serait inutile et imposerait de déclarer le domaine dans next.config.
 */
export function AgentAvatar({
  agent,
  className,
}: {
  agent: AvatarAgent;
  className?: string;
}) {
  const url =
    agent.avatarSource === "MANUAL" && agent.manualAvatarUrl
      ? agent.manualAvatarUrl
      : (agent.manualAvatarUrl ?? agent.discordAvatarUrl);

  const base = cn(
    "shrink-0 overflow-hidden rounded-full border border-ink-600 bg-ink-800 object-cover",
    className,
  );

  if (url) {
    return (
      <img
        src={url}
        alt={`${agent.firstName} ${agent.lastName}`}
        className={base}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        base,
        "flex items-center justify-center text-xs font-semibold text-mist-300",
      )}
    >
      {initials(agent.firstName, agent.lastName)}
    </span>
  );
}
