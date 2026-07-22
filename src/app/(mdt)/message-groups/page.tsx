import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";

import { EmptyState, Panel } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { accessibleChannels } from "@/lib/message-channels";
import { isCommandStaff } from "@/lib/permissions";
import { ChannelCreator } from "./create-channel-form";
import { DeleteChannelButton } from "./delete-channel-button";

export const metadata: Metadata = { title: "Groupes de messages" };

export default async function MessageGroupsPage() {
  const user = await requireModule("message-groups");
  const channels = await accessibleChannels(user);
  const canManage = isCommandStaff(user);

  const [ranks, divisions, certifications, members] = canManage
    ? await Promise.all([
        db.rank.findMany({
          orderBy: { level: "desc" },
          select: { code: true, name: true, category: true },
        }),
        db.division.findMany({
          orderBy: { order: "asc" },
          select: { code: true, name: true },
        }),
        db.certification.findMany({
          // On ne propose que les accréditations/habilitations utiles pour des
          // groupes (pas les CCW/PPA ni la Lincoln Patrol).
          where: { category: { notIn: ["PPA", "PATROL"] } },
          orderBy: { order: "asc" },
          select: { code: true, name: true },
        }),
        db.user.findMany({
          where: {
            isSuperAdmin: false,
            status: "ACTIVE",
            rank: { code: { not: "DOJ" } },
          },
          orderBy: [{ rank: { level: "desc" } }, { lastName: "asc" }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            badgeNumber: true,
            rank: { select: { name: true } },
          },
        }),
      ])
    : [[], [], [], []];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">
            Groupes de messages
          </h1>
          <p className="mt-1 text-sm text-mist-500">Canaux de discussion</p>
        </div>
        {canManage ? (
          <ChannelCreator
            ranks={ranks}
            divisions={divisions}
            certifications={certifications}
            members={members.map((m) => ({
              id: m.id,
              label: `${m.rank.name} ${m.firstName} ${m.lastName} #${m.badgeNumber}`,
            }))}
          />
        ) : null}
      </div>

      <Panel>
        <div className="flex items-center justify-between gap-4 border-b border-ink-700 bg-ink-850/40 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <MessagesSquare className="h-4 w-4 text-badge-300" />
            <h2 className="text-xs font-semibold tracking-wider text-mist-300 uppercase">
              Vos canaux
            </h2>
          </div>
          <span className="inline-flex items-baseline gap-1.5">
            <span className="text-lg font-semibold text-mist-100">
              {channels.length}
            </span>
            <span className="text-xs text-mist-500">
              {channels.length > 1 ? "canaux" : "canal"}
            </span>
          </span>
        </div>

        {channels.length === 0 ? (
          <EmptyState
            title="Aucun canal"
            description="Votre grade ne donne accès à aucun groupe de discussion."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {channels.map((ch) => (
              <li key={ch.key} className="flex items-center">
                <Link
                  href={`/message-groups/${ch.key}`}
                  className="flex min-w-0 flex-1 items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-800/60"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ink-600 bg-ink-850 text-badge-300">
                    <MessagesSquare className="h-5 w-5" />
                  </span>
                  <p className="min-w-0 flex-1 text-sm font-medium text-mist-100">
                    {ch.name}
                  </p>
                </Link>
                {canManage && ch.id ? (
                  <div className="px-4">
                    <DeleteChannelButton id={ch.id} name={ch.name} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
