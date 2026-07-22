import type { Metadata } from "next";
import Link from "next/link";
import { LayoutTemplate, Plus } from "lucide-react";

import { Badge, Panel } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";

export const metadata: Metadata = { title: "Templates de rapports" };

export default async function TemplatesPage() {
  await requireModule("templates");

  const templates = await db.reportTemplate.findMany({
    orderBy: { order: "asc" },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
      _count: { select: { reports: true, versions: true } },
    },
  });

  const ranks = await db.rank.findMany({ select: { name: true, level: true } });
  const rankName = (level: number) =>
    ranks.find((r) => r.level === level)?.name ?? `niveau ${level}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">
            Templates de rapports
          </h1>
          <p className="mt-1 text-sm text-mist-500">
            Modèles utilisés par les agents pour rédiger leurs rapports
          </p>
        </div>

        <Link
          href="/templates/new"
          className="inline-flex items-center gap-2 rounded-lg border border-badge-500/60 bg-badge-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-badge-500"
        >
          <Plus className="h-4 w-4" />
          Nouveau modèle
        </Link>
      </div>

      <Panel>
        <div className="flex items-center justify-between gap-4 border-b border-ink-700 bg-ink-850/40 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <LayoutTemplate className="h-4 w-4 text-badge-300" />
            <h2 className="text-xs font-semibold tracking-wider text-mist-300 uppercase">
              Modèles du département
            </h2>
          </div>
          <span className="inline-flex items-baseline gap-1.5">
            <span className="text-lg font-semibold text-mist-100">
              {templates.length}
            </span>
            <span className="text-xs text-mist-500">modèle(s)</span>
          </span>
        </div>
        <ul className="divide-y divide-ink-700">
          {templates.map((t) => (
            <li key={t.id}>
              <Link
                href={`/templates/${t.id}`}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-ink-800/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-mist-100">
                      {t.name}
                    </p>
                    {t.category === "COMPLAINT" ? (
                      <Badge tone="gold">Plainte</Badge>
                    ) : null}
                    {!t.isActive ? (
                      <Badge tone="neutral">Désactivé</Badge>
                    ) : null}
                  </div>
                  {t.description ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-mist-500">
                      {t.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-mist-500">
                    À partir de {rankName(t.minRankLevel)} ·{" "}
                    {t._count.reports} rapport(s) rédigé(s)
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {t.requiresValidation ? (
                    <Badge tone="amber">Validation</Badge>
                  ) : (
                    <Badge tone="green">Directe</Badge>
                  )}
                  <Badge tone="blue">
                    v{t.versions[0]?.version ?? 0}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
