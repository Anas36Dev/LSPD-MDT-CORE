import type { Metadata } from "next";
import Link from "next/link";
import { FolderLock, Fingerprint, Images } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { formatDate } from "@/lib/utils";
import { CreateFolderForm } from "./forms";

export const metadata: Metadata = { title: "Preuves" };

export default async function EvidencePage() {
  await requireModule("evidence");

  const folders = await db.evidenceFolder.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      author: { select: { firstName: true, lastName: true } },
      investigation: { select: { reference: true } },
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">Preuves</h1>
        <p className="mt-1 text-sm text-mist-500">
          Dossiers de preuves regroupant captures et liens, rattachables à une
          enquête par le Bureau des détectives.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Dossiers de preuves"
            subtitle={`${folders.length} dossier(s)`}
          />
          {folders.length === 0 ? (
            <EmptyState
              title="Aucun dossier"
              description="Créez un premier dossier de preuves pour y regrouper des pièces."
            />
          ) : (
            <ul className="divide-y divide-ink-700">
              {folders.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/evidence/${f.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-800/60"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-600 bg-ink-850 text-mist-400">
                      <FolderLock className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-mist-100">
                        {f.title}
                      </p>
                      <p className="text-xs text-mist-500">
                        {f.reference} · {f.author.firstName} {f.author.lastName}{" "}
                        · {formatDate(f.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {f.investigation ? (
                        <Badge tone="blue">
                          <Fingerprint className="h-3 w-3" />
                          {f.investigation.reference}
                        </Badge>
                      ) : null}
                      <Badge tone="neutral">
                        <Images className="h-3 w-3" />
                        {f._count.items}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="self-start">
          <PanelHeader
            title="Nouveau dossier"
            subtitle="Regrouper des preuves"
          />
          <CreateFolderForm />
        </Panel>
      </div>
    </div>
  );
}
