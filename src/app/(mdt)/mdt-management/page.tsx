import type { Metadata } from "next";
import { Check, X } from "lucide-react";

import { Panel, PanelHeader } from "@/components/ui";
import { requireModule } from "@/lib/guard";
import { WipeForm } from "./forms";

export const metadata: Metadata = { title: "Gestion MDT" };

const WIPED = [
  "Rapports & plaintes / dépositions",
  "Certificats d'armes",
  "Enquêtes",
  "Groupuscules",
  "Mandats & avis de recherche",
  "Dossiers de preuves (et fichiers)",
  "Civils saisis à la main",
];

const KEPT = [
  "Comptes des agents et leurs grades",
  "Demandes de mutation",
  "Binômes",
  "Notes de supervision sur les agents",
  "Documents de division & d'académie",
  "Annonces du Command Staff",
  "Convocations",
  "Messagerie & groupes de messages",
  "Civils liés à un agent (annuaire)",
];

export default async function MdtManagementPage() {
  await requireModule("mdt-management");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">Gestion MDT</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader title="Sera supprimé" />
          <ul className="space-y-2 px-5 py-4">
            {WIPED.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-mist-200">
                <X className="h-4 w-4 shrink-0 text-alert-500" />
                {item}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelHeader title="Sera conservé" />
          <ul className="space-y-2 px-5 py-4">
            {KEPT.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-mist-200">
                <Check className="h-4 w-4 shrink-0 text-ok-500" />
                {item}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel className="border-alert-500/40">
        <PanelHeader
          title="Réinitialiser les données opérationnelles"
          subtitle="Action irréversible"
        />
        <WipeForm />
      </Panel>
    </div>
  );
}
