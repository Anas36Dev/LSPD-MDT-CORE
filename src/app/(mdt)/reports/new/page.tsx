import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";

export const metadata: Metadata = { title: "Nouveau rapport" };

export default async function NewReportPage() {
  const user = await requireModule("reports");

  // Un template dont le grade minimum dépasse celui de l'agent n'est pas
  // proposé : inutile de laisser commencer une rédaction qui sera refusée.
  const templates = await db.reportTemplate.findMany({
    where: {
      isActive: true,
      category: "REPORT",
      ...(user.isSuperAdmin ? {} : { minRankLevel: { lte: user.rank.level } }),
      versions: { some: {} },
    },
    orderBy: { order: "asc" },
    include: { _count: { select: { versions: true } } },
  });

  return (
    <div className="space-y-6">
      <Link
        href="/reports"
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux rapports
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          Choisir un type de rapport
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          Chaque modèle est défini par les superviseurs du département
        </p>
      </div>

      {templates.length === 0 ? (
        <Panel>
          <EmptyState
            title="Aucun modèle disponible"
            description="Aucun template de rapport n'est accessible à votre grade."
          />
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((t) => (
            <Link
              key={t.id}
              href={`/reports/new/${t.id}`}
              className="group rounded-xl border border-ink-700 bg-ink-900/80 p-5 transition-colors hover:border-badge-500/50 hover:bg-ink-800/60"
            >
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-badge-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-mist-100">{t.name}</p>
                  {t.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-mist-500">
                      {t.description}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.requiresValidation ? (
                      <Badge tone="amber">Validation requise</Badge>
                    ) : (
                      <Badge tone="green">Sans validation</Badge>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
