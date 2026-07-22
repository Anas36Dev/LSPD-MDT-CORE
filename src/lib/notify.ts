import "server-only";

import { db } from "@/lib/db";

type Entry = {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
};

/** Crée une notification pour un agent. */
export async function notify(userId: number, entry: Entry) {
  await db.notification.create({
    data: {
      userId,
      type: entry.type,
      title: entry.title,
      body: entry.body ?? null,
      link: entry.link ?? null,
    },
  });
}

/** Crée la même notification pour plusieurs agents. */
export async function notifyMany(userIds: number[], entry: Entry) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  await db.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type: entry.type,
      title: entry.title,
      body: entry.body ?? null,
      link: entry.link ?? null,
    })),
  });
}
