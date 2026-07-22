import type { Metadata } from "next";
import { UsersRound, X } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { canManageBinomes, RANK } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { CreatePartnershipForm, PartnershipNoteForm } from "./forms";
import { deletePartnership } from "./actions";

export const metadata: Metadata = { title: "Binômes" };

const VIS_LABEL: Record<string, string> = {
  BOTH: "Binôme",
  ROOKIE: "Recrue",
  INSTRUCTOR: "Instructeur",
  PUBLIC: "Public",
};

export default async function BinomesPage() {
  const user = await requireModule("academy-binomes");
  const canManage = canManageBinomes(user);

  const [partnerships, rookies, instructors] = await Promise.all([
    db.partnership.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        rookie: {
          select: { id: true, firstName: true, lastName: true, badgeNumber: true },
        },
        instructor: {
          select: { id: true, firstName: true, lastName: true, badgeNumber: true },
        },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { firstName: true, lastName: true } } },
        },
      },
    }),
    canManage
      ? db.user.findMany({
          // Recrues Police Officer I pas encore attitrées à un instructeur.
          where: {
            isSuperAdmin: false,
            rank: { level: RANK.POLICE_OFFICER_I },
            partnershipsAsRookie: { none: {} },
          },
          orderBy: { lastName: "asc" },
          select: { id: true, firstName: true, lastName: true, badgeNumber: true },
        })
      : [],
    canManage
      ? db.user.findMany({
          // Instructeurs FTO pas encore en binôme.
          where: {
            divisionRoles: { some: { divisionRole: { code: "TD_FTO" } } },
            partnershipsAsInstructor: { none: {} },
          },
          orderBy: { lastName: "asc" },
          select: { id: true, firstName: true, lastName: true, badgeNumber: true },
        })
      : [],
  ]);

  // Une note n'est visible que selon sa portée — sauf pour les gestionnaires
  // (Sergeant II et au-dessus) qui voient tout.
  const canSeeNote = (
    note: { visibility: string },
    p: { rookie: { id: number }; instructor: { id: number } },
  ) => {
    if (canManage) return true;
    switch (note.visibility) {
      case "PUBLIC":
        return true;
      case "ROOKIE":
        return user.id === p.rookie.id;
      case "INSTRUCTOR":
        return user.id === p.instructor.id;
      default: // BOTH
        return user.id === p.rookie.id || user.id === p.instructor.id;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">Binômes</h1>
        <p className="mt-1 text-sm text-mist-500">
          Recrues attitrées à un instructeur.
        </p>
      </div>

      {canManage ? (
        <Panel className="max-w-2xl border-badge-500/30">
          <PanelHeader
            title="Créer un binôme"
            subtitle="Attribuer une recrue à un instructeur"
          />
          <CreatePartnershipForm
            rookies={rookies.map((r) => ({
              id: r.id,
              label: `${r.firstName} ${r.lastName} · #${r.badgeNumber}`,
            }))}
            instructors={instructors.map((i) => ({
              id: i.id,
              label: `${i.firstName} ${i.lastName} · #${i.badgeNumber}`,
            }))}
          />
        </Panel>
      ) : null}

      {partnerships.length === 0 ? (
        <EmptyState
          title="Aucun binôme"
          description="Aucune recrue n'est actuellement attitrée à un instructeur."
        />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {partnerships.map((p) => {
            const notes = p.notes.filter((n) => canSeeNote(n, p));
            return (
              <Panel key={p.id}>
                <PanelHeader
                  title={`${p.rookie.firstName} ${p.rookie.lastName} — ${p.instructor.firstName} ${p.instructor.lastName}`}
                  subtitle={`Recrue #${p.rookie.badgeNumber} · Instructeur #${p.instructor.badgeNumber}`}
                  action={
                    canManage ? (
                      <form action={deletePartnership}>
                        <input type="hidden" name="partnershipId" value={p.id} />
                        <button
                          type="submit"
                          title="Dissoudre le binôme"
                          className="rounded-md p-1 text-mist-500 transition-colors hover:text-alert-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </form>
                    ) : null
                  }
                />
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2 text-sm text-mist-300">
                    <UsersRound className="h-4 w-4 text-mist-500" />
                    <span className="text-mist-100">
                      {p.rookie.firstName} {p.rookie.lastName}
                    </span>
                    <span className="text-mist-500">encadré(e) par</span>
                    <span className="text-mist-100">
                      {p.instructor.firstName} {p.instructor.lastName}
                    </span>
                  </div>

                  {notes.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {notes.map((n) => (
                        <li
                          key={n.id}
                          className="rounded-lg border border-ink-700 bg-ink-850/60 px-3.5 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm whitespace-pre-line text-mist-100">
                              {n.body}
                            </p>
                            <Badge tone="neutral">
                              {VIS_LABEL[n.visibility] ?? n.visibility}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-mist-500">
                            {n.author.firstName} {n.author.lastName} ·{" "}
                            {formatDateTime(n.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {canManage ? (
                    <PartnershipNoteForm partnershipId={p.id} />
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
