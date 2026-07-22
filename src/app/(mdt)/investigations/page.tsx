import type { Metadata } from "next";
import Link from "next/link";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { formatDate } from "@/lib/utils";
import { CreateInvestigationForm } from "./forms";

export const metadata: Metadata = { title: "Enquêtes" };

export const INV_STATUS: Record<
  string,
  { label: string; tone: "neutral" | "blue" | "amber" | "green" }
> = {
  OPEN: { label: "Ouverte", tone: "blue" },
  ACTIVE: { label: "En cours", tone: "amber" },
  CLOSED: { label: "Clôturée", tone: "green" },
  ARCHIVED: { label: "Archivée", tone: "neutral" },
};

export default async function InvestigationsPage() {
  await requireModule("investigations");

  const investigations = await db.investigation.findMany({
    orderBy: [{ closedAt: "asc" }, { createdAt: "desc" }],
    include: {
      lead: { select: { firstName: true, lastName: true } },
      _count: { select: { notes: true, reports: true } },
    },
  });

  const active = investigations.filter((i) => !i.closedAt).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">Enquêtes</h1>
        <p className="mt-1 text-sm text-mist-500">
          Dossiers d&apos;enquête du Detective Bureau.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel className="px-5 py-4">
          <p className="label-tag">Enquêtes actives</p>
          <p className="mt-1 text-2xl font-semibold text-mist-100">{active}</p>
        </Panel>
        <Panel className="px-5 py-4">
          <p className="label-tag">Total</p>
          <p className="mt-1 text-2xl font-semibold text-mist-100">
            {investigations.length}
          </p>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Dossiers d'enquête"
          subtitle={`${investigations.length} enquête(s)`}
        />
        {investigations.length === 0 ? (
          <EmptyState
            title="Aucune enquête"
            description="Ouvrez la première enquête du Detective Bureau."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {investigations.map((i) => {
              const s = INV_STATUS[i.status] ?? INV_STATUS.OPEN;
              return (
                <li key={i.id}>
                  <Link
                    href={`/investigations/${i.id}`}
                    className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-800/60"
                  >
                    <span className="w-32 shrink-0 font-mono text-xs text-badge-300">
                      {i.reference}
                    </span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-mist-100">
                      {i.title}
                    </span>
                    <span className="text-xs text-mist-500">
                      {i._count.reports} rapport(s) · {i._count.notes} note(s)
                    </span>
                    <span className="text-xs text-mist-500">
                      {i.lead.firstName} {i.lead.lastName} · {formatDate(i.createdAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel className="border-badge-500/30">
        <PanelHeader
          title="Ouvrir une enquête"
          subtitle="Créer un nouveau dossier d'enquête"
        />
        <CreateInvestigationForm />
      </Panel>
    </div>
  );
}
