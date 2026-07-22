import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { loadPickerData } from "@/lib/report-data";
import { parseTemplateSchema } from "@/lib/report-schema";
import { officerSignature } from "@/lib/utils";
import { ReportForm } from "../../report-form";

export const metadata = { title: "Modifier le rapport" };

export default async function EditReportPage({
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
    include: { template: true, templateVersion: true },
  });

  if (!report) notFound();
  if (report.authorId !== user.id && !user.isSuperAdmin) notFound();

  // Un rapport soumis est verrouillé le temps de la validation, et un rapport
  // validé l'est définitivement.
  if (report.status === "SUBMITTED" || report.status === "APPROVED") {
    redirect(`/reports/${report.id}`);
  }

  // On rédige avec la version du template en vigueur au moment de la création :
  // changer de structure en cours de rédaction perdrait les données saisies.
  const schema = parseTemplateSchema(report.templateVersion.schema);
  const { officers, penalCodes, civilians, vehicles } = await loadPickerData();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/reports/${report.id}`}
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au rapport
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-mist-100">{report.title}</h1>
        <p className="mt-1 font-mono text-xs text-badge-300">
          {report.reference}
        </p>
      </div>

      <ReportForm
        mode="edit"
        reportId={report.id}
        templateName={`${report.template.name}`}
        schema={schema}
        data={report.data as Record<string, unknown>}
        title={report.title}
        location={report.location ?? ""}
        officers={officers}
        civilians={civilians}
        vehicles={vehicles}
        penalCodes={penalCodes}
        requiresValidation={report.template.requiresValidation}
        signature={officerSignature(user)}
      />
    </div>
  );
}
