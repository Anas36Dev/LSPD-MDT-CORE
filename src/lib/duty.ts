import "server-only";

import { db } from "@/lib/db";

/** Au-delà de ce délai sans ping, l'agent est considéré hors service. */
export const PING_STALE_MS = 120_000; // 2 minutes

function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

type Shift = {
  id: number;
  startedAt: Date;
  lastPingAt: Date;
  endedAt: Date | null;
};

/** Fin effective d'une vacation en ms. La vacation active court jusqu'à maintenant. */
function shiftEnd(s: Shift, activeOpenId: number, now: number): number {
  if (s.endedAt) return s.endedAt.getTime();
  if (s.id === activeOpenId) return now;
  return s.lastPingAt.getTime();
}

async function openShift(userId: number) {
  return db.dutyShift.findFirst({
    where: { userId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
}

/** L'agent est-il actuellement en service (vacation ouverte + ping récent) ? */
export async function dutyIsOn(userId: number): Promise<boolean> {
  const open = await openShift(userId);
  return !!open && Date.now() - open.lastPingAt.getTime() < PING_STALE_MS;
}

/** État du service + temps effectué aujourd'hui (en secondes). */
export async function dutyStatus(
  userId: number,
): Promise<{ onDuty: boolean; todaySeconds: number }> {
  const now = Date.now();
  const open = await openShift(userId);
  const onDuty = !!open && now - open.lastPingAt.getTime() < PING_STALE_MS;
  const activeId = onDuty && open ? open.id : -1;

  const today = await db.dutyShift.findMany({
    where: { userId, startedAt: { gte: startOfToday() } },
  });
  let todaySeconds = 0;
  for (const s of today) {
    todaySeconds += Math.max(
      0,
      Math.floor((shiftEnd(s, activeId, now) - s.startedAt.getTime()) / 1000),
    );
  }
  return { onDuty, todaySeconds };
}

/** Temps de service cumulé (toutes vacations), en secondes. */
export async function dutyTotalSeconds(userId: number): Promise<number> {
  const now = Date.now();
  const open = await openShift(userId);
  const onDuty = !!open && now - open.lastPingAt.getTime() < PING_STALE_MS;
  const activeId = onDuty && open ? open.id : -1;

  const all = await db.dutyShift.findMany({ where: { userId } });
  let total = 0;
  for (const s of all) {
    total += Math.max(
      0,
      Math.floor((shiftEnd(s, activeId, now) - s.startedAt.getTime()) / 1000),
    );
  }
  return total;
}
