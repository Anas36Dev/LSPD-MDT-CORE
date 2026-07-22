import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { TemplateEditor } from "../editor";

export const metadata: Metadata = { title: "Nouveau modèle" };

export default async function NewTemplatePage() {
  await requireModule("templates");

  const ranks = await db.rank.findMany({
    orderBy: { level: "desc" },
    select: { id: true, name: true, level: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/templates"
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux modèles
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          Nouveau modèle de rapport
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          Composez le formulaire section par section. Les agents le rempliront
          tel quel.
        </p>
      </div>

      <TemplateEditor
        mode="create"
        ranks={ranks}
        initial={{
          name: "",
          description: "",
          category: "REPORT",
          referencePrefix: "LSPD",
          minRankLevel: 37,
          requiresValidation: true,
          isActive: true,
          schema: [{ title: "Informations générales", fields: [] }],
        }}
      />
    </div>
  );
}
