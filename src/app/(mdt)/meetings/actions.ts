"use server";

import { revalidatePath } from "@/lib/revalidate";
import { redirect } from "next/navigation";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { canManageMeetings, type SessionUser } from "@/lib/permissions";
import { officerSignature } from "@/lib/utils";

export type MeetingState = { error?: string; success?: string } | undefined;

const EVENT_TYPES = ["WARNING", "DEPARTURE", "DEATH"];

type ParsedMeeting = {
  summary: string;
  meetingDate: Date | null;
  gradeChanges: {
    userId: number;
    agentName: string;
    fromRankName: string;
    toRankName: string;
    direction: string;
  }[];
  events: {
    userId: number;
    agentName: string;
    rankName: string;
    type: string;
    reason: string | null;
  }[];
};

/** Lit et valide le formulaire de récapitulatif (partagé création/édition). */
async function parseMeeting(
  formData: FormData,
): Promise<{ error: string } | { data: ParsedMeeting }> {
  const summary = String(formData.get("summary") ?? "").trim();
  if (!summary) return { error: "Le récapitulatif est obligatoire." };

  const rawDate = String(formData.get("meetingDate") ?? "").trim();
  const meetingDate = rawDate ? new Date(rawDate) : null;

  if (formData.get("signed") !== "true") {
    return { error: "Vous devez signer le récapitulatif avant de le publier." };
  }

  // Changements de grade : agent + grade, dans l'ordre.
  const userIds = formData.getAll("gradeUserId").map((v) => Number(v));
  const rankCodes = formData.getAll("gradeRankCode").map(String);
  const pairs: { userId: number; rankCode: string }[] = [];
  for (let i = 0; i < userIds.length; i++) {
    if (Number.isInteger(userIds[i]) && userIds[i] > 0 && rankCodes[i]) {
      pairs.push({ userId: userIds[i], rankCode: rankCodes[i] });
    }
  }

  // Événements : avertissement / départ / décès.
  const eventUserIds = formData.getAll("eventUserId").map((v) => Number(v));
  const eventTypes = formData.getAll("eventType").map(String);
  const eventReasons = formData.getAll("eventReason").map(String);
  const rawEvents: { userId: number; type: string; reason: string }[] = [];
  for (let i = 0; i < eventUserIds.length; i++) {
    if (
      Number.isInteger(eventUserIds[i]) &&
      eventUserIds[i] > 0 &&
      EVENT_TYPES.includes(eventTypes[i])
    ) {
      rawEvents.push({
        userId: eventUserIds[i],
        type: eventTypes[i],
        reason: (eventReasons[i] ?? "").trim(),
      });
    }
  }

  const allUserIds = [
    ...new Set([...pairs.map((p) => p.userId), ...rawEvents.map((e) => e.userId)]),
  ];
  const [agents, ranks] = await Promise.all([
    db.user.findMany({
      where: { id: { in: allUserIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        rank: { select: { name: true, level: true } },
      },
    }),
    db.rank.findMany({ select: { code: true, name: true, level: true } }),
  ]);
  const agentById = new Map(agents.map((a) => [a.id, a]));
  const rankByCode = new Map(ranks.map((r) => [r.code, r]));

  const gradeChanges = pairs.flatMap((p) => {
    const agent = agentById.get(p.userId);
    const target = rankByCode.get(p.rankCode);
    if (!agent || !target) return [];
    return [
      {
        userId: agent.id,
        agentName: `${agent.firstName} ${agent.lastName}`,
        fromRankName: agent.rank.name,
        toRankName: target.name,
        direction: target.level >= agent.rank.level ? "PROMOTION" : "DEMOTION",
      },
    ];
  });

  const events = rawEvents.flatMap((e) => {
    const agent = agentById.get(e.userId);
    if (!agent) return [];
    return [
      {
        userId: agent.id,
        agentName: `${agent.firstName} ${agent.lastName}`,
        rankName: agent.rank.name,
        type: e.type,
        reason: e.reason || null,
      },
    ];
  });

  return { data: { summary, meetingDate, gradeChanges, events } };
}

function revalidateMeetings() {
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
}

export async function createMeeting(
  _state: MeetingState,
  formData: FormData,
): Promise<MeetingState> {
  let user: SessionUser;
  try {
    user = await assertPermission(canManageMeetings);
    const parsed = await parseMeeting(formData);
    if ("error" in parsed) return parsed;

    const meeting = await db.weeklyMeeting.create({
      data: {
        summary: parsed.data.summary,
        meetingDate: parsed.data.meetingDate,
        signature: officerSignature(user),
        createdById: user.id,
        gradeChanges: { create: parsed.data.gradeChanges },
        events: { create: parsed.data.events },
      },
    });

    await audit({
      userId: user.id,
      action: "MEETING_CREATE",
      targetType: "WeeklyMeeting",
      targetId: meeting.id,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }

  revalidateMeetings();
  redirect("/meetings");
}

export async function updateMeeting(
  _state: MeetingState,
  formData: FormData,
): Promise<MeetingState> {
  try {
    const user = await assertPermission(canManageMeetings);
    const id = Number(formData.get("id"));
    const existing = await db.weeklyMeeting.findUnique({ where: { id } });
    if (!existing) return { error: "Récapitulatif introuvable." };

    const parsed = await parseMeeting(formData);
    if ("error" in parsed) return parsed;

    // On remplace les listes (grades + événements) par les nouvelles.
    await db.$transaction([
      db.weeklyGradeChange.deleteMany({ where: { meetingId: id } }),
      db.weeklyMeetingEvent.deleteMany({ where: { meetingId: id } }),
      db.weeklyMeeting.update({
        where: { id },
        data: {
          summary: parsed.data.summary,
          meetingDate: parsed.data.meetingDate,
          signature: officerSignature(user),
          gradeChanges: { create: parsed.data.gradeChanges },
          events: { create: parsed.data.events },
        },
      }),
    ]);

    await audit({
      userId: user.id,
      action: "MEETING_UPDATE",
      targetType: "WeeklyMeeting",
      targetId: id,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }

  revalidateMeetings();
  redirect("/meetings");
}

export async function deleteMeeting(formData: FormData) {
  const user = await assertPermission(canManageMeetings);
  const id = Number(formData.get("id"));

  await db.weeklyMeeting.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: "MEETING_DELETE",
    targetType: "WeeklyMeeting",
    targetId: id,
  });

  revalidateMeetings();
}
