import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";

import { Badge, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { can } from "@/lib/permissions";
import {
  computeSentence,
  parseTemplateSchema,
  type PenalEntry,
  type ReportField,
} from "@/lib/report-schema";
import { formatDateTime, officerSignature } from "@/lib/utils";
import { deleteReport } from "../actions";
import { STATUS } from "../page";
import { ReviewForm } from "./review-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await db.report.findUnique({
    where: { id: Number(id) },
    select: { reference: true },
  });
  return { title: r ? r.reference : "Rapport" };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("reports");
  const { id } = await params;

  const reportId = Number(id);
  if (!Number.isInteger(reportId)) notFound();

  const report = await db.report.findUnique({
    where: { id: reportId },
    include: {
      template: true,
      templateVersion: true,
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          badgeNumber: true,
          rank: { select: { name: true } },
        },
      },
      validations: {
        orderBy: { createdAt: "desc" },
        include: {
          reviewer: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!report) notFound();

  const isAuthor = report.author.id === user.id;
  const isReviewer = can.validateReports(user);

  // Un rapport n'est lisible que par son auteur et par les superviseurs :
  // le contenu est souvent nominatif et parfois sensible.
  if (!isAuthor && !isReviewer) notFound();

  const schema = parseTemplateSchema(report.templateVersion.schema);
  const data = report.data as Record<string, unknown>;
  const status = STATUS[report.status] ?? STATUS.DRAFT;

  // Les plaintes/dépositions réutilisent cette page mais relèvent d'un autre
  // onglet : le lien de retour doit y ramener.
  const isComplaint = report.template.category === "COMPLAINT";
  const backHref = isComplaint ? "/complaints" : "/reports";
  const backLabel = isComplaint
    ? "Retour aux plaintes & dépositions"
    : "Retour aux rapports";

  const [officers, penalCodes] = await Promise.all([
    db.user.findMany({
      select: { id: true, firstName: true, lastName: true, badgeNumber: true },
    }),
    db.penalCode.findMany({
      select: {
        code: true,
        title: true,
        fine: true,
        jailTime: true,
        isLifeSentence: true,
        requiresDoj: true,
      },
    }),
  ]);

  const officerName = (id: string) => {
    const o = officers.find((x) => String(x.id) === id);
    return o ? `${o.firstName} ${o.lastName} #${o.badgeNumber}` : id;
  };

  const canEdit =
    isAuthor &&
    (report.status === "DRAFT" ||
      report.status === "CHANGES_REQUESTED" ||
      report.status === "REJECTED");

  const canDelete =
    (isAuthor && report.status === "DRAFT") || can.validateReports(user);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg font-semibold text-mist-100">
                {report.title}
              </h1>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <p className="mt-1 font-mono text-xs text-badge-300">
              {report.reference}
            </p>
            <p className="mt-2 text-xs text-mist-500">
              {report.template.name} ·
              rédigé par {report.author.rank.name} {report.author.firstName}{" "}
              {report.author.lastName} #{report.author.badgeNumber}
            </p>
            <p className="text-xs text-mist-500">
              Créé le {formatDateTime(report.createdAt)}
              {report.submittedAt
                ? ` · soumis le ${formatDateTime(report.submittedAt)}`
                : ""}
              {report.location ? ` · ${report.location}` : ""}
            </p>
          </div>

          <div className="flex gap-2">
            {canEdit ? (
              <Link
                href={`/reports/${report.id}/edit`}
                className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-xs text-mist-300 transition-colors hover:bg-ink-800"
              >
                <Pencil className="h-3.5 w-3.5" />
                Modifier
              </Link>
            ) : null}
            {canDelete ? (
              <form action={deleteReport}>
                <input type="hidden" name="id" value={report.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-xs text-mist-500 transition-colors hover:border-alert-500/50 hover:text-alert-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </Panel>

      {/* --- Contenu du rapport ------------------------------------------- */}
      {schema.map((section) => (
        <Panel key={section.title}>
          <PanelHeader title={section.title} />
          <dl className="divide-y divide-ink-700">
            {section.fields.map((field) => (
              <div key={field.key} className="px-5 py-3">
                <dt className="label-tag">{field.label}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-mist-100">
                  <FieldValue
                    field={field}
                    value={data[field.key]}
                    officerName={officerName}
                    penalCodes={penalCodes}
                  />
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      ))}

      {/* --- Signature de l'auteur ----------------------------------------- */}
      {report.authorSignature ? (
        <Panel>
          <div className="flex flex-col gap-1 px-5 py-4">
            <span className="label-tag">Signature de l&apos;agent rédigeant</span>
            <p className="mt-1 border-t border-dashed border-ink-600 pt-2 font-serif text-base italic text-mist-100">
              {report.authorSignature}
            </p>
            {report.submittedAt ? (
              <p className="text-xs text-mist-500">
                Signé le {formatDateTime(report.submittedAt)}
              </p>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {/* --- Historique de validation -------------------------------------- */}
      {report.validations.length > 0 ? (
        <Panel>
          <PanelHeader title="Historique de validation" />
          <ul className="divide-y divide-ink-700">
            {report.validations.map((v) => {
              const s = STATUS[v.decision] ?? STATUS.DRAFT;
              return (
                <li key={v.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <span className="text-xs text-mist-500">
                      {v.reviewer.firstName} {v.reviewer.lastName} ·{" "}
                      {formatDateTime(v.createdAt)}
                    </span>
                  </div>
                  {v.comment ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-mist-300">
                      {v.comment}
                    </p>
                  ) : null}
                  {v.signature ? (
                    <p className="mt-1.5 font-serif text-sm italic text-mist-200">
                      {v.signature}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      {/* --- Décision du superviseur --------------------------------------- */}
      {isReviewer && report.status === "SUBMITTED" ? (
        <Panel className="border-badge-500/40">
          <PanelHeader
            title="Décision"
            subtitle={
              isAuthor
                ? "Vous validez votre propre document : signez ici en tant que superviseur"
                : "Validez, refusez ou demandez une correction"
            }
          />
          <ReviewForm reportId={report.id} signature={officerSignature(user)} />
        </Panel>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Affichage d'une valeur selon son type
// ---------------------------------------------------------------------------

function FieldValue({
  field,
  value,
  officerName,
  penalCodes,
}: {
  field: ReportField;
  value: unknown;
  officerName: (id: string) => string;
  penalCodes: PenalEntry[];
}) {
  const empty = <span className="text-mist-500">—</span>;

  if (value === null || value === undefined || value === "") return empty;

  if (field.type === "checkbox") {
    return value === true ? (
      <Badge tone="green">Oui</Badge>
    ) : (
      <Badge tone="neutral">Non</Badge>
    );
  }

  if (field.type === "penal_code_picker") {
    const codes = Array.isArray(value) ? value.map(String) : [];
    if (codes.length === 0) return empty;

    const charges = penalCodes.filter((p) => codes.includes(p.code));
    const sentence = computeSentence(charges);

    return (
      <div className="space-y-2">
        <ul className="space-y-1">
          {charges.map((c) => (
            <li key={c.code} className="flex gap-3 text-sm">
              <span className="w-24 shrink-0 font-mono text-xs text-badge-300">
                {c.code}
              </span>
              <span className="flex-1">{c.title}</span>
              <span className="text-xs text-mist-500">
                {c.fine != null ? `${c.fine.toLocaleString("fr-FR")} $` : ""}
                {c.isLifeSentence
                  ? " · perpétuité"
                  : c.jailTime
                    ? ` · ${c.jailTime} min`
                    : ""}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 border-t border-ink-700 pt-2">
          <Badge tone="neutral">
            Amendes : {sentence.totalFine.toLocaleString("fr-FR")} $
          </Badge>
          <Badge tone="amber">
            Peine :{" "}
            {sentence.isLifeSentence
              ? "perpétuité"
              : `${sentence.jailTime} min`}
          </Badge>
          {sentence.requiresDoj ? <Badge tone="gold">DOJ</Badge> : null}
          {sentence.requiresFederalConvoy ? (
            <Badge tone="red">Convoi fédéral</Badge>
          ) : null}
        </div>
      </div>
    );
  }

  if (field.type === "officer_picker") {
    const ids = Array.isArray(value) ? value.map(String) : [];
    if (ids.length === 0) return empty;
    return (
      <div className="flex flex-wrap gap-1.5">
        {ids.map((i) => (
          <Badge key={i} tone="blue">
            {officerName(i)}
          </Badge>
        ))}
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return empty;
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <Badge key={String(v)}>{String(v)}</Badge>
        ))}
      </div>
    );
  }

  if (field.type === "datetime" || field.type === "date") {
    const d = new Date(String(value));
    return <>{Number.isNaN(d.getTime()) ? String(value) : formatDateTime(d)}</>;
  }

  return <span className="whitespace-pre-line">{String(value)}</span>;
}
