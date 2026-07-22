import { after } from "next/server";
import Link from "next/link";
import { Bell, Eye, LogOut, MessageSquarePlus } from "lucide-react";

import { AgentAvatar } from "@/components/agent-avatar";
import { DutyHeartbeat } from "@/components/duty-heartbeat";
import { Sidebar } from "@/components/layout/sidebar";
import { Badge } from "@/components/ui";
import { findLogo } from "@/lib/brand";
import { db } from "@/lib/db";
import {
  syncDiscordAvatar,
  syncStaleDiscordAvatars,
} from "@/lib/discord-sync";
import { dutyIsOn } from "@/lib/duty";
import { requireUser } from "@/lib/guard";
import {
  isAcademyTrainee,
  isDepartmentHead,
  isPreviewing,
  MODULE_GROUPS,
  navItemsFor,
  primaryDivision,
  RANK,
} from "@/lib/permissions";
import { logout } from "./actions";
import { stopPreview } from "./preview/actions";

export default async function MdtLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // Rafraîchissement automatique des photos de profil Discord, après la réponse
  // (jamais bloquant) : d'abord l'agent courant pour un retour immédiat, puis un
  // petit lot du reste de l'effectif afin qu'à terme tout le monde soit à jour.
  after(async () => {
    await syncDiscordAvatar(user.id);
    await syncStaleDiscordAvatars();
  });

  const onDuty = await dutyIsOn(user.id);
  const unreadNotifications = await db.notification.count({
    where: { userId: user.id, readAt: null },
  });

  // Le menu est construit à partir du même registre que les gardes serveur :
  // un module non autorisé n'est pas rendu du tout.
  const modules = navItemsFor(user);
  const division = primaryDivision(user);

  const avatar = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      firstName: true,
      lastName: true,
      manualAvatarUrl: true,
      discordAvatarUrl: true,
      avatarSource: true,
    },
  });

  const previewing = isPreviewing(user);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar modules={modules} groups={MODULE_GROUPS} logoUrl={findLogo()} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Bandeau d'aperçu : il doit être impossible d'oublier qu'on ne voit
            pas le terminal avec son propre grade. */}
        {previewing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold-500/50 bg-gold-600/15 px-6 py-2.5">
            <div className="flex items-center gap-2.5 text-xs text-gold-400">
              <Eye className="h-4 w-4" />
              <span>
                <span className="font-semibold">Mode aperçu</span> — vous voyez
                le terminal en tant que {user.rank.name}. Aucune modification
                n&apos;est possible.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/preview"
                className="rounded-md border border-gold-500/40 px-2.5 py-1 text-xs text-gold-400 transition-colors hover:bg-gold-600/20"
              >
                Changer de rôle
              </Link>
              <form action={stopPreview}>
                <button
                  type="submit"
                  className="rounded-md border border-gold-500/60 bg-gold-600/20 px-2.5 py-1 text-xs font-medium text-gold-400 transition-colors hover:bg-gold-600/30"
                >
                  Quitter l&apos;aperçu
                </button>
              </form>
            </div>
          </div>
        ) : null}

        <header className="flex items-center justify-between gap-4 border-b border-ink-700 bg-ink-900/50 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-mist-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-ok-500" />
              Terminal en service
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                onDuty
                  ? "border-ok-500/40 bg-ok-500/15 text-ok-500"
                  : "border-ink-600 bg-ink-850 text-mist-400"
              }`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  onDuty ? "bg-ok-500" : "bg-mist-600"
                }`}
              />
              {onDuty ? "En service" : "Hors service"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/feedback"
              title="Envoyer un retour ou une suggestion"
              className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-xs text-mist-300 transition-colors hover:border-badge-500/50 hover:text-badge-300"
            >
              <MessageSquarePlus className="h-4 w-4" />
              Feedback
            </Link>
            <Link
              href="/notifications"
              title="Notifications"
              className="relative inline-flex items-center rounded-lg border border-ink-600 p-2 text-mist-500 transition-colors hover:border-badge-500/50 hover:text-badge-300"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifications > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-alert-600 px-1 text-[0.6rem] font-semibold text-white">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              ) : null}
            </Link>
            {/* Réservé au chef du département, et masqué pendant l'aperçu :
                le bandeau ci-dessus prend alors le relais. */}
            {isDepartmentHead(user) && !previewing ? (
              <Link
                href="/preview"
                title="Voir le terminal sous un autre grade"
                className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-xs text-mist-300 transition-colors hover:border-gold-500/50 hover:text-gold-400"
              >
                <Eye className="h-4 w-4" />
                Aperçu de rôle
              </Link>
            ) : null}
            <Link
              href={`/roster/${user.id}`}
              className="flex items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-ink-800"
            >
              <div className="text-right leading-tight">
                <p className="text-sm font-medium text-mist-100">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-mist-500">
                  {user.rank.name} · #{user.badgeNumber}
                </p>
              </div>
              <AgentAvatar agent={avatar} className="h-9 w-9" />
            </Link>

            {/* Sans division, un agent assermenté n'est pas pour autant à
                l'académie : seul son grade en décide. */}
            {division ? (
              <Badge tone="blue">{division.name}</Badge>
            ) : isAcademyTrainee(user) ? (
              <Badge tone="gold">Académie</Badge>
            ) : user.rank.level >= RANK.CHIEF_OF_POLICE ? (
              <Badge tone="gold">Chef du département</Badge>
            ) : (
              <Badge tone="neutral">Sans affectation</Badge>
            )}

            <form action={logout}>
              <button
                type="submit"
                title="Se déconnecter"
                className="cursor-pointer rounded-lg border border-ink-600 p-2 text-mist-500 transition-colors hover:border-alert-500/50 hover:text-alert-500"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>

      <DutyHeartbeat onDuty={onDuty} />
    </div>
  );
}
