import type { Metadata } from "next";
import { Pin, Trash2 } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { can, divisionCodes, isAcademyTrainee } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { deleteAnnouncement, togglePin } from "./actions";
import { AnnouncementForm } from "./form";

export const metadata: Metadata = { title: "Annonces" };

const PRIORITY: Record<
  string,
  { label: string; tone: "neutral" | "amber" | "red" }
> = {
  NORMAL: { label: "Normale", tone: "neutral" },
  IMPORTANT: { label: "Importante", tone: "amber" },
  URGENT: { label: "Urgente", tone: "red" },
};

export default async function AnnouncementsPage() {
  const user = await requireModule("announcements");
  const canPublish = can.publishAnnouncement(user);

  const myDivisionIds = user.divisions.map((d) => d.id);

  // Une annonce ciblée sur une division n'est visible que par ses membres ;
  // le Command Staff voit tout, pour pouvoir modérer.
  const announcements = await db.announcement.findMany({
    where: isAcademyTrainee(user)
      ? { visibleToAcademy: true }
      : user.isSuperAdmin || user.rank.level >= 85
        ? {}
        : {
            OR: [
              { divisionId: null },
              { divisionId: { in: myDivisionIds.length ? myDivisionIds : [0] } },
            ],
          },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          rank: { select: { name: true } },
        },
      },
    },
  });

  const divisions = await db.division.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });

  const divisionName = (id: number | null) =>
    id ? (divisions.find((d) => d.id === id)?.name ?? "Division") : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">Annonces</h1>
        <p className="mt-1 text-sm text-mist-500">
          Communications officielles du département
          {divisionCodes(user).length > 0
            ? " et de vos divisions"
            : ""}
        </p>
      </div>

      {canPublish ? (
        <Panel>
          <PanelHeader
            title="Publier une annonce"
            subtitle="Visible immédiatement sur le tableau de bord des destinataires"
          />
          <AnnouncementForm divisions={divisions} />
        </Panel>
      ) : null}

      {announcements.length === 0 ? (
        <Panel>
          <EmptyState
            title="Aucune annonce"
            description="Les communications du Command Staff apparaîtront ici."
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => {
            const p = PRIORITY[a.priority] ?? PRIORITY.NORMAL;
            const mine = a.author.id === user.id;
            const canRemove =
              canPublish && (mine || user.isSuperAdmin || user.rank.level >= 85);

            return (
              <Panel
                key={a.id}
                className={
                  a.priority === "URGENT"
                    ? "border-alert-500/40"
                    : a.isPinned
                      ? "border-badge-500/40"
                      : undefined
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.isPinned ? (
                        <Pin className="h-3.5 w-3.5 text-badge-400" />
                      ) : null}
                      <h2 className="text-sm font-semibold text-mist-100">
                        {a.title}
                      </h2>
                      {a.priority !== "NORMAL" ? (
                        <Badge tone={p.tone}>{p.label}</Badge>
                      ) : null}
                      {a.divisionId ? (
                        <Badge tone="blue">{divisionName(a.divisionId)}</Badge>
                      ) : null}
                      {a.visibleToAcademy ? (
                        <Badge tone="gold">Académie</Badge>
                      ) : null}
                    </div>

                    <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-mist-300">
                      {a.body}
                    </p>

                    <p className="mt-3 text-xs text-mist-500">
                      {a.author.rank.name} {a.author.firstName}{" "}
                      {a.author.lastName} · {formatDateTime(a.createdAt)}
                    </p>
                  </div>

                  {canRemove ? (
                    <div className="flex gap-1">
                      <form action={togglePin}>
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          type="submit"
                          title={a.isPinned ? "Désépingler" : "Épingler"}
                          className="rounded-md p-1.5 text-mist-500 transition-colors hover:text-badge-300"
                        >
                          <Pin className="h-4 w-4" />
                        </button>
                      </form>
                      <form action={deleteAnnouncement}>
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          type="submit"
                          title="Retirer l'annonce"
                          className="rounded-md p-1.5 text-mist-500 transition-colors hover:text-alert-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
