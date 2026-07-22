import type { Metadata } from "next";
import Link from "next/link";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { canManagePromotions, SWORN_LEVEL } from "@/lib/permissions";
import { AssignPromotionForm, PromotionManager } from "./forms";

export const metadata: Metadata = { title: "Supervision de l'académie" };

export default async function AcademySupervisionPage() {
  const user = await requireModule("academy-supervision");
  const canManage = canManagePromotions(user);

  const promotions = await db.academyPromotion.findMany({
    orderBy: { name: "asc" },
  });
  const promotionNames = promotions.map((p) => p.name);

  // Les Rookies sont dérivés du grade : tout agent sous le seuil d'assermentation.
  const rookies = await db.user.findMany({
    where: {
      isSuperAdmin: false,
      rank: { level: { lt: SWORN_LEVEL }, code: { not: "DOJ" } },
    },
    orderBy: [{ promotion: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      badgeNumber: true,
      promotion: true,
      recruitmentSession: true,
      examsTaken: {
        orderBy: { examinedAt: "desc" },
        take: 1,
        select: { percentage: true, passed: true },
      },
      _count: { select: { evaluationsGot: true } },
    },
  });

  // Regroupement par promotion académique.
  const groups = new Map<string, typeof rookies>();
  for (const r of rookies) {
    const key = r.promotion?.trim() || "Sans promotion";
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          Supervision de l&apos;académie
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          Rookies en formations.
        </p>
      </div>

      {canManage ? (
        <Panel>
          <PanelHeader
            title="Promotions académiques"
            subtitle="Créez et gérez une promotion et affectez ensuite les recrues."
          />
          <PromotionManager
            promotions={promotions.map((p) => ({ id: p.id, name: p.name }))}
          />
        </Panel>
      ) : null}

      {rookies.length === 0 ? (
        <EmptyState
          title="Aucun Rookie"
          description="Aucune recrue n'est actuellement à l'académie."
        />
      ) : (
        [...groups.entries()].map(([promotion, list]) => (
          <Panel key={promotion}>
            <PanelHeader
              title={promotion}
              subtitle={`${list.length} recrue(s)`}
            />
            <ul className="divide-y divide-ink-700">
              {list.map((r) => {
                const exam = r.examsTaken[0];
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-800/40"
                  >
                    <Link
                      href={`/academy/supervision/${r.id}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium text-mist-100 hover:text-badge-300"
                    >
                      {r.firstName} {r.lastName}
                    </Link>
                    {r.recruitmentSession ? (
                      <Badge tone="neutral">{r.recruitmentSession}</Badge>
                    ) : null}
                    <span className="text-xs text-mist-500">
                      {r._count.evaluationsGot} observation(s)
                    </span>
                    {exam ? (
                      <Badge tone={exam.passed ? "green" : "red"}>
                        {exam.percentage}% · {exam.passed ? "Admis" : "Ajourné"}
                      </Badge>
                    ) : (
                      <Badge tone="amber">Non évalué</Badge>
                    )}
                    <AssignPromotionForm
                      rookieId={r.id}
                      current={r.promotion}
                      promotions={promotionNames}
                    />
                    <span className="font-mono text-xs text-mist-500">
                      #{r.badgeNumber}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ))
      )}
    </div>
  );
}
