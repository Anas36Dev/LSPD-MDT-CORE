import type { Metadata } from "next";

import { DefconBanner, DEFCON_LEVELS } from "@/components/defcon";
import { Panel } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { isCommandStaff } from "@/lib/permissions";
import { DEFCON_RULE_LABELS, DEFCON_RULES } from "@/lib/defcon-rules";
import { DefconForm } from "../dashboard/defcon-form";

export const metadata: Metadata = { title: "DEFCON" };

export default async function DefconPage() {
  const user = await requireModule("defcon");

  const status = await db.departmentStatus.findUnique({
    where: { id: 1 },
    include: {
      updatedBy: {
        select: {
          firstName: true,
          lastName: true,
          rank: { select: { name: true } },
        },
      },
    },
  });

  const current = status?.defconLevel ?? 5;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">Niveaux DEFCON</h1>
        <p className="mt-1 text-sm text-mist-500">
          État de préparation du département et règles opérationnelles par niveau
        </p>
      </div>

      {/* --- Niveau en vigueur -------------------------------------------- */}
      <DefconBanner
        level={current}
        reason={status?.defconReason}
        setBy={
          status?.updatedBy
            ? `${status.updatedBy.rank.name} ${status.updatedBy.firstName} ${status.updatedBy.lastName}`
            : null
        }
      />

      {isCommandStaff(user) ? (
        <Panel className="px-5 py-4">
          <p className="label-tag mb-3">Changer le niveau</p>
          <DefconForm current={current} />
        </Panel>
      ) : null}

      {/* --- Détail de chaque niveau -------------------------------------- */}
      <div className="space-y-4">
        {[5, 4, 3, 2, 1].map((level) => {
          const d = DEFCON_LEVELS[level];
          const rule = DEFCON_RULES[level];
          const active = level === current;

          return (
            <div
              key={level}
              className={`overflow-hidden rounded-xl border ${
                active ? `${d.border} ${d.glow}` : "border-ink-700"
              }`}
            >
              <div
                className={`flex items-center gap-4 px-5 py-3 ${active ? d.bg : "bg-ink-900/60"}`}
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 ${d.border}`}
                  style={{ backgroundColor: `${d.color}22` }}
                >
                  <span className={`text-xl font-bold ${d.text}`}>{level}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${d.text}`}>
                    DEFCON {level}
                  </p>
                  <p className="truncate text-xs text-mist-400">{d.label}</p>
                </div>
                {active ? (
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[0.62rem] font-semibold ${d.border} ${d.text}`}
                  >
                    En vigueur
                  </span>
                ) : null}
              </div>

              <dl className="divide-y divide-ink-700">
                {DEFCON_RULE_LABELS.map(({ key, label }) => (
                  <div
                    key={key}
                    className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-[180px_1fr] sm:gap-4"
                  >
                    <dt className="label-tag">{label}</dt>
                    <dd className="text-sm leading-relaxed text-mist-300">
                      {rule[key]}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-mist-500">
        Ces règles sont un cadre de référence. Le niveau DEFCON est fixé par le
        Command Staff et s&apos;impose à l&apos;ensemble du département dès sa
        modification.
      </p>
    </div>
  );
}
