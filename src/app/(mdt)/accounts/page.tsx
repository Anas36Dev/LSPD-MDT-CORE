import type { Metadata } from "next";
import Link from "next/link";
import { UserCog, UserPlus } from "lucide-react";

import { AgentAvatar } from "@/components/agent-avatar";
import { Badge, Panel } from "@/components/ui";
import { ACCOUNT_STATUS_MAP } from "@/lib/account-status";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Gestion des comptes" };

export default async function AccountsPage() {
  const user = await requireModule("accounts");

  const agents = await db.user.findMany({
    orderBy: [{ rank: { level: "desc" } }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      matricule: true,
      badgeNumber: true,
      status: true,
      isSuperAdmin: true,
      discordId: true,
      manualAvatarUrl: true,
      discordAvatarUrl: true,
      avatarSource: true,
      rank: { select: { name: true, level: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">
            Gestion des comptes
          </h1>
          <p className="mt-1 text-sm text-mist-500">
            {agents.length} comptes
          </p>
        </div>

        <Link
          href="/accounts/new"
          className="inline-flex items-center gap-2 rounded-lg border border-badge-500/60 bg-badge-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-badge-500"
        >
          <UserPlus className="h-4 w-4" />
          Créer un compte
        </Link>
      </div>

      <Panel>
        <div className="flex items-center justify-between gap-4 border-b border-ink-700 bg-ink-850/40 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <UserCog className="h-4 w-4 text-badge-300" />
            <h2 className="text-xs font-semibold tracking-wider text-mist-300 uppercase">
              Comptes agents
            </h2>
          </div>
          <span className="inline-flex items-baseline gap-1.5">
            <span className="text-lg font-semibold text-mist-100">
              {agents.length}
            </span>
            <span className="text-xs text-mist-500">compte(s)</span>
          </span>
        </div>
        <ul className="divide-y divide-ink-700">
          {agents.map((a) => {
            const status =
              ACCOUNT_STATUS_MAP[a.status] ?? ACCOUNT_STATUS_MAP.ACTIVE;
            const manageable =
              user.isSuperAdmin ||
              (!a.isSuperAdmin && a.rank.level < user.rank.level);

            return (
              <li key={a.id}>
                <Link
                  href={`/accounts/${a.id}`}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-ink-800/60"
                >
                  <AgentAvatar agent={a} className="h-10 w-10" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-mist-100">
                        {a.firstName} {a.lastName}
                      </p>
                      {a.isSuperAdmin ? (
                        <Badge tone="gold">SUPERADMIN</Badge>
                      ) : null}
                      {!manageable ? (
                        <Badge tone="neutral">Lecture seule</Badge>
                      ) : null}
                    </div>
                    <p className="font-mono text-xs text-mist-500">{a.email}</p>
                  </div>

                  <div className="hidden text-right sm:block">
                    <p className="text-sm text-mist-300">{a.rank.name}</p>
                    <p className="text-xs text-mist-500">
                      matricule {a.matricule} · badge #{a.badgeNumber}
                    </p>
                  </div>

                  {a.discordId ? (
                    <Badge tone="blue">Discord</Badge>
                  ) : (
                    <Badge tone="neutral">Sans Discord</Badge>
                  )}

                  <Badge tone={status.tone}>{status.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>

      {!can.suspendAccount(user) ? (
        <p className="text-xs text-mist-500">
          Votre grade vous permet de créer des comptes, mais la suspension et la
          radiation sont réservées au grade d&apos;Assistant Chief et au-dessus.
        </p>
      ) : null}
    </div>
  );
}
