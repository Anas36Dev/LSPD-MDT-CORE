import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EmptyState } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { canSuperviseDivisionSpace } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { AgentSupervisionCard, type SupervisedAgent } from "./forms";

export const metadata: Metadata = { title: "Supervision de la division" };

export default async function DivisionSupervisionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();

  const user = await requireUser();
  if (!canSuperviseDivisionSpace(user, code)) {
    redirect("/dashboard?denied=" + code.toLowerCase() + "-supervision");
  }

  const division = await db.division.findUnique({ where: { code } });
  if (!division) notFound();

  const agents = await db.user.findMany({
    where: {
      isSuperAdmin: false,
      divisions: { some: { divisionId: division.id } },
    },
    orderBy: [{ rank: { order: "asc" } }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      badgeNumber: true,
      rank: { select: { name: true } },
      _count: { select: { authoredReports: true, investigationsLed: true } },
    },
  });

  // Le Bureau des détectives affiche en plus le nombre d'enquêtes par agent.
  const isBureau = code === "DB";

  const notes = await db.agentNote.findMany({
    where: {
      divisionCode: code,
      subjectId: { in: agents.map((a) => a.id) },
    },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { firstName: true, lastName: true } } },
  });

  const notesByAgent = new Map<number, typeof notes>();
  for (const n of notes) {
    const list = notesByAgent.get(n.subjectId) ?? [];
    list.push(n);
    notesByAgent.set(n.subjectId, list);
  }

  const view: SupervisedAgent[] = agents.map((a) => ({
    id: a.id,
    name: `${a.firstName} ${a.lastName}`,
    rank: a.rank.name,
    badge: a.badgeNumber,
    reportCount: a._count.authoredReports,
    investigationCount: a._count.investigationsLed,
    notes: (notesByAgent.get(a.id) ?? []).map((n) => ({
      id: n.id,
      body: n.body,
      author: `${n.author.firstName} ${n.author.lastName}`,
      date: formatDateTime(n.createdAt),
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          {division.name} — Supervision
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          Effectif de la division.
        </p>
      </div>

      {view.length === 0 ? (
        <EmptyState
          title="Aucun agent"
          description="Aucun agent n'est affecté à cette division."
        />
      ) : (
        <div className="space-y-3">
          {view.map((a) => (
            <AgentSupervisionCard
              key={a.id}
              code={code}
              agent={a}
              showInvestigations={isBureau}
            />
          ))}
        </div>
      )}
    </div>
  );
}
