import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Fingerprint } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { canAccessInvestigations } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import {
  AddEvidenceForm,
  DeleteFolderButton,
  DeleteItemButton,
  LinkInvestigationForm,
} from "../forms";

export const metadata: Metadata = { title: "Dossier de preuves" };

export default async function EvidenceFolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("evidence");
  const { id } = await params;
  const folderId = Number(id);

  const folder = await db.evidenceFolder.findUnique({
    where: { id: folderId },
    include: {
      author: { select: { firstName: true, lastName: true } },
      investigation: { select: { id: true, reference: true, title: true } },
      items: {
        orderBy: { createdAt: "asc" },
        include: { addedBy: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!folder) notFound();

  const canLink = canAccessInvestigations(user);
  const canDeleteFolder = folder.authorId === user.id || user.isSuperAdmin;

  const investigations = canLink
    ? await db.investigation.findMany({
        where: { status: { not: "ARCHIVED" } },
        orderBy: { createdAt: "desc" },
        select: { id: true, reference: true, title: true },
        take: 200,
      })
    : [];

  return (
    <div className="space-y-6">
      <Link
        href="/evidence"
        className="inline-flex items-center gap-1.5 text-xs text-mist-500 transition-colors hover:text-mist-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour aux dossiers
      </Link>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-mist-100">
                {folder.title}
              </h1>
              {folder.investigation ? (
                <Badge tone="blue">
                  <Fingerprint className="h-3 w-3" />
                  {folder.investigation.reference}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-mist-500">
              {folder.reference} · {folder.author.firstName}{" "}
              {folder.author.lastName} · {formatDateTime(folder.createdAt)}
            </p>
            {folder.description ? (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist-300">
                {folder.description}
              </p>
            ) : null}
          </div>
          {canDeleteFolder ? <DeleteFolderButton folderId={folder.id} /> : null}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Pièces"
            subtitle={`${folder.items.length} pièce(s)`}
          />
          {folder.items.length === 0 ? (
            <EmptyState
              title="Aucune pièce"
              description="Collez une capture ou ajoutez un lien pour constituer ce dossier."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-3">
              {folder.items.map((item) => (
                <figure
                  key={item.id}
                  className="group relative overflow-hidden rounded-lg border border-ink-600 bg-ink-850"
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.caption ?? "Preuve"}
                      className="aspect-square w-full bg-ink-900 object-cover"
                    />
                  </a>
                  <div className="absolute right-1.5 top-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      title="Ouvrir en grand"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink-900/80 text-mist-300 hover:text-badge-300"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <DeleteItemButton itemId={item.id} />
                  </div>
                  <figcaption className="px-2 py-1.5">
                    <p className="truncate text-[0.68rem] text-mist-400">
                      {item.caption ?? (item.kind === "LINK" ? "Lien" : "Capture")}
                    </p>
                    <p className="truncate text-[0.6rem] text-mist-600">
                      {item.addedBy.firstName} {item.addedBy.lastName}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          <AddEvidenceForm folderId={folder.id} />
        </Panel>

        <Panel className="self-start">
          <PanelHeader
            title="Enquête liée"
            subtitle={
              canLink
                ? "Rattachement au Bureau des détectives"
                : "Réservé au Bureau des détectives"
            }
          />
          {canLink ? (
            <LinkInvestigationForm
              folderId={folder.id}
              currentInvestigationId={folder.investigation?.id ?? null}
              investigations={investigations.map((inv) => ({
                id: inv.id,
                label: `${inv.reference} — ${inv.title}`,
              }))}
            />
          ) : folder.investigation ? (
            <div className="px-5 py-4">
              <Badge tone="blue">
                <Fingerprint className="h-3 w-3" />
                {folder.investigation.reference} — {folder.investigation.title}
              </Badge>
            </div>
          ) : (
            <div className="px-5 py-4 text-xs text-mist-500">
              Ce dossier n&apos;est rattaché à aucune enquête.
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
