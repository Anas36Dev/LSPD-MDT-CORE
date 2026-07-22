import type { Metadata } from "next";
import { Eye, ShieldAlert } from "lucide-react";

import { Badge, Button, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { isDepartmentHead, isPreviewing, visibleModules } from "@/lib/permissions";
import { readPreview } from "@/lib/preview";
import { startPreview, stopPreview } from "./actions";
import { PreviewForm } from "./form";

export const metadata: Metadata = { title: "Aperçu de rôle" };

export default async function PreviewPage() {
  const user = await requireUser();

  // Le grade réel commande l'accès : en aperçu, `user` porte le grade simulé.
  const previewing = isPreviewing(user);
  if (!previewing && !isDepartmentHead(user)) {
    return (
      <div className="mx-auto max-w-2xl">
        <Panel className="border-warn-500/40">
          <div className="flex items-start gap-3 px-5 py-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn-500" />
            <div>
              <p className="text-sm font-medium text-warn-500">
                Fonction réservée au chef du département
              </p>
              <p className="mt-1 text-sm text-mist-300">
                L&apos;aperçu de rôle permet de vérifier ce que voit chaque
                grade. Seul le Chief of Police peut l&apos;activer.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  const [ranks, divisions, divisionRoles, subDivisions, certifications] =
    await Promise.all([
      db.rank.findMany({ orderBy: { level: "desc" } }),
      db.division.findMany({ orderBy: { order: "asc" } }),
      db.divisionRole.findMany({
        orderBy: { order: "asc" },
        include: { division: { select: { shortName: true } } },
      }),
      db.subDivision.findMany({
        orderBy: { order: "asc" },
        include: { division: { select: { shortName: true } } },
      }),
      db.certification.findMany({ orderBy: { order: "asc" } }),
    ]);

  const current = await readPreview();
  const modules = visibleModules(user);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">Aperçu de rôle</h1>
        <p className="mt-1 text-sm text-mist-500">
          Visualisez le terminal tel que le voit un autre grade, sans créer de
          compte de test
        </p>
      </div>

      {previewing ? (
        <Panel className="border-gold-500/50 bg-gold-600/5">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-start gap-3">
              <Eye className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" />
              <div>
                <p className="text-sm font-medium text-gold-400">
                  Aperçu actif — {user.rank.name}
                </p>
                <p className="mt-1 text-xs text-mist-300">
                  Vous êtes réellement {user.preview?.realName} (
                  {user.preview?.realRankName}). Aucune modification
                  n&apos;est possible tant que l&apos;aperçu est actif.
                </p>
                <p className="mt-1.5 text-xs text-mist-500">
                  {modules.length} module(s) visible(s) sous ce rôle :{" "}
                  {modules.map((m) => m.label).join(", ")}
                </p>
              </div>
            </div>

            <form action={stopPreview}>
              <Button type="submit" variant="secondary">
                Quitter l&apos;aperçu
              </Button>
            </form>
          </div>
        </Panel>
      ) : (
        <Panel className="px-5 py-4">
          <p className="text-xs leading-relaxed text-mist-300">
            L&apos;aperçu ne modifie rien en base : il réécrit temporairement
            votre profil de session. Toute action d&apos;écriture est refusée
            pendant l&apos;aperçu, afin que le journal d&apos;audit n&apos;attribue
            jamais à un grade simulé un acte que vous auriez commis. Il expire
            automatiquement au bout d&apos;une heure.
          </p>
        </Panel>
      )}

      <Panel>
        <PanelHeader
          title="Choisir le rôle à simuler"
          subtitle="Grade, affectations et habilitations"
        />
        <form action={startPreview}>
          <PreviewForm
            ranks={ranks.map((r) => ({
              code: r.code,
              name: r.name,
              level: r.level,
            }))}
            divisions={divisions.map((d) => ({ code: d.code, name: d.name }))}
            divisionRoles={divisionRoles.map((r) => ({
              code: r.code,
              label: r.name,
              hint: r.division.shortName,
            }))}
            subDivisions={subDivisions.map((s) => ({
              code: s.code,
              label: s.name,
              hint: s.division.shortName,
            }))}
            certifications={certifications.map((c) => ({
              code: c.code,
              label: c.name,
              hint: c.category,
            }))}
            current={current}
          />
        </form>
      </Panel>

      <Panel>
        <PanelHeader
          title="Raccourcis"
          subtitle="Les rôles les plus utiles à contrôler"
        />
        <div className="flex flex-wrap gap-2 px-5 py-4">
          {[
            { code: "ROOKIE", label: "Rookie" },
            { code: "POLICE_OFFICER_I", label: "Police Officer I" },
            { code: "POLICE_OFFICER_III", label: "Police Officer III" },
            { code: "SERGEANT_I", label: "Sergeant I" },
            { code: "LIEUTENANT_I", label: "Lieutenant I" },
            { code: "COMMANDER", label: "Commander" },
            { code: "DEPUTY_CHIEF", label: "Deputy Chief" },
          ]
            .filter((s) => ranks.some((r) => r.code === s.code))
            .map((s) => (
              <form key={s.code} action={startPreview}>
                <input type="hidden" name="rankCode" value={s.code} />
                <button
                  type="submit"
                  className="rounded-md border border-ink-600 px-3 py-1.5 text-xs text-mist-300 transition-colors hover:border-gold-500/50 hover:text-gold-400"
                >
                  {s.label}
                </button>
              </form>
            ))}
        </div>
        <p className="border-t border-ink-700 px-5 py-3 text-xs text-mist-500">
          Ces raccourcis simulent le grade seul, sans division ni habilitation.
        </p>
      </Panel>

      <Panel>
        <PanelHeader title="Modules visibles actuellement" />
        <div className="flex flex-wrap gap-1.5 px-5 py-4">
          {modules.map((m) => (
            <Badge key={m.key} tone={previewing ? "gold" : "blue"}>
              {m.label}
            </Badge>
          ))}
        </div>
      </Panel>
    </div>
  );
}
