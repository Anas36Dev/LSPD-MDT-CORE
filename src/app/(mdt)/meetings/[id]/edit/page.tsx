import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { officerSignature } from "@/lib/utils";
import { MeetingForm } from "../../forms";

export const metadata = { title: "Modifier le récapitulatif" };

export default async function EditMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("meetings");
  const { id } = await params;
  const meetingId = Number(id);
  if (!Number.isInteger(meetingId)) notFound();

  const [meeting, agents, ranks] = await Promise.all([
    db.weeklyMeeting.findUnique({
      where: { id: meetingId },
      include: { gradeChanges: true, events: true },
    }),
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
  ]);
  if (!meeting) notFound();

  // Le grade annoncé est stocké par son nom : on retrouve son code pour le
  // pré-remplissage de la liste déroulante.
  const codeByName = new Map(ranks.map((r) => [r.name, r.code]));

  const initial = {
    id: meeting.id,
    summary: meeting.summary,
    meetingDate: meeting.meetingDate
      ? meeting.meetingDate.toISOString().slice(0, 10)
      : "",
    gradeRows: meeting.gradeChanges.map((g) => ({
      userId: g.userId,
      rankCode: codeByName.get(g.toRankName) ?? "",
    })),
    eventRows: meeting.events.map((e) => ({
      userId: e.userId,
      type: e.type,
      reason: e.reason ?? "",
    })),
  };

  return (
    <div className="space-y-6">
      <Link
        href="/meetings"
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux réunions
      </Link>

      <Panel>
        <PanelHeader title="Modifier le récapitulatif" />
        <MeetingForm
          mode="edit"
          initial={initial}
          agents={agents.map((a) => ({
            id: a.id,
            label: `${a.rank.name} ${a.firstName} ${a.lastName} #${a.badgeNumber}`,
          }))}
          ranks={ranks}
          signature={officerSignature(user)}
        />
      </Panel>
    </div>
  );
}
