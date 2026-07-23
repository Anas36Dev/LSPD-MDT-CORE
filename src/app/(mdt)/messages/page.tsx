import type { Metadata } from "next";
import Link from "next/link";
import { ImageIcon, MailOpen, Trash2 } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { formatDateTime } from "@/lib/utils";
import { deleteMessage, markRead } from "./actions";
import { MessageForm } from "./form";

export const metadata: Metadata = { title: "Messagerie" };

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const user = await requireModule("messages");
  const { to } = await searchParams;

  const [received, sent, agents] = await Promise.all([
    db.message.findMany({
      where: { recipientId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        sender: {
          select: {
            firstName: true,
            lastName: true,
            badgeNumber: true,
            rank: { select: { name: true } },
          },
        },
      },
    }),
    db.message.findMany({
      where: { senderId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        recipient: { select: { firstName: true, lastName: true } },
      },
    }),
    db.user.findMany({
      where: {
        isSuperAdmin: false,
        status: { in: ["ACTIVE", "INACTIVE", "EXCUSED_ABSENCE", "ADMIN_LEAVE"] },
        id: { not: user.id },
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

  const unread = received.filter((m) => m.readAt === null).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">Messagerie</h1>
        <p className="mt-1 text-sm text-mist-500">
          {unread > 0
            ? `${unread} message(s) non lu(s)`
            : "Aucun message non lu"}
        </p>
      </div>

      <Panel>
        <PanelHeader title="Nouveau message" />
        <MessageForm
          agents={agents.map((a) => ({
            id: a.id,
            label: `${a.rank.name} ${a.firstName} ${a.lastName} — #${a.badgeNumber}`,
          }))}
          defaultRecipientId={to ? Number(to) : undefined}
        />
      </Panel>

      <Panel>
        <PanelHeader
          title="Boîte de réception"
          subtitle={`${received.length} message(s)`}
          action={unread > 0 ? <Badge tone="blue">{unread} non lu(s)</Badge> : null}
        />
        {received.length === 0 ? (
          <EmptyState
            title="Aucun message reçu"
            description="Les messages de vos collègues apparaîtront ici."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {received.map((m) => (
              <li
                key={m.id}
                className={m.readAt === null ? "bg-badge-600/5" : undefined}
              >
                <div className="flex items-start gap-4 px-5 py-3.5">
                  <Link
                    href={`/messages/${m.id}`}
                    className="min-w-0 flex-1 rounded-md transition-colors hover:opacity-90"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`text-sm ${m.readAt === null ? "font-semibold text-mist-100" : "text-mist-300"}`}
                      >
                        {m.subject}
                      </p>
                      {m.readAt === null ? (
                        <Badge tone="blue">Nouveau</Badge>
                      ) : null}
                    </div>
                    {m.body ? (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-mist-400">
                        {m.body}
                      </p>
                    ) : m.imageUrl ? (
                      <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-mist-400">
                        <ImageIcon className="h-3.5 w-3.5" />
                        Image
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-mist-500">
                      {m.sender.rank.name} {m.sender.firstName}{" "}
                      {m.sender.lastName} #{m.sender.badgeNumber} ·{" "}
                      {formatDateTime(m.createdAt)}
                    </p>
                  </Link>

                  <div className="flex shrink-0 gap-1">
                    {m.readAt === null ? (
                      <form action={markRead}>
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          type="submit"
                          title="Marquer comme lu"
                          className="rounded-md p-1.5 text-mist-500 transition-colors hover:text-badge-300"
                        >
                          <MailOpen className="h-4 w-4" />
                        </button>
                      </form>
                    ) : null}
                    <form action={deleteMessage}>
                      <input type="hidden" name="id" value={m.id} />
                      <button
                        type="submit"
                        title="Supprimer"
                        className="rounded-md p-1.5 text-mist-500 transition-colors hover:text-alert-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {sent.length > 0 ? (
        <Panel>
          <PanelHeader title="Messages envoyés" subtitle="20 derniers" />
          <ul className="divide-y divide-ink-700">
            {sent.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/messages/${m.id}`}
                  className="flex items-center gap-4 px-5 py-2.5 transition-colors hover:bg-ink-800/60"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-mist-300">
                    {m.subject}
                  </span>
                  <span className="text-xs text-mist-500">
                    à {m.recipient.firstName} {m.recipient.lastName}
                  </span>
                  <span className="text-xs text-mist-500">
                    {formatDateTime(m.createdAt)}
                  </span>
                  {m.readAt ? (
                    <Badge tone="green">Lu</Badge>
                  ) : (
                    <Badge tone="neutral">Non lu</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
