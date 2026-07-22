import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { formatDate, formatDateTime } from "@/lib/utils";
import { liftSanction } from "../actions";
import { CloseCaseForm, NoteForm, SanctionForm } from "../forms";
import { CASE_STATUS, SEVERITY } from "../page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await db.iaCase.findUnique({
    where: { id: Number(id) },
    select: { reference: true },
  });
  return { title: c ? c.reference : "Dossier disciplinaire" };
}

const SANCTION_LABELS: Record<string, string> = {
  WARNING: "Avertissement",
  REPRIMAND: "Blâme",
  SUSPENSION: "Suspension",
  DEMOTION: "Rétrogradation",
  TERMINATION: "Révocation",
};

export default async function IaCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("internal-affairs");
  const { id } = await params;

  const caseId = Number(id);
  if (!Number.isInteger(caseId)) notFound();

  const iaCase = await db.iaCase.findUnique({
    where: { id: caseId },
    include: {
      subject: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          badgeNumber: true,
          status: true,
          rank: { select: { name: true } },
        },
      },
      investigator: { select: { firstName: true, lastName: true } },
      notes: {
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { firstName: true, lastName: true } },
        },
      },
      sanctions: { orderBy: { startsAt: "desc" } },
    },
  });

  if (!iaCase) notFound();

  const sev = SEVERITY[iaCase.severity] ?? SEVERITY.MEDIUM;
  const st = CASE_STATUS[iaCase.status] ?? CASE_STATUS.OPEN;
  const isOpen =
    iaCase.status === "OPEN" || iaCase.status === "INVESTIGATING";
  const canConclude = can.closeIaCase(user);

  const subjectName = `${iaCase.subject.rank.name} ${iaCase.subject.firstName} ${iaCase.subject.lastName}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/internal-affairs"
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux affaires internes
      </Link>

      <Panel>
        <div className="px-6 py-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-semibold text-mist-100">
              {iaCase.title}
            </h1>
            <Badge tone={sev.tone}>{sev.label}</Badge>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>

          <p className="mt-1 font-mono text-xs text-badge-300">
            {iaCase.reference}
          </p>

          <p className="mt-3 text-sm text-mist-300">
            Agent mis en cause :{" "}
            <Link
              href={`/roster/${iaCase.subject.id}`}
              className="font-medium text-mist-100 hover:text-badge-300"
            >
              {subjectName} #{iaCase.subject.badgeNumber}
            </Link>
          </p>
          <p className="text-xs text-mist-500">
            Instruit par {iaCase.investigator.firstName}{" "}
            {iaCase.investigator.lastName} · ouvert le{" "}
            {formatDate(iaCase.createdAt)}
            {iaCase.closedAt ? ` · clos le ${formatDate(iaCase.closedAt)}` : ""}
          </p>

          <div className="mt-4 border-t border-ink-700 pt-4">
            <p className="label-tag">Résumé des faits</p>
            <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-mist-300">
              {iaCase.summary}
            </p>
          </div>

          {iaCase.outcome ? (
            <div className="mt-4 rounded-lg border border-ink-700 bg-ink-850/60 px-4 py-3">
              <p className="label-tag">Conclusions</p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-mist-300">
                {iaCase.outcome}
              </p>
            </div>
          ) : null}
        </div>
      </Panel>

      {/* --- Notes d'enquête ----------------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Notes d'enquête"
          subtitle={`${iaCase.notes.length} note(s)`}
        />
        {iaCase.notes.length === 0 ? (
          <EmptyState
            title="Aucune note"
            description="Les éléments recueillis au fil de l'enquête apparaîtront ici."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {iaCase.notes.map((n) => (
              <li key={n.id} className="px-5 py-3.5">
                <p className="text-sm leading-relaxed whitespace-pre-line text-mist-300">
                  {n.body}
                </p>
                <p className="mt-2 text-xs text-mist-500">
                  {n.author.firstName} {n.author.lastName} ·{" "}
                  {formatDateTime(n.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
        {isOpen ? <NoteForm caseId={iaCase.id} /> : null}
      </Panel>

      {/* --- Sanctions ------------------------------------------------------ */}
      <Panel>
        <PanelHeader
          title="Sanctions"
          subtitle={`${iaCase.sanctions.length} sanction(s) prononcée(s)`}
        />
        {iaCase.sanctions.length > 0 ? (
          <ul className="divide-y divide-ink-700">
            {iaCase.sanctions.map((s) => (
              <li key={s.id} className="flex items-start gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="red">
                      {SANCTION_LABELS[s.type] ?? s.type}
                    </Badge>
                    {s.isPublic ? (
                      <Badge tone="amber">Publique</Badge>
                    ) : (
                      <Badge tone="neutral">Confidentielle</Badge>
                    )}
                    <span className="text-xs text-mist-500">
                      {formatDate(s.startsAt)}
                      {s.endsAt ? ` → ${formatDate(s.endsAt)}` : ""}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-mist-300">
                    {s.reason}
                  </p>
                </div>

                {canConclude ? (
                  <form action={liftSanction}>
                    <input type="hidden" name="sanctionId" value={s.id} />
                    <button
                      type="submit"
                      title="Lever la sanction"
                      className="rounded-md p-1 text-mist-500 transition-colors hover:text-alert-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {canConclude ? (
          <SanctionForm
            caseId={iaCase.id}
            subjectId={iaCase.subject.id}
            subjectName={subjectName}
          />
        ) : (
          <p className="border-t border-ink-700 px-5 py-4 text-xs leading-relaxed text-mist-500">
            Le prononcé des sanctions est réservé au Chief of Internal Affairs
            Division. Vous pouvez instruire le dossier et y verser des notes.
          </p>
        )}
      </Panel>

      {/* --- Clôture --------------------------------------------------------- */}
      {isOpen ? (
        canConclude ? (
          <Panel className="border-badge-500/40">
            <PanelHeader
              title="Clôturer le dossier"
              subtitle="Un dossier clos n'accepte plus de note"
            />
            <CloseCaseForm caseId={iaCase.id} />
          </Panel>
        ) : (
          <p className="rounded-lg border border-warn-500/40 bg-warn-500/10 px-4 py-3 text-sm text-warn-500">
            Seul le Chief of Internal Affairs Division peut clore un dossier.
          </p>
        )
      ) : null}
    </div>
  );
}
