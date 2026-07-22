import type { Metadata } from "next";
import Link from "next/link";

import { ClipboardList } from "lucide-react";

import { AgentAvatar } from "@/components/agent-avatar";
import { Badge, Panel } from "@/components/ui";
import { ACCOUNT_STATUS_MAP } from "@/lib/account-status";
import { db } from "@/lib/db";
import { divisionShortLabel } from "@/lib/division-label";
import { requireModule } from "@/lib/guard";
import { SWORN_LEVEL, yearsOfService } from "@/lib/permissions";

export const metadata: Metadata = { title: "Effectifs" };


export default async function RosterPage() {
  await requireModule("roster");

  const agents = await db.user.findMany({
    // Le Department of Justice n'est pas un agent du LSPD : il figure dans la
    // gestion des comptes, pas dans l'effectif du département.
    where: { isSuperAdmin: false, rank: { code: { not: "DOJ" } } },
    // Ordre protocolaire du département (champ `order`), non par autorité.
    orderBy: [{ rank: { order: "asc" } }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      badgeNumber: true,
      status: true,
      recruitedAt: true,
      manualAvatarUrl: true,
      discordAvatarUrl: true,
      avatarSource: true,
      rank: { select: { name: true, category: true, level: true } },
      divisions: {
        select: { isPrimary: true, division: { select: { code: true } } },
      },
      // Nécessaires pour distinguer FTO et académie au sein de Training.
      divisionRoles: { select: { divisionRole: { select: { code: true } } } },
      subDivisions: { select: { subDivision: { select: { code: true } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          Effectifs du département
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          {agents.length} agents enregistrés.
        </p>
      </div>

      <Panel>
        <div className="flex items-center justify-between gap-4 border-b border-ink-700 bg-ink-850/40 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="h-4 w-4 text-badge-300" />
            <h2 className="text-xs font-semibold tracking-wider text-mist-300 uppercase">
              Annuaire
            </h2>
          </div>
          <span className="inline-flex items-baseline gap-1.5">
            <span className="text-lg font-semibold text-mist-100">
              {agents.length}
            </span>
            <span className="text-xs text-mist-500">agent(s)</span>
          </span>
        </div>
        <ul className="divide-y divide-ink-700">
          {agents.map((a) => {
            const status =
              ACCOUNT_STATUS_MAP[a.status] ?? ACCOUNT_STATUS_MAP.ACTIVE;
            const roleCodes = a.divisionRoles.map((r) => r.divisionRole.code);
            const subCodes = a.subDivisions.map((s) => s.subDivision.code);
            return (
              <li key={a.id}>
                <Link
                  href={`/roster/${a.id}`}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-ink-800/60"
                >
                  <AgentAvatar agent={a} className="h-10 w-10" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-mist-100">
                      {a.firstName} {a.lastName}
                    </p>
                    <p className="text-xs text-mist-500">
                      {a.rank.name} · #{a.badgeNumber} ·{" "}
                      {yearsOfService(a.recruitedAt)} année(s) de service
                    </p>
                  </div>

                  <div className="hidden flex-wrap items-center justify-end gap-1.5 sm:flex">
                    {/* Un Rookie porte un badge d'académie dédié, sans division. */}
                    {a.rank.level < SWORN_LEVEL ? (
                      <Badge tone="gold">RECRUE ACADÉMIQUE</Badge>
                    ) : (
                      a.divisions.map((d) => (
                        <Badge
                          key={d.division.code}
                          tone={d.isPrimary ? "blue" : "neutral"}
                        >
                          {divisionShortLabel(d.division.code, roleCodes, subCodes)}
                        </Badge>
                      ))
                    )}
                  </div>

                  <Badge tone={status.tone}>{status.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
