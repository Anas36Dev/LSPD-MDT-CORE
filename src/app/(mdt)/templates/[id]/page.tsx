import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Badge, Button, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { parseTemplateSchema } from "@/lib/report-schema";
import { formatDateTime } from "@/lib/utils";
import { toggleTemplate } from "../actions";
import { TemplateEditor } from "../editor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await db.reportTemplate.findUnique({
    where: { id: Number(id) },
    select: { name: true },
  });
  return { title: t ? t.name : "Template" };
}

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModule("templates");
  const { id } = await params;

  const templateId = Number(id);
  if (!Number.isInteger(templateId)) notFound();

  const [template, ranks] = await Promise.all([
    db.reportTemplate.findUnique({
      where: { id: templateId },
      include: {
        versions: { orderBy: { version: "desc" } },
        _count: { select: { reports: true } },
      },
    }),
    db.rank.findMany({
      orderBy: { level: "desc" },
      select: { id: true, name: true, level: true },
    }),
  ]);

  if (!template) notFound();

  const latest = template.versions[0];
  const schema = latest ? parseTemplateSchema(latest.schema) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/templates"
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux modèles
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">
            {template.name}
          </h1>
          <p className="mt-1 text-sm text-mist-500">
            {template._count.reports} rapport(s) rédigé(s) ·{" "}
            {template.versions.length} version(s)
          </p>
        </div>

        <form action={toggleTemplate}>
          <input type="hidden" name="id" value={template.id} />
          <Button
            type="submit"
            variant={template.isActive ? "danger" : "secondary"}
          >
            {template.isActive ? "Désactiver" : "Réactiver"}
          </Button>
        </form>
      </div>

      <TemplateEditor
        mode="edit"
        templateId={template.id}
        currentVersion={latest?.version}
        ranks={ranks}
        initial={{
          name: template.name,
          description: template.description ?? "",
          category: template.category,
          referencePrefix: template.referencePrefix,
          minRankLevel: template.minRankLevel,
          requiresValidation: template.requiresValidation,
          isActive: template.isActive,
          schema,
        }}
      />

      {template.versions.length > 1 ? (
        <Panel>
          <PanelHeader
            title="Historique des versions"
            subtitle="Chaque version reste attachée aux rapports rédigés avec elle"
          />
          <ul className="divide-y divide-ink-700">
            {template.versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between px-5 py-2.5"
              >
                <Badge tone={v.id === latest?.id ? "blue" : "neutral"}>
                  Version {v.version}
                  {v.id === latest?.id ? " · en vigueur" : ""}
                </Badge>
                <span className="text-xs text-mist-500">
                  {formatDateTime(v.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
