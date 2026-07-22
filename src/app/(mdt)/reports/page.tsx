import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { atLeast, can, RANK } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Rapports" };

export const STATUS: Record<
  string,
  { label: string; tone: "neutral" | "blue" | "green" | "red" | "amber" }
> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  SUBMITTED: { label: "En validation", tone: "blue" },
  APPROVED: { label: "Validé", tone: "green" },
  REJECTED: { label: "Refusé", tone: "red" },
  CHANGES_REQUESTED: { label: "À corriger", tone: "amber" },
};

export default async function ReportsPage() {
  const user = await requireModule("reports");
  const isReviewer = can.validateReports(user);
  // À partir de Sergeant II, accès à TOUS les rapports de tous les agents.
  const canSeeAll = atLeast(user, RANK.SERGEANT_II);

  // Les plaintes & dépositions ont leur propre onglet : on ne garde ici que les
  // rapports proprement dits (catégorie REPORT du template).
  const reportsOnly = { template: { category: "REPORT" } } as const;

  const [mine, pending, all] = await Promise.all([
    db.report.findMany({
      where: { authorId: user.id, ...reportsOnly },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { template: { select: { name: true } } },
    }),
    isReviewer
      ? db.report.findMany({
          // Un superviseur voit aussi ses propres soumissions : il peut valider
          // son document en signant en tant que superviseur.
          where: { status: "SUBMITTED", ...reportsOnly },
          orderBy: { submittedAt: "asc" },
          include: {
            template: { select: { name: true } },
            author: {
              select: { firstName: true, lastName: true, badgeNumber: true },
            },
          },
        })
      : [],
    canSeeAll
      ? db.report.findMany({
          where: reportsOnly,
          orderBy: { updatedAt: "desc" },
          take: 200,
          include: {
            template: { select: { name: true } },
            author: {
              select: { firstName: true, lastName: true, badgeNumber: true },
            },
          },
        })
      : [],
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">Rapports</h1>
          <p className="mt-1 text-sm text-mist-500">
            Rédaction, soumission et suivi de vos rapports de service
          </p>
        </div>

        <Link
          href="/reports/new"
          className="inline-flex items-center gap-2 rounded-lg border border-badge-500/60 bg-badge-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-badge-500"
        >
          <FilePlus className="h-4 w-4" />
          Nouveau rapport
        </Link>
      </div>

      {isReviewer ? (
        <Panel
          className={
            pending.length > 0 ? "border-badge-500/40" : undefined
          }
        >
          <PanelHeader
            title="En attente de votre validation"
            subtitle="Rapports soumis par les agents"
            action={
              pending.length > 0 ? (
                <Badge tone="blue">{pending.length}</Badge>
              ) : null
            }
          />
          {pending.length === 0 ? (
            <EmptyState
              title="Aucun rapport en attente"
              description="Les rapports soumis par vos agents apparaîtront ici."
            />
          ) : (
            <ul className="divide-y divide-ink-700">
              {pending.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/reports/${r.id}`}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-ink-800/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-mist-100">
                        {r.title}
                      </p>
                      <p className="text-xs text-mist-500">
                        {r.template.name} · {r.reference} · {r.author.firstName}{" "}
                        {r.author.lastName} #{r.author.badgeNumber}
                      </p>
                    </div>
                    <span className="hidden text-xs text-mist-500 sm:block">
                      {r.submittedAt ? formatDateTime(r.submittedAt) : ""}
                    </span>
                    <Badge tone="blue">À valider</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title="Mes rapports"
          subtitle={`${mine.length} rapport(s)`}
        />
        {mine.length === 0 ? (
          <EmptyState
            title="Aucun rapport"
            description="Commencez par rédiger votre premier rapport de service."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {mine.map((r) => {
              const s = STATUS[r.status] ?? STATUS.DRAFT;
              return (
                <li key={r.id}>
                  <Link
                    href={`/reports/${r.id}`}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-ink-800/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-mist-100">
                        {r.title}
                      </p>
                      <p className="text-xs text-mist-500">
                        {r.template.name} · {r.reference}
                      </p>
                    </div>
                    <span className="hidden text-xs text-mist-500 sm:block">
                      {formatDateTime(r.updatedAt)}
                    </span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {canSeeAll ? (
        <Panel>
          <PanelHeader
            title="Tous les rapports"
            action={<Badge tone="neutral">{all.length}</Badge>}
          />
          {all.length === 0 ? (
            <EmptyState
              title="Aucun rapport"
              description="Aucun rapport n'a encore été rédigé dans le département."
            />
          ) : (
            <ul className="divide-y divide-ink-700">
              {all.map((r) => {
                const s = STATUS[r.status] ?? STATUS.DRAFT;
                return (
                  <li key={r.id}>
                    <Link
                      href={`/reports/${r.id}`}
                      className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-ink-800/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-mist-100">
                          {r.title}
                        </p>
                        <p className="text-xs text-mist-500">
                          {r.template.name} · {r.reference} · {r.author.firstName}{" "}
                          {r.author.lastName} #{r.author.badgeNumber}
                        </p>
                      </div>
                      <span className="hidden text-xs text-mist-500 sm:block">
                        {formatDateTime(r.updatedAt)}
                      </span>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
