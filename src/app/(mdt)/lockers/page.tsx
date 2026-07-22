import type { Metadata } from "next";
import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import {
  isCommandStaff,
  isDepartmentHead,
  isSupervisor,
} from "@/lib/permissions";
import { unlockCookie } from "./constants";
import { CreateLockerButton } from "./forms";
import { LockerGrid, type LockerData } from "./locker-grid";

export const metadata: Metadata = { title: "Casiers" };

export default async function LockersPage() {
  const user = await requireModule("lockers");
  const canManage = isCommandStaff(user); // créer / supprimer un casier
  const canWithdraw = isSupervisor(user); // retirer un objet (Sgt I+)
  const canEmpty = isDepartmentHead(user); // vider (Chief of Police)
  const canReorder = user.isSuperAdmin || user.rank.category === "CHIEF_OFFICE";

  const lockers = await db.locker.findMany({
    orderBy: { order: "asc" },
    include: {
      items: {
        orderBy: { createdAt: "desc" },
        include: {
          depositedBy: {
            select: { firstName: true, lastName: true, badgeNumber: true },
          },
        },
      },
    },
  });

  // Un casier protégé par code reste verrouillé tant que le bon code n'a pas été
  // saisi (mémorisé par un cookie de session). On n'envoie alors ni son contenu
  // ni son code au client.
  const cookieStore = await cookies();
  const data: LockerData[] = lockers.map((l) => {
    const unlocked = !l.accessCode || cookieStore.has(unlockCookie(l.id));
    return {
      id: l.id,
      name: l.name,
      isDefault: l.isDefault,
      hasCode: Boolean(l.accessCode),
      locked: !unlocked,
      itemCount: l.items.length,
      items: unlocked
        ? l.items.map((it) => ({
            id: it.id,
            label: it.label,
            quantity: it.quantity,
            by: `${it.depositedBy.firstName} ${it.depositedBy.lastName} #${it.depositedBy.badgeNumber}`,
            createdAt: it.createdAt.toISOString(),
          }))
        : [],
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">Casiers</h1>
        </div>
        {canManage ? <CreateLockerButton /> : null}
      </div>

      <LockerGrid
        lockers={data}
        canManage={canManage}
        canWithdraw={canWithdraw}
        canEmpty={canEmpty}
        canReorder={canReorder}
      />
    </div>
  );
}
