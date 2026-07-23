import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Reply, Trash2 } from "lucide-react";

import { Badge, Panel } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { formatDateTime } from "@/lib/utils";
import { deleteMessage } from "../actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const m = await db.message.findUnique({
    where: { id: Number(id) },
    select: { subject: true },
  });
  return { title: m ? m.subject : "Message" };
}

export default async function MessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("messages");
  const { id } = await params;
  const messageId = Number(id);
  if (!Number.isInteger(messageId)) notFound();

  const message = await db.message.findUnique({
    where: { id: messageId },
    include: {
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          badgeNumber: true,
          rank: { select: { name: true } },
        },
      },
      recipient: {
        select: {
          firstName: true,
          lastName: true,
          badgeNumber: true,
          rank: { select: { name: true } },
        },
      },
    },
  });
  if (!message) notFound();

  const isRecipient = message.recipientId === user.id;
  const isSender = message.senderId === user.id;
  if (!isRecipient && !isSender) notFound();

  // Ouvrir un message reçu vaut lecture.
  if (isRecipient && message.readAt === null) {
    await db.message.update({
      where: { id: messageId },
      data: { readAt: new Date() },
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/messages"
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la messagerie
      </Link>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-700 px-6 py-5">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-mist-100">
              {message.subject}
            </h1>
            <p className="mt-2 text-xs text-mist-500">
              De {message.sender.rank.name} {message.sender.firstName}{" "}
              {message.sender.lastName} #{message.sender.badgeNumber}
            </p>
            <p className="text-xs text-mist-500">
              À {message.recipient.rank.name} {message.recipient.firstName}{" "}
              {message.recipient.lastName} #{message.recipient.badgeNumber} ·{" "}
              {formatDateTime(message.createdAt)}
            </p>
          </div>
          {isSender ? (
            message.readAt ? (
              <Badge tone="green">Lu</Badge>
            ) : (
              <Badge tone="neutral">Non lu</Badge>
            )
          ) : null}
        </div>

        <div className="space-y-4 px-6 py-6">
          {message.body ? (
            <p className="text-sm leading-relaxed whitespace-pre-line text-mist-100">
              {message.body}
            </p>
          ) : null}
          {message.imageUrl ? (
            <a href={message.imageUrl} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.imageUrl}
                alt="pièce jointe"
                className="max-h-96 rounded-lg border border-ink-700"
              />
            </a>
          ) : null}
        </div>

        <div className="flex items-center gap-2 border-t border-ink-700 px-6 py-4">
          {isRecipient ? (
            <Link
              href={`/messages?to=${message.sender.id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-badge-500/60 bg-badge-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-badge-500"
            >
              <Reply className="h-4 w-4" />
              Répondre
            </Link>
          ) : null}
          <form action={deleteMessage}>
            <input type="hidden" name="id" value={message.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-3.5 py-2 text-xs text-mist-500 transition-colors hover:border-alert-500/50 hover:text-alert-500"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </button>
          </form>
        </div>
      </Panel>
    </div>
  );
}
