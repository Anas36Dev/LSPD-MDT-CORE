import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { officerSignature } from "@/lib/utils";
import { deleteMeeting } from "./actions";
import { MeetingForm } from "./forms";
import { MeetingRecap, type MeetingCardData } from "./meeting-card";

export const metadata: Metadata = { title: "Réunions hebdomadaires" };

export default async function MeetingsPage() {
  const user = await requireModule("meetings");

  const [agents, ranks, meetings] = await Promise.all([
    db.user.findMany({
      where: { isSuperAdmin: false, rank: { code: { not: "DOJ" } } },
      orderBy: [{ rank: { level: "desc" } }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        badgeNumber: true,
        rank: { select: { name: true } },
      },
    }),
    db.rank.findMany({
      where: { code: { not: "DOJ" } },
      orderBy: { level: "desc" },
      select: { code: true, name: true },
    }),
    db.weeklyMeeting.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        gradeChanges: true,
        events: true,
      },
    }),
  ]);

  const cards: MeetingCardData[] = meetings.map((m) => ({
    id: m.id,
    summary: m.summary,
    meetingDate: m.meetingDate,
    signature: m.signature,
    createdAt: m.createdAt,
    createdByName: `${m.createdBy.firstName} ${m.createdBy.lastName}`,
    gradeChanges: m.gradeChanges,
    events: m.events,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          Réunions hebdomadaires
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          Récapitulatif de la réunion de fin de semaine et changements de grade.
          Le dernier récap s&apos;affiche sur le tableau de bord de tous les
          agents.
        </p>
      </div>

      <Panel>
        <PanelHeader
          title="Nouveau récapitulatif"
        />
        <MeetingForm
          agents={agents.map((a) => ({
            id: a.id,
            label: `${a.rank.name} ${a.firstName} ${a.lastName} #${a.badgeNumber}`,
          }))}
          ranks={ranks}
          signature={officerSignature(user)}
        />
      </Panel>

      {cards.length === 0 ? (
        <Panel>
          <EmptyState
            title="Aucune réunion enregistrée"
            description="Les récapitulatifs publiés apparaîtront ici."
          />
        </Panel>
      ) : (
        cards.map((m) => (
          <MeetingRecap
            key={m.id}
            meeting={m}
            action={
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/meetings/${m.id}/edit`}
                  title="Modifier"
                  className="rounded-md border border-ink-600 p-1.5 text-mist-500 transition-colors hover:border-badge-500/50 hover:text-badge-300"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
                <ConfirmButton
                  action={deleteMeeting}
                  fields={{ id: m.id }}
                  title="Supprimer le récapitulatif"
                  message="Supprimer ce récapitulatif de réunion ?"
                  confirmLabel="Supprimer"
                  triggerTitle="Supprimer"
                  triggerClassName="cursor-pointer rounded-md border border-ink-600 p-1.5 text-mist-500 transition-colors hover:border-alert-500/50 hover:text-alert-500"
                  trigger={<Trash2 className="h-3.5 w-3.5" />}
                />
              </div>
            }
          />
        ))
      )}
    </div>
  );
}
