import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { formatDate } from "@/lib/utils";
import { OpenCaseForm } from "./forms";

export const metadata: Metadata = { title: "Affaires internes" };

export const SEVERITY: Record<
  string,
  { label: string; tone: "neutral" | "blue" | "amber" | "red" }
> = {
  LOW: { label: "Faible", tone: "neutral" },
  MEDIUM: { label: "Moyenne", tone: "blue" },
  HIGH: { label: "Élevée", tone: "amber" },
  CRITICAL: { label: "Critique", tone: "red" },
};

export const CASE_STATUS: Record<
  string,
  { label: string; tone: "neutral" | "blue" | "amber" | "green" | "red" }
> = {
  OPEN: { label: "Ouvert", tone: "amber" },
  INVESTIGATING: { label: "En instruction", tone: "blue" },
  CLOSED: { label: "Clos", tone: "green" },
  DISMISSED: { label: "Classé sans suite", tone: "neutral" },
};

export default async function InternalAffairsPage() {
  const user = await requireModule("internal-affairs");

  const [cases, agents] = await Promise.all([
    db.iaCase.findMany({
      orderBy: [{ closedAt: "asc" }, { createdAt: "desc" }],
      include: {
        subject: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            badgeNumber: true,
            rank: { select: { name: true } },
          },
        },
        investigator: { select: { firstName: true, lastName: true } },
        _count: { select: { notes: true, sanctions: true } },
      },
    }),
    db.user.findMany({
      where: { isSuperAdmin: false, id: { not: user.id } },
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

  const open = cases.filter(
    (c) => c.status === "OPEN" || c.status === "INVESTIGATING",
  );
  const closed = cases.filter(
    (c) => c.status === "CLOSED" || c.status === "DISMISSED",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          Affaires internes
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          Dossiers disciplinaires
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-alert-500/30 bg-alert-600/5 px-5 py-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-alert-500" />
        <p className="text-xs leading-relaxed text-mist-300">
          Le contenu de ces dossiers est confidentiel. Chaque consultation et
          chaque décision sont journalisées et attribuées nominativement.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Dossiers en cours" value={open.length} />
        <Tile label="Dossiers clos" value={closed.length} />
        <Tile
          label="Sanctions prononcées"
          value={cases.reduce((s, c) => s + c._count.sanctions, 0)}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Dossiers en cours"
          subtitle={`${open.length} dossier(s) actif(s)`}
        />
        {open.length === 0 ? (
          <EmptyState
            title="Aucun dossier en cours"
            description="Les enquêtes disciplinaires ouvertes apparaîtront ici."
          />
        ) : (
          <CaseList cases={open} />
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Ouvrir un dossier"
          subtitle="Toute ouverture est tracée et notifiée dans le journal d'audit"
        />
        <OpenCaseForm
          agents={agents.map((a) => ({
            id: a.id,
            label: `${a.rank.name} ${a.firstName} ${a.lastName} — #${a.badgeNumber}`,
          }))}
        />
      </Panel>

      {closed.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Dossiers clos"
            subtitle={`${closed.length} dossier(s) archivé(s)`}
          />
          <CaseList cases={closed} />
        </Panel>
      ) : null}
    </div>
  );
}

type CaseRow = {
  id: number;
  reference: string;
  title: string;
  severity: string;
  status: string;
  createdAt: Date;
  subject: {
    id: number;
    firstName: string;
    lastName: string;
    badgeNumber: string;
    rank: { name: string };
  };
  investigator: { firstName: string; lastName: string };
  _count: { notes: number; sanctions: number };
};

function CaseList({ cases }: { cases: CaseRow[] }) {
  return (
    <ul className="divide-y divide-ink-700">
      {cases.map((c) => {
        const sev = SEVERITY[c.severity] ?? SEVERITY.MEDIUM;
        const st = CASE_STATUS[c.status] ?? CASE_STATUS.OPEN;

        return (
          <li key={c.id}>
            <Link
              href={`/internal-affairs/${c.id}`}
              className="flex flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-800/60"
            >
              <span className="w-28 shrink-0 font-mono text-xs text-badge-300">
                {c.reference}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-mist-100">
                  {c.title}
                </p>
                <p className="text-xs text-mist-500">
                  {c.subject.rank.name} {c.subject.firstName}{" "}
                  {c.subject.lastName} #{c.subject.badgeNumber} · instruit par{" "}
                  {c.investigator.firstName} {c.investigator.lastName} ·{" "}
                  {formatDate(c.createdAt)}
                </p>
              </div>
              {c._count.sanctions > 0 ? (
                <Badge tone="red">{c._count.sanctions} sanction(s)</Badge>
              ) : null}
              <Badge tone={sev.tone}>{sev.label}</Badge>
              <Badge tone={st.tone}>{st.label}</Badge>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <Panel className="px-5 py-4">
      <p className="label-tag">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-mist-100">{value}</p>
    </Panel>
  );
}
