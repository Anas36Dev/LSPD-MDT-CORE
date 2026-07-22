import type { Metadata } from "next";
import { FileStack, X } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { canManageAcademyDocs } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { AcademyDocumentForm } from "./forms";
import { deleteAcademyDocument } from "./actions";

export const metadata: Metadata = { title: "Documents d'académie" };

export default async function AcademyDocumentsPage() {
  const user = await requireModule("academy-documents");
  const canManage = canManageAcademyDocs(user);

  const documents = await db.academyDocument.findMany({
    // Les rookies ne voient que les documents ouverts ; instructeurs voient tout.
    where: canManage ? {} : { visibility: "ALL" },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { firstName: true, lastName: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          Documents pédagogiques
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          Supports d'apprentissage de l'Académie de Police.
        </p>
      </div>

      <Panel>
        <PanelHeader
          title="Documents"
          subtitle={`${documents.length} document(s)`}
        />
        {documents.length === 0 ? (
          <EmptyState
            title="Aucun document"
            description="Les supports pédagogiques publiés apparaîtront ici."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {documents.map((d) => (
              <li key={d.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <FileStack className="h-4 w-4 shrink-0 text-mist-500" />
                  <p className="text-sm font-medium text-mist-100">{d.title}</p>
                  {d.visibility === "INSTRUCTORS" ? (
                    <Badge tone="amber">Instructeurs</Badge>
                  ) : (
                    <Badge tone="neutral">Rookies & instructeurs</Badge>
                  )}
                  <span className="ml-auto text-xs text-mist-500">
                    {d.author.firstName} {d.author.lastName} · {formatDate(d.createdAt)}
                  </span>
                  {canManage ? (
                    <form action={deleteAcademyDocument}>
                      <input type="hidden" name="documentId" value={d.id} />
                      <button
                        type="submit"
                        title="Supprimer"
                        className="rounded p-1 text-mist-500 transition-colors hover:text-alert-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </form>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-mist-300">
                  {d.content}
                </p>
                {d.fileUrl ? (
                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs text-badge-300 hover:underline"
                  >
                    Ouvrir le document joint →
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {canManage ? <AcademyDocumentForm /> : null}
    </div>
  );
}
