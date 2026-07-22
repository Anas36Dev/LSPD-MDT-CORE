import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { canAccessChannel, channelByKey } from "@/lib/message-channels";
import { isCommandStaff } from "@/lib/permissions";
import { ChannelMembers, type ChannelMember } from "./channel-members";
import { ChannelCreator } from "../create-channel-form";
import { ChatView, type ChatMessage } from "./chat-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const ch = await channelByKey(key);
  return { title: ch ? ch.name : "Discussion" };
}

const avatarOf = (u: {
  manualAvatarUrl: string | null;
  discordAvatarUrl: string | null;
  avatarSource: string;
}) =>
  u.avatarSource === "MANUAL" && u.manualAvatarUrl
    ? u.manualAvatarUrl
    : (u.manualAvatarUrl ?? u.discordAvatarUrl);

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const user = await requireModule("message-groups");
  const { key } = await params;

  const channel = await channelByKey(key);
  if (!channel || !canAccessChannel(user, channel)) notFound();

  const [rows, memberRows] = await Promise.all([
    db.groupMessage.findMany({
      where: { channel: channel.key },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            badgeNumber: true,
            manualAvatarUrl: true,
            discordAvatarUrl: true,
            avatarSource: true,
            rank: { select: { name: true } },
          },
        },
      },
    }),
    // Toutes les personnes ayant accès à ce canal (par catégorie, grade ou nom).
    db.user.findMany({
      where: {
        isSuperAdmin: false,
        status: "ACTIVE",
        OR: [
          { rank: { category: "CHIEF_OFFICE" } },
          { rank: { category: { in: channel.categories } } },
          { rank: { code: { in: channel.rankCodes } } },
          { id: { in: channel.userIds } },
          {
            divisions: {
              some: { division: { code: { in: channel.divisionCodes } } },
            },
          },
          {
            certifications: {
              some: { certification: { code: { in: channel.certCodes } } },
            },
          },
        ],
      },
      orderBy: [{ rank: { level: "desc" } }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        badgeNumber: true,
        manualAvatarUrl: true,
        discordAvatarUrl: true,
        avatarSource: true,
        rank: { select: { name: true } },
      },
    }),
  ]);

  const members: ChannelMember[] = memberRows.map((u) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    badge: u.badgeNumber,
    rank: u.rank.name,
    avatarUrl: avatarOf(u),
  }));

  // Édition de l'accès : réservée au Command Staff, sur les canaux personnalisés.
  const canEditChannel =
    isCommandStaff(user) && !channel.builtin && channel.id != null;

  const editData = canEditChannel
    ? await (async () => {
        const [ranks, divisions, certifications, agents] = await Promise.all([
          db.rank.findMany({
            orderBy: { level: "desc" },
            select: { code: true, name: true, category: true },
          }),
          db.division.findMany({
            orderBy: { order: "asc" },
            select: { code: true, name: true },
          }),
          db.certification.findMany({
            where: { category: { notIn: ["PPA", "PATROL"] } },
            orderBy: { order: "asc" },
            select: { code: true, name: true },
          }),
          db.user.findMany({
            where: {
              isSuperAdmin: false,
              status: "ACTIVE",
              rank: { code: { not: "DOJ" } },
            },
            orderBy: [{ rank: { level: "desc" } }, { lastName: "asc" }],
            select: {
              id: true,
              firstName: true,
              lastName: true,
              badgeNumber: true,
              rank: { select: { name: true } },
            },
          }),
        ]);
        return {
          ranks,
          divisions,
          certifications,
          members: agents.map((m) => ({
            id: m.id,
            label: `${m.rank.name} ${m.firstName} ${m.lastName} #${m.badgeNumber}`,
          })),
        };
      })()
    : null;

  const messages: ChatMessage[] = rows
    .slice()
    .reverse()
    .map((m) => ({
      id: m.id,
      senderId: m.sender.id,
      senderName: `${m.sender.firstName} ${m.sender.lastName}`,
      senderBadge: m.sender.badgeNumber,
      senderRank: m.sender.rank.name,
      avatarUrl: avatarOf(m.sender),
      body: m.body,
      imageUrl: m.imageUrl,
      createdAt: m.createdAt.toISOString(),
    }));

  return (
    <div className="space-y-4">
      <Link
        href="/message-groups"
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Tous les canaux
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-semibold text-mist-100">{channel.name}</h1>
        {editData && channel.id ? (
          <ChannelCreator
            mode="edit"
            initial={{
              id: channel.id,
              name: channel.name,
              rankCodes: channel.rankCodes,
              userIds: channel.userIds,
              divisionCodes: channel.divisionCodes,
              certCodes: channel.certCodes,
            }}
            ranks={editData.ranks}
            divisions={editData.divisions}
            certifications={editData.certifications}
            members={editData.members}
          />
        ) : null}
      </div>

      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <ChatView
            channelKey={channel.key}
            channelName={channel.name}
            currentUserId={user.id}
            canModerate={isCommandStaff(user)}
            messages={messages}
          />
        </div>
        <ChannelMembers members={members} />
      </div>
    </div>
  );
}
