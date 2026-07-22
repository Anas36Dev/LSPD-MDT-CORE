import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Award, X } from "lucide-react";

import { AgentAvatar } from "@/components/agent-avatar";
import { Badge, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import {
  can,
  canHoldDivision,
  isDepartmentHead,
  SWORN_LEVEL,
} from "@/lib/permissions";
import { LEFT_STATUSES } from "@/lib/account-status";
import { formatDate } from "@/lib/utils";
import { revokeMedal } from "../actions";
import {
  AssignmentsForm,
  CertificationsForm,
  DeleteAccountForm,
  DiscordForm,
  IdentityForm,
  MedalCitationForm,
  MedalForm,
  PasswordForm,
  StatusForm,
} from "../forms";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await db.user.findUnique({
    where: { id: Number(id) },
    select: { firstName: true, lastName: true },
  });
  return { title: agent ? `${agent.firstName} ${agent.lastName}` : "Compte" };
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("accounts");
  const { id } = await params;

  const agentId = Number(id);
  if (!Number.isInteger(agentId)) notFound();

  const [agent, ranks, divisions, subDivisions, roles, certifications, medals] =
    await Promise.all([
      db.user.findUnique({
        where: { id: agentId },
        include: {
          rank: true,
          divisions: true,
          subDivisions: true,
          divisionRoles: true,
          certifications: { where: { revokedAt: null } },
          unionMembership: true,
          medals: { include: { medal: true }, orderBy: { awardedAt: "desc" } },
        },
      }),
      db.rank.findMany({ orderBy: { level: "desc" } }),
      db.division.findMany({ orderBy: { order: "asc" } }),
      db.subDivision.findMany({
        orderBy: { order: "asc" },
        include: { division: { select: { shortName: true } } },
      }),
      db.divisionRole.findMany({
        orderBy: { order: "asc" },
        include: { division: { select: { shortName: true } } },
      }),
      db.certification.findMany({ orderBy: { order: "asc" } }),
      db.medal.findMany({ orderBy: { order: "asc" } }),
    ]);

  if (!agent) notFound();

  // Même règle que côté serveur dans les actions : on n'administre que les
  // grades strictement inférieurs au sien. L'UI reflète la règle, elle ne la
  // remplace pas — les actions la revérifient systématiquement.
  // Le chef du département administre tout le monde, y compris lui-même.
  const head = isDepartmentHead(user);
  const manageable =
    user.isSuperAdmin ||
    (!agent.isSuperAdmin && (head || agent.rank.level < user.rank.level));

  const selectableRanks = ranks
    .filter((r) => head || r.level < user.rank.level)
    .map((r) => ({ id: r.id, name: r.name, level: r.level }));

  return (
    <div className="space-y-6">
      <Link
        href="/accounts"
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux comptes
      </Link>

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-4 bg-gradient-to-br from-badge-600/15 to-transparent px-6 py-5 sm:flex-row sm:items-center">
          <AgentAvatar agent={agent} className="h-16 w-16" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-mist-100">
                {agent.firstName} {agent.lastName}
              </h1>
              <Badge tone="blue">{agent.rank.name}</Badge>
              {agent.isSuperAdmin ? <Badge tone="gold">SUPERADMIN</Badge> : null}
            </div>
            <p className="mt-1 font-mono text-xs text-mist-500">{agent.email}</p>
            <p className="mt-0.5 text-xs text-mist-500">
              Matricule {agent.matricule} · badge #{agent.badgeNumber} ·
              recruté le {formatDate(agent.recruitedAt)}
            </p>
          </div>
          <Link
            href={`/roster/${agent.id}`}
            className="rounded-lg border border-ink-600 px-3 py-2 text-xs text-mist-300 transition-colors hover:bg-ink-800"
          >
            Voir le dossier public
          </Link>
        </div>
      </Panel>

      {!manageable ? (
        <p className="rounded-lg border border-warn-500/40 bg-warn-500/10 px-4 py-3 text-sm text-warn-500">
          Cet agent est de grade supérieur ou égal au vôtre : sa fiche est en
          lecture seule. Seul un supérieur peut la modifier.
        </p>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <IdentityForm
              agent={{
                id: agent.id,
                firstName: agent.firstName,
                lastName: agent.lastName,
                matricule: agent.matricule,
                badgeNumber: agent.badgeNumber,
                rankId: agent.rankId,
                recruitedAt: isoDate(agent.recruitedAt),
                phone: agent.phone,
              }}
              ranks={selectableRanks}
            />

            <DiscordForm
              agent={{
                id: agent.id,
                discordId: agent.discordId,
                discordUsername: agent.discordUsername,
                manualAvatarUrl: agent.manualAvatarUrl,
                avatarSource: agent.avatarSource,
              }}
            />
          </div>

          <AssignmentsForm
            agentId={agent.id}
            divisions={divisions
              .filter((d) => canHoldDivision(agent.rank.level, d.minRankLevel))
              .map((d) => ({ id: d.id, label: d.name }))}
            subDivisions={subDivisions.map((s) => ({
              id: s.id,
              label: s.name,
              hint: s.division.shortName,
            }))}
            roles={roles.map((r) => ({
              id: r.id,
              label: r.name,
              hint: r.division.shortName,
            }))}
            selected={{
              divisions: agent.divisions.map((d) => d.divisionId),
              subDivisions: agent.subDivisions.map((s) => s.subDivisionId),
              roles: agent.divisionRoles.map((r) => r.divisionRoleId),
              primary:
                agent.divisions.find((d) => d.isPrimary)?.divisionId ?? null,
            }}
            blockedMessage={
              agent.rank.level < SWORN_LEVEL
                ? `Un agent au grade de ${agent.rank.name} est à l'académie : il ne peut être affecté à aucune division.`
                : divisions.filter((d) =>
                      canHoldDivision(agent.rank.level, d.minRankLevel),
                    ).length === 0
                  ? `Aucune division n'est ouverte au grade de ${agent.rank.name}.`
                  : null
            }
          />

          <div className="grid gap-6 lg:grid-cols-2">
            {can.awardCertification(user) ? (
              <CertificationsForm
                agentId={agent.id}
                certifications={certifications.map((c) => ({
                  id: c.id,
                  label: c.name,
                  hint: c.category,
                }))}
                selected={agent.certifications.map((c) => c.certificationId)}
                unionRole={agent.unionMembership?.role ?? "NONE"}
              />
            ) : null}

            <Panel>
              <PanelHeader
                title="Décorations"
                subtitle={`${agent.medals.length} médaille(s)`}
              />
              {agent.medals.length > 0 ? (
                <ul className="divide-y divide-ink-700">
                  {agent.medals.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-start gap-3 px-5 py-3"
                    >
                      <Award
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: m.medal.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-mist-100">{m.medal.name}</p>
                        {can.awardMedal(user) ? (
                          <MedalCitationForm
                            userMedalId={m.id}
                            citation={m.citation ?? ""}
                          />
                        ) : m.citation ? (
                          <p className="text-xs text-mist-500">{m.citation}</p>
                        ) : null}
                      </div>
                      {can.awardMedal(user) ? (
                        <form action={revokeMedal}>
                          <input type="hidden" name="userMedalId" value={m.id} />
                          <input type="hidden" name="id" value={agent.id} />
                          <button
                            type="submit"
                            title="Retirer cette décoration"
                            className="rounded-md p-1 text-mist-500 transition-colors hover:text-alert-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {can.awardMedal(user) ? (
                <MedalForm
                  agentId={agent.id}
                  medals={medals.map((m) => ({ id: m.id, name: m.name }))}
                />
              ) : (
                <p className="px-5 py-4 text-xs text-mist-500">
                  Les décorations sont décernées à partir du grade de Commander.
                </p>
              )}
            </Panel>
          </div>

          <Panel>
            <PanelHeader
              title="Accès et statut"
              subtitle="Mot de passe et état du compte"
            />
            {can.resetPassword(user) ? (
              <PasswordForm agentId={agent.id} />
            ) : (
              <p className="px-5 py-4 text-xs text-mist-500">
                La réinitialisation de mot de passe est réservée au grade de
                Deputy Chief et au-dessus.
              </p>
            )}
            <StatusForm
              agentId={agent.id}
              status={agent.status}
              canSuspend={can.suspendAccount(user)}
              isSelf={agent.id === user.id}
            />
          </Panel>
        </>
      )}

      {/* Suppression définitive : Chief of Police, sur un agent ayant quitté. */}
      {head &&
      agent.id !== user.id &&
      !agent.isSuperAdmin &&
      LEFT_STATUSES.includes(agent.status) ? (
        <DeleteAccountForm agentId={agent.id} badgeNumber={agent.badgeNumber} />
      ) : null}
    </div>
  );
}
