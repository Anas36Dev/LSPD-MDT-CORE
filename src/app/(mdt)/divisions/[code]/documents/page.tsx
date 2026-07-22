import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FileStack, X } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import {
  canManageDivisionDocs,
  canViewDivisionSpace,
} from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { DivisionDocumentForm } from "./forms";
import { deleteDivisionDocument } from "./actions";

export const metadata: Metadata = { title: "Documents de division" };

export default async function DivisionDocumentsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();

  const user = await requireUser();
  if (!canViewDivisionSpace(user, code)) {
    redirect("/dashboard?denied=" + code.toLowerCase() + "-documents");
  }

  const division = await db.division.findUnique({
    where: { code },
    include: { subDivisions: { orderBy: { order: "asc" } } },
  });
  if (!division) notFound();

  const documents = await db.divisionDocument.findMany({
    where: { divisionId: division.id },
    orderBy: { createdAt: "desc" },
    include: {
      subDivision: { select: { name: true, code: true } },
      author: { select: { firstName: true, lastName: true } },
    },
  });

  const canManage = canManageDivisionDocs(user, code);

  // Un membre voit les documents adressés à toute la division, plus ceux de ses
  // pelotons. Chefs, instructeurs et Command Staff voient tout.
  const visible = documents.filter(
    (d) =>
      canManage ||
      d.subDivision === null ||
      user.subDivisionCodes.includes(d.subDivision.code),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          {division.name} — Documents
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          Notes de service et supports diffusés au sein de la division.
        </p>
      </div>

      <Panel>
        <PanelHeader
          title="Documents diffusés"
          subtitle={`${visible.length} document(s)`}
        />
        {visible.length === 0 ? (
          <EmptyState
            title="Aucun document"
            description="Les documents diffusés dans la division apparaîtront ici."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {visible.map((d) => (
              <li key={d.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <FileStack className="h-4 w-4 shrink-0 text-mist-500" />
                  <p className="text-sm font-medium text-mist-100">{d.title}</p>
                  {d.subDivision ? (
                    <Badge tone="blue">{d.subDivision.name}</Badge>
                  ) : (
                    <Badge tone="neutral">Toute la division</Badge>
                  )}
                  <span className="ml-auto text-xs text-mist-500">
                    {d.author.firstName} {d.author.lastName} · {formatDate(d.createdAt)}
                  </span>
                  {canManage ? (
                    <form action={deleteDivisionDocument}>
                      <input type="hidden" name="code" value={code} />
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

      {canManage ? (
        <DivisionDocumentForm
          code={code}
          subDivisions={division.subDivisions.map((s) => ({
            id: s.id,
            name: s.name,
          }))}
        />
      ) : null}
    </div>
  );
}
