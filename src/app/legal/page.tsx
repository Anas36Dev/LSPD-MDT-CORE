import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Gamepad2,
  ScrollText,
} from "lucide-react";

import { Panel, PanelHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Mentions légales & CGU" };

const CORE_URL = "https://sites.google.com/view/core-project-fivem/home";

export default function LegalPage() {
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au MDT
        </Link>

        <div>
          <h1 className="text-xl font-semibold text-mist-100">
            Mentions légales &amp; Conditions Générales d&apos;Utilisation
          </h1>
          <p className="mt-1 text-sm text-mist-500">
            Los Santos Police Department — MDT · CORE France Project
          </p>
        </div>

        {/* --- Avertissement : tout est fictif ------------------------------ */}
        <div className="flex items-start gap-3 rounded-xl border border-gold-500/40 bg-gold-600/10 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" />
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-gold-400">
              Univers entièrement fictif — Roleplay uniquement
            </p>
            <p className="text-sm leading-relaxed text-mist-300">
              L&apos;intégralité du contenu de ce terminal (agents, grades,
              civils, véhicules, casiers, rapports, mandats, enquêtes, etc.) est{" "}
              <span className="font-medium text-mist-100">purement fictive</span>{" "}
              et créée dans le seul cadre du{" "}
              <span className="font-medium text-mist-100">jeu de rôle (RP)</span>{" "}
              sur <span className="font-medium text-mist-100">GTA RP</span>. Aucune
              donnée ne correspond à des personnes, faits ou institutions réels.
              Toute ressemblance avec la réalité serait purement fortuite.
            </p>
          </div>
        </div>

        {/* --- Nature du site ----------------------------------------------- */}
        <Panel>
          <PanelHeader title="Nature du site" subtitle="À quoi sert ce terminal" />
          <div className="space-y-3 px-5 py-4 text-sm leading-relaxed text-mist-300">
            <p className="flex items-start gap-2">
              <Gamepad2 className="mt-0.5 h-4 w-4 shrink-0 text-mist-500" />
              <span>
                Ce site est un{" "}
                <span className="font-medium text-mist-100">
                  Mobile Data Terminal (MDT)
                </span>{" "}
                de simulation, destiné exclusivement à l&apos;animation de
                sessions de{" "}
                <span className="font-medium text-mist-100">roleplay</span> sur
                serveur GTA RP (Grand Theft Auto V / FiveM).
              </span>
            </p>
            <p>
              Il s&apos;agit d&apos;un outil communautaire à but non lucratif. Il
              ne constitue en aucun cas un service officiel, administratif ou
              policier, et n&apos;a aucune valeur légale, contractuelle ou
              probante dans le monde réel.
            </p>
          </div>
        </Panel>

        {/* --- Édition & gestion -------------------------------------------- */}
        <Panel>
          <PanelHeader title="Édition & gestion" subtitle="Responsable du projet" />
          <div className="space-y-3 px-5 py-4 text-sm leading-relaxed text-mist-300">
            <p>
              Ce terminal est{" "}
              <span className="font-medium text-mist-100">
                réservé au LSPD du CORE France Project
              </span>
              , et{" "}
              <span className="font-medium text-mist-100">
                entièrement dirigé et géré par Anas
              </span>
              .
            </p>
            <p>
              <span className="font-medium text-mist-100">
                Toute reproduction, copie ou réutilisation
              </span>{" "}
              de ce terminal, de son code ou de son organisation est{" "}
              <span className="font-medium text-alert-500">
                strictement interdite
              </span>{" "}
              sans autorisation expresse du CORE France Project.
            </p>
            <a
              href={CORE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-badge-500/50 bg-badge-600/15 px-3.5 py-2 text-sm text-badge-300 transition-colors hover:bg-badge-600/25"
            >
              <ExternalLink className="h-4 w-4" />
              CORE France Project — site officiel
            </a>
          </div>
        </Panel>

        {/* --- CGU ---------------------------------------------------------- */}
        <Panel>
          <PanelHeader
            title="Conditions Générales d'Utilisation"
            subtitle="Règles d'usage du terminal"
            action={<ScrollText className="h-4 w-4 text-mist-500" />}
          />
          <div className="space-y-4 px-5 py-4 text-sm leading-relaxed text-mist-300">
            <div>
              <p className="font-medium text-mist-100">
                1. Cadre d&apos;utilisation
              </p>
              <p className="mt-1">
                L&apos;accès au terminal est strictement réservé aux membres
                autorisés du LSPD du CORE France Project, dans le seul cadre du
                roleplay. Chaque compte est nominatif et son usage relève de la
                responsabilité de son titulaire. Toute connexion est journalisée.
              </p>
            </div>
            <div>
              <p className="font-medium text-mist-100">2. Contenu fictif</p>
              <p className="mt-1">
                Toutes les données saisies (fiches, rapports, mandats, notes,
                évaluations…) sont fictives et destinées à l&apos;immersion RP. Il
                est interdit d&apos;y renseigner des données personnelles réelles
                (identité, coordonnées, éléments privés) de qui que ce soit.
              </p>
            </div>
            <div>
              <p className="font-medium text-mist-100">
                3. Reproduction interdite
              </p>
              <p className="mt-1">
                La reproduction, la redistribution ou l&apos;imitation de ce
                terminal — en tout ou partie — est interdite. L&apos;outil, son
                code et son organisation demeurent la propriété du CORE France
                Project.
              </p>
            </div>
            <div>
              <p className="font-medium text-mist-100">
                4. Marques & univers tiers
              </p>
              <p className="mt-1">
                Les marques, jeux et univers tiers (Grand Theft Auto, Rockstar
                Games, FiveM…) appartiennent à leurs détenteurs respectifs et ne
                sont mentionnés qu&apos;à titre de contexte. Le projet décline
                toute responsabilité quant à l&apos;usage fait du terminal en
                dehors du cadre RP prévu.
              </p>
            </div>
            <div>
              <p className="font-medium text-mist-100">5. Évolution</p>
              <p className="mt-1">
                Ces conditions peuvent évoluer à tout moment. La poursuite de
                l&apos;utilisation du terminal vaut acceptation de la version en
                vigueur.
              </p>
            </div>
          </div>
        </Panel>

        <p className="text-center text-xs text-mist-600">
          © CORE France Project — dirigé et géré par Anas. Projet communautaire
          fictif à but non lucratif. Reproduction strictement interdite.
        </p>
      </div>
    </main>
  );
}
