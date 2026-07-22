import "server-only";

import { db } from "@/lib/db";
import type { PenalEntry } from "@/lib/report-schema";

/** Listes de référence utilisées par les sélecteurs des formulaires. */
export async function loadPickerData() {
  const [officers, penalCodes, civilians, vehicles] = await Promise.all([
    db.user.findMany({
      where: { isSuperAdmin: false, status: { in: ["ACTIVE", "INACTIVE", "EXCUSED_ABSENCE", "ADMIN_LEAVE"] } },
      orderBy: [{ rank: { level: "desc" } }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        badgeNumber: true,
        rank: { select: { name: true } },
      },
    }),
    db.penalCode.findMany({
      orderBy: { order: "asc" },
      select: {
        code: true,
        title: true,
        category: true,
        fine: true,
        jailTime: true,
        isLifeSentence: true,
        requiresDoj: true,
      },
    }),
    db.civilian.findMany({
      orderBy: { lastName: "asc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        isFlagged: true,
      },
    }),
    db.vehicle.findMany({
      orderBy: { plate: "asc" },
      select: { id: true, plate: true, make: true, model: true, isStolen: true },
    }),
  ]);

  const dateFmt = new Intl.DateTimeFormat("fr-FR");

  return {
    officers: officers.map((o) => ({
      id: o.id,
      label: `${o.rank.name} ${o.firstName} ${o.lastName} — #${o.badgeNumber}`,
    })),
    penalCodes: penalCodes as PenalEntry[],
    civilians: civilians.map((c) => ({
      id: c.id,
      label:
        `${c.firstName} ${c.lastName}` +
        (c.dateOfBirth ? ` (${dateFmt.format(c.dateOfBirth)})` : "") +
        (c.isFlagged ? " ⚠" : ""),
    })),
    vehicles: vehicles.map((v) => ({
      id: v.id,
      label:
        `${v.plate}` +
        ([v.make, v.model].filter(Boolean).length
          ? ` — ${[v.make, v.model].filter(Boolean).join(" ")}`
          : "") +
        (v.isStolen ? " ⚠ volé" : ""),
    })),
  };
}
