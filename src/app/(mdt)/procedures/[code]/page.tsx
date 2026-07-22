import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";

import { Badge, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";

/**
 * Catégories de grades qui structurent les fiches : rendues comme des titres
 * de section, et non comme un grade parmi d'autres.
 */
const STAFF_CATEGORIES = new Set([
  "RECRUE ACADÉMIQUE",
  "EXECUTIVE STAFF",
  "DETECTIVE STAFF",
  "SUPERVISOR STAFF",
  "COMMAND STAFF",
  "CHIEF OFFICE",
]);

/** Une ligne entièrement en majuscules (hors catégorie) est un nom de grade. */
function isGradeHeading(line: string) {
  const t = line.trim();
  return t.length > 0 && t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t);
}

function ProcedureContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="text-sm leading-relaxed text-mist-300">
      {lines.map((line, i) => {
        const t = line.trim();
        if (t === "") return <div key={i} className="h-2.5" />;

        // Niveau 1 — catégorie de grades (titre de section).
        if (STAFF_CATEGORIES.has(t.toUpperCase())) {
          return (
            <h3
              key={i}
              className="mt-6 mb-3 border-t border-ink-700 pt-4 text-base font-semibold tracking-wide text-gold-400 first:mt-0 first:border-0 first:pt-0"
            >
              {t}
            </h3>
          );
        }

        // Niveau 2 — nom de grade (sous-titre).
        if (isGradeHeading(line)) {
          return (
            <h4
              key={i}
              className="mt-4 mb-1 text-sm font-semibold uppercase tracking-wide text-mist-50"
            >
              {t}
            </h4>
          );
        }

        // Niveau 3 — description du rôle.
        return (
          <p key={i} className="whitespace-pre-line">
            {line}
          </p>
        );
      })}
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const text = await db.referenceText.findUnique({
    where: { code: decodeURIComponent(code) },
    select: { title: true },
  });
  return { title: text ? text.title : "Procédure" };
}

export default async function ProcedurePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  await requireModule("procedures");
  const { code } = await params;

  const all = await db.referenceText.findMany({
    where: { category: "CIRCULAIRE" },
    orderBy: { order: "asc" },
  });

  const index = all.findIndex((t) => t.code === decodeURIComponent(code));
  if (index === -1) notFound();

  const text = all[index];
  const previous = all[index - 1];
  const next = all[index + 1];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/procedures"
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Toutes les fiches circulaires
      </Link>

      <Panel>
        <PanelHeader
          title={text.title}
          subtitle="Los Santos Police Department"
          action={<Badge tone="gold">Confidentiel</Badge>}
        />
        <div className="px-6 py-5">
          <ProcedureContent content={text.content} />

          {text.notes ? (
            <div className="mt-5 rounded-lg border border-warn-500/30 bg-warn-500/5 px-4 py-3">
              <p className="label-tag mb-1 text-warn-500">Note</p>
              <p className="text-xs leading-relaxed whitespace-pre-line text-mist-300">
                {text.notes}
              </p>
            </div>
          ) : null}
        </div>
      </Panel>

      {/* Navigation séquentielle : les fiches se lisent dans l'ordre. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {previous ? (
          <Link
            href={`/procedures/${encodeURIComponent(previous.code)}`}
            className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900/80 px-4 py-3 transition-colors hover:border-badge-500/50"
          >
            <ArrowLeft className="h-4 w-4 shrink-0 text-mist-500" />
            <div className="min-w-0">
              <p className="label-tag">Précédente</p>
              <p className="truncate text-sm text-mist-100">{previous.title}</p>
            </div>
          </Link>
        ) : (
          <span />
        )}

        {next ? (
          <Link
            href={`/procedures/${encodeURIComponent(next.code)}`}
            className="flex items-center justify-end gap-3 rounded-xl border border-ink-700 bg-ink-900/80 px-4 py-3 text-right transition-colors hover:border-badge-500/50"
          >
            <div className="min-w-0">
              <p className="label-tag">Suivante</p>
              <p className="truncate text-sm text-mist-100">{next.title}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-mist-500" />
          </Link>
        ) : null}
      </div>

      <Panel>
        <PanelHeader title="Sommaire des fiches" />
        <ul className="divide-y divide-ink-700">
          {all.map((t) => (
            <li key={t.id}>
              <Link
                href={`/procedures/${encodeURIComponent(t.code)}`}
                className={`flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-ink-800/60 ${
                  t.code === text.code ? "bg-badge-600/10" : ""
                }`}
              >
                <BookOpen
                  className={`h-4 w-4 shrink-0 ${
                    t.code === text.code ? "text-badge-400" : "text-mist-500"
                  }`}
                />
                <span
                  className={`text-sm ${
                    t.code === text.code
                      ? "font-medium text-badge-300"
                      : "text-mist-300"
                  }`}
                >
                  {t.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
