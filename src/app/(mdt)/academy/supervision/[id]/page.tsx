import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { formatDate, formatDateTime } from "@/lib/utils";
import { EvaluationForm, ExamForm, GraduateRookieButton } from "../forms";

export const metadata: Metadata = { title: "Évaluation d'un Rookie" };

export default async function RookieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModule("academy-supervision");
  const { id } = await params;
  const traineeId = Number(id);
  if (!Number.isInteger(traineeId)) notFound();

  const [rookie, subjects, exams, evaluations] = await Promise.all([
    db.user.findUnique({
      where: { id: traineeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        badgeNumber: true,
        promotion: true,
        recruitmentSession: true,
        recruitedAt: true,
        rank: { select: { name: true } },
      },
    }),
    db.academyExamSubject.findMany({ orderBy: { order: "asc" } }),
    db.academyExam.findMany({
      where: { candidateId: traineeId },
      orderBy: { examinedAt: "desc" },
      include: {
        examiner: { select: { firstName: true, lastName: true } },
        scores: { include: { subject: { select: { name: true, maxPoints: true } } } },
      },
    }),
    db.traineeEvaluation.findMany({
      where: { traineeId },
      orderBy: { createdAt: "desc" },
      include: { instructor: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  if (!rookie) notFound();

  const admitted = exams.some((e) => e.passed);

  return (
    <div className="space-y-6">
      <Link
        href="/academy/supervision"
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la supervision
      </Link>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-xl font-semibold text-mist-100">
              {rookie.firstName} {rookie.lastName}
            </h1>
            <p className="mt-1 text-sm text-mist-500">
              {rookie.rank.name} · #{rookie.badgeNumber} · à l&apos;académie
              depuis le {formatDate(rookie.recruitedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rookie.promotion ? (
              <Badge tone="blue">{rookie.promotion}</Badge>
            ) : null}
            {rookie.recruitmentSession ? (
              <Badge tone="neutral">{rookie.recruitmentSession}</Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-700 px-6 py-4">
          <div className="text-sm text-mist-300">
            {admitted ? (
              <span className="text-ok-500">
                Recrue admise — éligible à la sortie d&apos;académie.
              </span>
            ) : (
              "Aucun examen réussi (≥ 80 %) : la sortie d'académie n'est pas encore possible."
            )}
          </div>
          <GraduateRookieButton rookieId={rookie.id} admitted={admitted} />
        </div>
      </Panel>

      {/* --- Nouvelle notation --------------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Noter l'examen d'admission"
          subtitle="Barème sur 100 — admission à partir de 80 %"
        />
        <ExamForm
          candidateId={rookie.id}
          subjects={subjects.map((s) => ({
            id: s.id,
            name: s.name,
            maxPoints: s.maxPoints,
          }))}
        />
      </Panel>

      {/* --- Historique des examens ---------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Examens passés"
          subtitle={`${exams.length} examen(s)`}
        />
        {exams.length === 0 ? (
          <EmptyState
            title="Aucun examen"
            description="Aucune notation enregistrée pour cette recrue."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {exams.map((ex) => (
              <li key={ex.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Badge tone={ex.passed ? "green" : "red"}>
                    {ex.percentage}% · {ex.passed ? "Admis" : "Ajourné"}
                  </Badge>
                  <span className="text-sm text-mist-300">
                    {ex.totalPoints} / {ex.maxPoints} points
                  </span>
                  <span className="ml-auto text-xs text-mist-500">
                    {ex.examiner
                      ? `${ex.examiner.firstName} ${ex.examiner.lastName} · `
                      : ""}
                    {formatDateTime(ex.examinedAt)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mist-500">
                  {ex.scores.map((sc) => (
                    <span key={sc.id}>
                      {sc.subject.name} :{" "}
                      <span className="text-mist-300">
                        {sc.points}/{sc.subject.maxPoints}
                      </span>
                    </span>
                  ))}
                </div>
                {ex.comment ? (
                  <p className="mt-2 text-sm whitespace-pre-line text-mist-300">
                    {ex.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* --- Observations -------------------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Observations des instructeurs"
          subtitle={`${evaluations.length} observation(s)`}
        />
        {evaluations.length === 0 ? (
          <EmptyState
            title="Aucune observation"
            description="Consignez vos observations sur cette recrue."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {evaluations.map((ev) => (
              <li key={ev.id} className="px-5 py-3">
                <p className="text-sm whitespace-pre-line text-mist-100">
                  {ev.comment}
                </p>
                <p className="mt-1 text-xs text-mist-500">
                  {ev.instructor.firstName} {ev.instructor.lastName} ·{" "}
                  {formatDateTime(ev.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-ink-700">
          <EvaluationForm traineeId={rookie.id} />
        </div>
      </Panel>
    </div>
  );
}
