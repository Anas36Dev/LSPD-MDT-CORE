import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { loadPickerData } from "@/lib/report-data";
import { parseTemplateSchema } from "@/lib/report-schema";
import { officerSignature } from "@/lib/utils";
import { ReportForm } from "../../report-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const t = await db.reportTemplate.findUnique({
    where: { id: Number(templateId) },
    select: { name: true },
  });
  return { title: t ? t.name : "Nouveau rapport" };
}

export default async function NewReportFromTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const user = await requireModule("reports");
  const { templateId } = await params;

  const id = Number(templateId);
  if (!Number.isInteger(id)) notFound();

  const template = await db.reportTemplate.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  if (!template || !template.isActive) notFound();

  const version = template.versions[0];
  if (!version) notFound();

  if (!user.isSuperAdmin && user.rank.level < template.minRankLevel) {
    notFound();
  }

  const schema = parseTemplateSchema(version.schema);
  const { officers, penalCodes, civilians, vehicles } = await loadPickerData();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={template.category === "COMPLAINT" ? "/complaints/new" : "/reports/new"}
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Changer de modèle
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-mist-100">{template.name}</h1>
        {template.description ? (
          <p className="mt-1 text-sm text-mist-500">{template.description}</p>
        ) : null}
      </div>

      <ReportForm
        mode="create"
        templateId={template.id}
        templateName={`${template.name}`}
        schema={schema}
        data={{}}
        title=""
        location=""
        officers={officers}
        civilians={civilians}
        vehicles={vehicles}
        penalCodes={penalCodes}
        requiresValidation={template.requiresValidation}
        signature={officerSignature(user)}
      />
    </div>
  );
}
