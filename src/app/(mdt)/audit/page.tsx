import type { Metadata } from "next";
import Link from "next/link";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Journal d'audit" };

/**
 * Libellés et gravité des actions journalisées.
 * Une action inconnue s'affiche telle quelle plutôt que d'être masquée : mieux
 * vaut un libellé technique qu'une ligne invisible dans un journal d'audit.
 */
const ACTIONS: Record<
  string,
  { label: string; tone: "neutral" | "blue" | "green" | "amber" | "red" | "gold" }
> = {
  LOGIN: { label: "Connexion", tone: "neutral" },
  LOGOUT: { label: "Déconnexion", tone: "neutral" },
  LOGIN_FAILED: { label: "Échec de connexion", tone: "amber" },
  LOGIN_DISCORD_UNLINKED: {
    label: "Connexion Discord non rattachée",
    tone: "amber",
  },

  USER_CREATE: { label: "Création de compte", tone: "gold" },
  USER_UPDATE: { label: "Modification de compte", tone: "blue" },
  USER_ASSIGNMENTS: { label: "Affectations modifiées", tone: "blue" },
  USER_CERTIFICATIONS: { label: "Certifications modifiées", tone: "blue" },
  USER_DISCORD: { label: "Discord modifié", tone: "blue" },
  USER_PASSWORD_RESET: { label: "Mot de passe réinitialisé", tone: "red" },
  USER_STATUS: { label: "Statut de compte modifié", tone: "red" },

  MEDAL_AWARD: { label: "Décoration décernée", tone: "gold" },
  MEDAL_REVOKE: { label: "Décoration retirée", tone: "amber" },

  REPORT_DRAFT: { label: "Brouillon de rapport", tone: "neutral" },
  REPORT_SUBMIT: { label: "Rapport soumis", tone: "blue" },
  REPORT_UPDATE: { label: "Rapport modifié", tone: "neutral" },
  REPORT_APPROVED: { label: "Rapport validé", tone: "green" },
  REPORT_REJECTED: { label: "Rapport refusé", tone: "red" },
  REPORT_CHANGES_REQUESTED: { label: "Correction demandée", tone: "amber" },
  REPORT_DELETE: { label: "Rapport supprimé", tone: "red" },

  TEMPLATE_CREATE: { label: "Modèle créé", tone: "gold" },
  TEMPLATE_UPDATE: { label: "Modèle modifié", tone: "blue" },
  TEMPLATE_DISABLE: { label: "Modèle désactivé", tone: "amber" },
  TEMPLATE_ENABLE: { label: "Modèle réactivé", tone: "green" },

  CIVILIAN_CREATE: { label: "Fiche civile créée", tone: "neutral" },
  CIVILIAN_UPDATE: { label: "Fiche civile modifiée", tone: "neutral" },
  CIVILIAN_DELETE: { label: "Fiche civile supprimée", tone: "red" },
  VEHICLE_CREATE: { label: "Véhicule ajouté", tone: "neutral" },
  VEHICLE_UPDATE: { label: "Véhicule modifié", tone: "neutral" },
  VEHICLE_DELETE: { label: "Véhicule supprimé", tone: "amber" },
  LICENSE_UPDATE: { label: "Permis modifié", tone: "blue" },
  CRIMINAL_RECORD_ADD: { label: "Ajout au casier", tone: "amber" },
  CRIMINAL_RECORD_DELETE: { label: "Retrait du casier", tone: "red" },

  WARRANT_ISSUE: { label: "Mandat émis", tone: "red" },
  WARRANT_STATUS: { label: "Statut de mandat modifié", tone: "blue" },
  BOLO_ISSUE: { label: "Avis de recherche diffusé", tone: "amber" },
  BOLO_CLOSE: { label: "Avis de recherche clos", tone: "neutral" },

  ANNOUNCEMENT_CREATE: { label: "Annonce publiée", tone: "blue" },
  ANNOUNCEMENT_DELETE: { label: "Annonce retirée", tone: "amber" },
  MESSAGE_SEND: { label: "Message envoyé", tone: "neutral" },

  TRANSFER_APPLY: { label: "Candidature déposée", tone: "neutral" },
  TRANSFER_ACCEPTED: { label: "Mutation acceptée", tone: "green" },
  TRANSFER_REJECTED: { label: "Mutation refusée", tone: "amber" },
};

const PAGE_SIZE = 100;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  await requireModule("audit");
  const { action, page } = await searchParams;

  const currentPage = Math.max(1, Number(page) || 1);
  const where = action ? { action } : {};

  const [entries, total, distinct] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            badgeNumber: true,
          },
        },
      },
    }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({
      by: ["action"],
      _count: true,
      orderBy: { _count: { action: "desc" } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          Journal d&apos;audit
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          {total} action(s) journalisée(s) · traçabilité des opérations
          sensibles du terminal
        </p>
      </div>

      {/* Filtres : liens plutôt que formulaire, pour rester partageables. */}
      <Panel>
        <PanelHeader title="Filtrer par type d'action" />
        <div className="flex flex-wrap gap-1.5 px-5 py-4">
          <Link
            href="/audit"
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
              !action
                ? "border-badge-500/50 bg-badge-600/20 text-badge-300"
                : "border-ink-600 text-mist-500 hover:text-mist-100"
            }`}
          >
            Tout ({total})
          </Link>
          {distinct.map((d) => (
            <Link
              key={d.action}
              href={`/audit?action=${encodeURIComponent(d.action)}`}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                action === d.action
                  ? "border-badge-500/50 bg-badge-600/20 text-badge-300"
                  : "border-ink-600 text-mist-500 hover:text-mist-100"
              }`}
            >
              {ACTIONS[d.action]?.label ?? d.action} ({d._count})
            </Link>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Événements"
          subtitle={`Page ${currentPage} sur ${totalPages}`}
        />
        {entries.length === 0 ? (
          <EmptyState
            title="Aucun événement"
            description="Le journal se remplit au fil de l'activité du terminal."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {entries.map((e) => {
              const a = ACTIONS[e.action] ?? {
                label: e.action,
                tone: "neutral" as const,
              };
              return (
                <li key={e.id} className="flex flex-wrap items-baseline gap-3 px-5 py-2.5">
                  <span className="w-36 shrink-0 font-mono text-xs text-mist-500">
                    {formatDateTime(e.createdAt)}
                  </span>
                  <Badge tone={a.tone}>{a.label}</Badge>

                  {e.user ? (
                    <Link
                      href={`/roster/${e.user.id}`}
                      className="text-sm text-mist-100 hover:text-badge-300"
                    >
                      {e.user.firstName} {e.user.lastName} #{e.user.badgeNumber}
                    </Link>
                  ) : (
                    <span className="text-sm text-mist-500">Système</span>
                  )}

                  {e.detail ? (
                    <span className="min-w-0 flex-1 truncate text-xs text-mist-500">
                      {e.detail}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-ink-700 px-5 py-3">
            <PageLink
              page={currentPage - 1}
              action={action}
              disabled={currentPage <= 1}
            >
              Précédent
            </PageLink>
            <span className="text-xs text-mist-500">
              {currentPage} / {totalPages}
            </span>
            <PageLink
              page={currentPage + 1}
              action={action}
              disabled={currentPage >= totalPages}
            >
              Suivant
            </PageLink>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function PageLink({
  page,
  action,
  disabled,
  children,
}: {
  page: number;
  action?: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="cursor-not-allowed rounded-md border border-ink-700 px-3 py-1.5 text-xs text-mist-500/50">
        {children}
      </span>
    );
  }

  const params = new URLSearchParams();
  if (action) params.set("action", action);
  params.set("page", String(page));

  return (
    <Link
      href={`/audit?${params.toString()}`}
      className="rounded-md border border-ink-600 px-3 py-1.5 text-xs text-mist-300 transition-colors hover:bg-ink-800"
    >
      {children}
    </Link>
  );
}
