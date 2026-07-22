import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Users, ShieldCheck } from "lucide-react";

import { Badge, Panel } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { can, isSworn } from "@/lib/permissions";
import { DispatchBoard, type AgentCard } from "./board";
import { PatrolButton } from "./forms";

export const metadata: Metadata = { title: "Dispatch" };

const avatarOf = (u: {
  manualAvatarUrl: string | null;
  discordAvatarUrl: string | null;
  avatarSource: string;
}) =>
  u.avatarSource === "MANUAL" && u.manualAvatarUrl
    ? u.manualAvatarUrl
    : (u.manualAvatarUrl ?? u.discordAvatarUrl);

export default async function DispatchPage() {
  const user = await requireModule("dispatch");
  const canManage = can.manageDispatch(user);

  const [agents, patrols, callSigns] = await Promise.all([
    // Tout l'effectif actif figure au tableau ; le statut de service n'existe
    // plus, une carte est soit dans le pool, soit dans une patrouille.
    db.user.findMany({
      // Le DOJ, extérieur au LSPD, n'est pas dispatchable.
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
        manualAvatarUrl: true,
        discordAvatarUrl: true,
        avatarSource: true,
        rank: { select: { name: true } },
        patrolMembership: { select: { patrolId: true, isLead: true } },
      },
    }),
    db.patrol.findMany({
      orderBy: [{ order: "asc" }, { callSign: "asc" }, { number: "asc" }],
      include: {
        members: {
          orderBy: { isLead: "desc" },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                badgeNumber: true,
                manualAvatarUrl: true,
                discordAvatarUrl: true,
                avatarSource: true,
                rank: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    db.radioCode.findMany({
      where: { category: "CALL_SIGN" },
      orderBy: { order: "asc" },
    }),
  ]);

  const toCard = (
    u: {
      id: number;
      firstName: string;
      lastName: string;
      badgeNumber: string;
      manualAvatarUrl: string | null;
      discordAvatarUrl: string | null;
      avatarSource: string;
      rank: { name: string };
    },
    isLead = false,
  ): AgentCard => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    badgeNumber: u.badgeNumber,
    rankName: u.rank.name,
    isLead,
    avatarUrl: avatarOf(u),
  });

  // Tout agent actif non affecté figure dans le pool, quel que soit son
  // statut de service : celui-ci n'est qu'une étiquette sur sa carte.
  const pool = agents
    .filter((u) => u.patrolMembership === null)
    .map((u) => toCard(u));

  const board = patrols.map((p) => ({
    id: p.id,
    callSign: p.callSign,
    number: p.number,
    status: p.status,
    sector: p.sector,
    createdById: p.createdById,
    members: p.members.map((m) => toCard(m.user, m.isLead)),
  }));

  const assigned = board.reduce((s, p) => s + p.members.length, 0);

  // À partir de Police Officer I, un agent non affecté peut créer sa patrouille.
  const currentInPatrol = board.some((p) =>
    p.members.some((m) => m.id === user.id),
  );
  const canCreatePatrol = canManage || (isSworn(user) && !currentInPatrol);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">
            Dispatch
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-mist-500">
            Affectation des agents en patrouille.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreatePatrol ? (
            <PatrolButton
              label={canManage ? "Créer une patrouille" : "Créer ma patrouille"}
              hint={
                canManage
                  ? undefined
                  : "Vous serez placé chef de bord. Une seule patrouille à la fois."
              }
              callSigns={callSigns.map((c) => ({
                code: c.code.toUpperCase(),
                label: c.label,
              }))}
            />
          ) : null}
          <Badge tone={canManage ? "gold" : "blue"}>
            {canManage ? "Dispatch" : "Agent"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <StatTile
          label="Agents en patrouille"
          value={`${assigned}/${agents.length}`}
          icon={<Users className="h-5 w-5" />}
        />
        <StatTile
          label="Patrouilles actives"
          value={board.length}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="green"
        />
      </div>

      <DispatchBoard
        pool={pool}
        patrols={board}
        currentUserId={user.id}
        canManage={canManage}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  tone = "blue",
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone?: "blue" | "green";
}) {
  return (
    <Panel className="flex items-center gap-4 px-5 py-4">
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
          tone === "green"
            ? "border-ok-500/40 bg-ok-500/10 text-ok-500"
            : "border-ink-700 bg-ink-850 text-badge-300"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="label-tag">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold text-mist-100">{value}</p>
      </div>
    </Panel>
  );
}
