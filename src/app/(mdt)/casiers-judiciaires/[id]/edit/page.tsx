import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { officerSignature } from "@/lib/utils";
import { CivilianForm, type CivilianDraft } from "../../forms";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await db.civilian.findUnique({
    where: { id: Number(id) },
    select: { firstName: true, lastName: true },
  });
  return { title: c ? `Modifier — ${c.firstName} ${c.lastName}` : "Casier" };
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditCasierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("civilians");
  const { id } = await params;

  const civilian = await db.civilian.findUnique({
    where: { id: Number(id) },
  });
  if (!civilian) notFound();

  const initial: CivilianDraft = {
    id: civilian.id,
    firstName: civilian.firstName,
    lastName: civilian.lastName,
    dateOfBirth: iso(civilian.dateOfBirth),
    placeOfBirth: civilian.placeOfBirth ?? "",
    nationality: civilian.nationality ?? "",
    gender: civilian.gender ?? "",
    address: civilian.address ?? "",
    phone: civilian.phone ?? "",
    height: civilian.height ?? "",
    weight: civilian.weight ?? "",
    eyeColor: civilian.eyeColor ?? "",
    hairColor: civilian.hairColor ?? "",
    hasTattoos: civilian.hasTattoos,
    tattoosDescription: civilian.tattoosDescription ?? "",
    groupuscule: civilian.groupuscule ?? "",
    photoUrl: civilian.photoUrl ?? "",
    notes: civilian.notes ?? "",
    isFlagged: civilian.isFlagged,
    flagReason: civilian.flagReason ?? "",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/casiers-judiciaires/${civilian.id}`}
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au casier
      </Link>

      <Panel>
        <PanelHeader
          title={`Modifier — ${civilian.firstName} ${civilian.lastName}`}
          subtitle={civilian.reference}
        />
        <div className="px-6 py-5">
          <CivilianForm
            mode="edit"
            initial={initial}
            signature={officerSignature(user)}
          />
        </div>
      </Panel>
    </div>
  );
}
