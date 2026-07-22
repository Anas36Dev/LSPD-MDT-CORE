import { notFound } from "next/navigation";
import { Award, GraduationCap } from "lucide-react";

import { AgentAvatar } from "@/components/agent-avatar";
import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { ServiceStripes } from "@/components/service-stripes";
import { ACCOUNT_STATUS_MAP } from "@/lib/account-status";
import {
  can,
  isCommandStaff,
  RANK,
  SWORN_LEVEL,
  yearsOfService,
} from "@/lib/permissions";
import { dutyTotalSeconds } from "@/lib/duty";
import { medalImage } from "@/lib/medal-image";
import { rankInsignia } from "@/lib/rank-insignia";
import { formatDate } from "@/lib/utils";
import { officializeOfficer } from "../actions";
import { DirectSanctionForm } from "./sanction-form";

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
  return {
    title: agent ? `${agent.firstName} ${agent.lastName}` : "Dossier agent",
  };
}


const SANCTION_LABELS: Record<string, string> = {
  WARNING: "Avertissement",
  REPRIMAND: "Blâme",
  SUSPENSION: "Suspension",
  DEMOTION: "Rétrogradation",
  TERMINATION: "Révocation",
};

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireUser();
  const { id } = await params;

  const agentId = Number(id);
  if (!Number.isInteger(agentId)) notFound();

  const agent = await db.user.findUnique({
    where: { id: agentId },
    include: {
      rank: true,
      divisions: { include: { division: true } },
      divisionRoles: { include: { divisionRole: true } },
      subDivisions: { include: { subDivision: true } },
      certifications: {
        where: { revokedAt: null },
        include: { certification: true },
      },
      medals: {
        include: { medal: true },
        orderBy: { awardedAt: "desc" },
      },
      unionMembership: true,
      sanctions: { orderBy: { startsAt: "desc" } },
      _count: { select: { authoredReports: true } },
    },
  });

  if (!agent) notFound();

  const status = ACCOUNT_STATUS_MAP[agent.status] ?? ACCOUNT_STATUS_MAP.ACTIVE;
  const insignia = rankInsignia(agent.rank.code);

  // Activité de service : rapports, arrestations, temps de service cumulé.
  const [approvedReports, arrestReports, serviceSeconds] = await Promise.all([
    db.report.count({ where: { authorId: agent.id, status: "APPROVED" } }),
    db.report.count({
      where: { authorId: agent.id, template: { name: "Arrest Report" } },
    }),
    dutyTotalSeconds(agent.id),
  ]);
  const serviceH = Math.floor(serviceSeconds / 3600);
  const serviceM = Math.floor((serviceSeconds % 3600) / 60);
  const serviceLabel = serviceH > 0 ? `${serviceH}h ${serviceM}m` : `${serviceM}m`;

  // Les sanctions non publiques ne sont visibles que par l'IAD, le Command
  // Staff et l'agent lui-même. Le filtrage se fait ici, côté serveur : ne
  // jamais envoyer au navigateur une donnée qu'on masque ensuite en CSS.
  const canSeeAllSanctions =
    can.viewIaCases(viewer) || viewer.id === agent.id;
  const sanctions = canSeeAllSanctions
    ? agent.sanctions
    : agent.sanctions.filter((s) => s.isPublic);

  const ppa = agent.certifications.filter(
    (c) => c.certification.category === "PPA",
  );
  const otherCerts = agent.certifications.filter(
    (c) => c.certification.category !== "PPA",
  );

  return (
    <div className="space-y-6">
      {/* --- En-tête du dossier ------------------------------------------- */}
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-5 bg-gradient-to-br from-badge-600/15 to-transparent px-6 py-6 sm:flex-row sm:items-center">
          <AgentAvatar
            agent={agent}
            className="h-24 w-24 border-2 border-gold-500/50"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-semibold text-mist-100">
                {agent.firstName} {agent.lastName}
              </h1>
              <Badge tone={status.tone}>{status.label}</Badge>
              {agent.unionMembership ? (
                <Badge tone="gold">
                  {agent.unionMembership.role === "REPRESENTATIVE"
                    ? "Représentant Syndical"
                    : "Adhérent syndicat"}
                </Badge>
              ) : null}
            </div>

            <div className="mt-1 flex items-center gap-2">
              {insignia ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={insignia}
                  alt={`Insigne ${agent.rank.name}`}
                  className="h-6 w-auto object-contain"
                />
              ) : null}
              <p className="text-sm text-gold-400">{agent.rank.name}</p>
            </div>

            {/* Sortie de période probatoire : réservée aux superviseurs et
                instructeurs, et proposée uniquement pour un Police Officer I. */}
            {agent.rank.code === "POLICE_OFFICER_I" &&
            can.officialize(viewer) &&
            viewer.id !== agent.id ? (
              <form action={officializeOfficer} className="mt-3">
                <input type="hidden" name="userId" value={agent.id} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg border border-ok-500/50 bg-ok-500/15 px-3.5 py-2 text-xs font-medium text-ok-500 transition-colors hover:bg-ok-500/25"
                >
                  <GraduationCap className="h-4 w-4" />
                  Officialiser en Executive Staff (Police Officer II)
                </button>
              </form>
            ) : null}

            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-4">
              <Item label="Numéro de badge" value={`#${agent.badgeNumber}`} />
              <div>
                <dt className="label-tag">Années de service</dt>
                <dd className="mt-1">
                  <ServiceStripes years={yearsOfService(agent.recruitedAt)} />
                </dd>
              </div>
              <Item
                label="Date de recrutement"
                value={formatDate(agent.recruitedAt)}
              />
              <Item
                label="Discord"
                value={agent.discordUsername ?? "Non renseigné"}
              />
            </dl>
          </div>
        </div>
      </Panel>

      {/* --- Activité de service ------------------------------------------ */}
      <Panel>
        <PanelHeader
          title="Activité de service"
          subtitle="Bilan d'activité de l'agent"
        />
        <div className="grid grid-cols-2 gap-px overflow-hidden bg-ink-700 sm:grid-cols-4">
          {[
            { label: "Rapports rédigés", value: agent._count.authoredReports },
            { label: "Rapports validés", value: approvedReports },
            { label: "Arrestations", value: arrestReports },
            { label: "Temps de service", value: serviceLabel },
          ].map((stat) => (
            <div key={stat.label} className="bg-ink-900 px-5 py-4">
              <p className="text-2xl font-semibold text-mist-100">
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs text-mist-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* --- Affectations ---------------------------------------------- */}
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Affectations"
            subtitle="Divisions, unités et fonctions internes"
          />
          <div className="space-y-5 px-5 py-4">
            <Group label="Divisions">
              {agent.divisions.length === 0 ? (
                <Muted>
                  {agent.rank.level < SWORN_LEVEL
                    ? "Aucune affectation — en formation à l'académie."
                    : agent.rank.level >= RANK.CHIEF_OF_POLICE
                      ? "Le Chief of Police supervise l'ensemble du département : aucune affectation à une division précise."
                      : "Aucune division. Les divisions sont accessibles à partir du grade de Police Officer II."}
                </Muted>
              ) : (
                agent.divisions.map((d) => (
                  <Badge
                    key={d.division.id}
                    tone={d.isPrimary ? "blue" : "neutral"}
                  >
                    {d.division.name}
                    {d.isPrimary ? " · principale" : ""}
                  </Badge>
                ))
              )}
            </Group>

            {agent.subDivisions.length > 0 ? (
              <Group label="Unités et sections">
                {agent.subDivisions.map((s) => (
                  <Badge key={s.subDivision.id}>{s.subDivision.name}</Badge>
                ))}
              </Group>
            ) : null}

            {agent.divisionRoles.length > 0 ? (
              <Group label="Fonctions">
                {agent.divisionRoles.map((r) => (
                  <Badge
                    key={r.divisionRole.id}
                    tone={r.divisionRole.isDivisionChief ? "gold" : "neutral"}
                  >
                    {r.divisionRole.name}
                  </Badge>
                ))}
              </Group>
            ) : null}

            <Group label="Certifications PPA">
              {ppa.length === 0 ? (
                <Muted>Aucune certification PPA.</Muted>
              ) : (
                ppa.map((c) => (
                  <Badge key={c.certification.id} tone="blue">
                    {c.certification.name}
                  </Badge>
                ))
              )}
            </Group>

            {otherCerts.length > 0 ? (
              <Group label="Autres certifications">
                {otherCerts.map((c) => (
                  <Badge key={c.certification.id} tone="green">
                    {c.certification.name}
                  </Badge>
                ))}
              </Group>
            ) : null}
          </div>
        </Panel>

        {/* --- Médailles -------------------------------------------------- */}
        <Panel>
          <PanelHeader
            title="Décorations"
            subtitle={`${agent.medals.length} médaille(s)`}
          />
          {agent.medals.length === 0 ? (
            <EmptyState
              title="Aucune décoration"
              description="Les médailles décernées apparaîtront ici."
            />
          ) : (
            <ul className="divide-y divide-ink-700">
              {agent.medals.map((m) => {
                const img = medalImage(m.medal.code);
                return (
                <li key={m.id} className="flex gap-3 px-5 py-3.5">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt={m.medal.name}
                      className="mt-0.5 h-9 w-9 shrink-0 object-contain"
                    />
                  ) : (
                    <Award
                      className="mt-0.5 h-5 w-5 shrink-0"
                      style={{ color: m.medal.color }}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-mist-100">
                      {m.medal.name}
                    </p>
                    {m.citation ? (
                      <p className="mt-0.5 text-xs leading-relaxed text-mist-300">
                        {m.citation}
                      </p>
                    ) : null}
                    {m.awardedAt ? (
                      <p className="mt-1 text-[0.68rem] text-mist-500">
                        {formatDate(m.awardedAt)}
                      </p>
                    ) : null}
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* --- Sanctions ---------------------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Dossier disciplinaire"
          subtitle={
            canSeeAllSanctions
              ? "Vue complète — sanctions publiques et confidentielles"
              : "Seules les sanctions publiques sont affichées"
          }
        />
        {sanctions.length === 0 ? (
          <EmptyState
            title="Aucune sanction"
            description="Le dossier disciplinaire de cet agent est vierge."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {sanctions.map((s) => (
              <li key={s.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="red">
                    {SANCTION_LABELS[s.type] ?? s.type}
                  </Badge>
                  {!s.isPublic ? (
                    <Badge tone="amber">Confidentiel</Badge>
                  ) : null}
                  <span className="text-xs text-mist-500">
                    {formatDate(s.startsAt)}
                    {s.endsAt ? ` → ${formatDate(s.endsAt)}` : ""}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-mist-300">
                  {s.reason}
                </p>
              </li>
            ))}
          </ul>
        )}

        {/* Sanction directe : le Command Staff peut sanctionner sans dossier IAD. */}
        {isCommandStaff(viewer) &&
        viewer.id !== agent.id &&
        !agent.isSuperAdmin ? (
          <DirectSanctionForm
            subjectId={agent.id}
            subjectName={`${agent.firstName} ${agent.lastName}`}
          />
        ) : null}
      </Panel>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-tag">{label}</dt>
      <dd className="mt-0.5 text-mist-100">{value}</dd>
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="label-tag mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

const Muted = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-mist-500">{children}</p>
);
