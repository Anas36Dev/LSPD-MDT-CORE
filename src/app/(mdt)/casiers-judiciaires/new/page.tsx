import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Panel, PanelHeader } from "@/components/ui";
import { requireModule } from "@/lib/guard";
import { officerSignature } from "@/lib/utils";
import { CivilianForm, type CivilianDraft } from "../forms";

export const metadata: Metadata = { title: "Nouveau casier" };

const EMPTY: CivilianDraft = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  placeOfBirth: "",
  nationality: "",
  gender: "",
  address: "",
  phone: "",
  height: "",
  weight: "",
  eyeColor: "",
  hairColor: "",
  hasTattoos: false,
  tattoosDescription: "",
  groupuscule: "",
  photoUrl: "",
  notes: "",
  isFlagged: false,
  flagReason: "",
};

export default async function NewCasierPage() {
  const user = await requireModule("civilians");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/casiers-judiciaires"
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux casiers
      </Link>

      <Panel>
        <PanelHeader
          title="Nouveau casier judiciaire"
          subtitle="Fiche d'un individu et de ses antécédents"
        />
        <div className="px-6 py-5">
          <CivilianForm
            mode="create"
            initial={EMPTY}
            signature={officerSignature(user)}
          />
        </div>
      </Panel>
    </div>
  );
}
