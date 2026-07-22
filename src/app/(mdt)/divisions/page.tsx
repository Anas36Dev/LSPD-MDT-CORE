import type { Metadata } from "next";

import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import {
  DivisionsHeader,
  DivisionCard,
  type DivisionView,
  type RankOption,
} from "./forms";

export const metadata: Metadata = { title: "Divisions" };

export default async function DivisionsPage() {
  await requireModule("divisions");

  const [divisions, ranks] = await Promise.all([
    db.division.findMany({
      orderBy: { order: "asc" },
      include: {
        subDivisions: { orderBy: { order: "asc" } },
        divisionRoles: {
          orderBy: { order: "asc" },
          include: { subDivision: { select: { name: true } } },
        },
        _count: { select: { members: true } },
      },
    }),
    // Grades assermentés uniquement : on ne fixe pas un plancher « Rookie »,
    // les recrues restant à l'académie sans division.
    db.rank.findMany({
      where: { category: { notIn: ["ACADEMY", "DOJ"] } },
      orderBy: { level: "asc" },
      select: { name: true, level: true },
    }),
  ]);

  const rankOptions: RankOption[] = ranks.map((r) => ({
    level: r.level,
    name: r.name,
  }));

  const views: DivisionView[] = divisions.map((d, i) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    shortName: d.shortName,
    isRestricted: d.isRestricted,
    minRankLevel: d.minRankLevel,
    memberCount: d._count.members,
    subDivisions: d.subDivisions.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
    })),
    roles: d.divisionRoles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      isDivisionChief: r.isDivisionChief,
      isUnitLead: r.isUnitLead,
      canTrain: r.canTrain,
      subDivisionName: r.subDivision?.name ?? null,
    })),
    isFirst: i === 0,
    isLast: i === divisions.length - 1,
  }));

  return (
    <div className="space-y-6">
      <DivisionsHeader
        ranks={rankOptions}
        title="Divisions"
        subtitle="Divisions du département."
      />

      <div className="space-y-5">
        {views.map((d) => (
          <DivisionCard key={d.id} division={d} ranks={rankOptions} />
        ))}
      </div>
    </div>
  );
}
