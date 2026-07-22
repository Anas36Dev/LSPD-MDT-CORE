import type { Metadata } from "next";
import Link from "next/link";
import { Skull } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { formatDate } from "@/lib/utils";
import { CreateFactionForm } from "./forms";

export const metadata: Metadata = { title: "Groupuscules" };

export const FACTION_STATUS: Record<
  string,
  { label: string; tone: "neutral" | "blue" | "amber" | "green" | "red" }
> = {
  ACTIVE: { label: "Actif", tone: "red" },
  WATCHED: { label: "Sous surveillance", tone: "amber" },
  DISMANTLED: { label: "Démantelé", tone: "green" },
};

export default async function FactionsPage() {
  await requireModule("factions");

  const factions = await db.faction.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      _count: {
        select: {
          notes: true,
          reports: true,
          investigations: true,
          civilians: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">Groupuscules</h1>
        <p className="mt-1 text-sm text-mist-500">
          Groupes revendiqués en ville.
        </p>
      </div>

      <Panel>
        <PanelHeader
          title="Groupuscules recensés"
          subtitle={`${factions.length} groupe(s)`}
        />
        {factions.length === 0 ? (
          <EmptyState
            title="Aucun groupuscule"
            description="Recensez le premier groupe revendiqué en ville."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {factions.map((f) => {
              const s = FACTION_STATUS[f.status] ?? FACTION_STATUS.ACTIVE;
              return (
                <li key={f.id}>
                  <Link
                    href={`/factions/${f.id}`}
                    className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-800/60"
                  >
                    <Skull className="h-4 w-4 shrink-0 text-mist-500" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-mist-100">
                      {f.name}
                    </span>
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <span className="text-xs text-mist-500">
                      {f._count.civilians} civil(s) · {f._count.investigations}{" "}
                      enquête(s) · {f._count.reports} rapport(s)
                    </span>
                    <span className="text-xs text-mist-500">
                      {f.createdBy
                        ? `${f.createdBy.firstName} ${f.createdBy.lastName} · `
                        : ""}
                      {formatDate(f.createdAt)}
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
          title="Recenser un groupuscule"
          subtitle="Créer une nouvelle fiche de groupe"
        />
        <CreateFactionForm />
      </Panel>
    </div>
  );
}
