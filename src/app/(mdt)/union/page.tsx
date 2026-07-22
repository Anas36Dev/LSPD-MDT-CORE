import type { Metadata } from "next";
import Link from "next/link";
import { Handshake, Megaphone } from "lucide-react";

import { AgentAvatar } from "@/components/agent-avatar";
import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { divisionShortLabel } from "@/lib/division-label";
import { requireModule } from "@/lib/guard";
import { isUnionRepresentative } from "@/lib/permissions";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Syndicat" };

export default async function UnionPage() {
  const user = await requireModule("union");
  const isRep = isUnionRepresentative(user);

  const [memberships, announcements, openCases] = await Promise.all([
    db.unionMembership.findMany({
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            badgeNumber: true,
            status: true,
            manualAvatarUrl: true,
            discordAvatarUrl: true,
            avatarSource: true,
            rank: { select: { name: true } },
            divisions: {
              select: { division: { select: { code: true } } },
            },
            divisionRoles: {
              select: { divisionRole: { select: { code: true } } },
            },
            subDivisions: {
              select: { subDivision: { select: { code: true } } },
            },
          },
        },
      },
    }),
    db.announcement.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
            unionMembership: { select: { role: true } },
          },
        },
      },
    }),
    // Le représentant assiste les adhérents lors des procédures disciplinaires :
    // il a besoin de savoir lesquels sont concernés, sans accéder au contenu
    // des dossiers, qui reste réservé à l'IAD.
    isRep
      ? db.iaCase.findMany({
          where: {
            status: { in: ["OPEN", "INVESTIGATING"] },
            subject: { unionMembership: { isNot: null } },
          },
          select: {
            id: true,
            reference: true,
            createdAt: true,
            subject: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                badgeNumber: true,
              },
            },
          },
        })
      : [],
  ]);

  const representatives = memberships.filter(
    (m) => m.role === "REPRESENTATIVE",
  );
  const members = memberships.filter((m) => m.role === "MEMBER");

  // Communications émanant d'un représentant syndical.
  const unionPosts = announcements.filter(
    (a) => a.author.unionMembership?.role === "REPRESENTATIVE",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">
            Syndicat du LSPD
          </h1>
          <p className="mt-1 text-sm text-mist-500">
            {memberships.length} adhérent(s) · {representatives.length}{" "}
            représentant(s)
          </p>
        </div>

        <Badge tone={isRep ? "gold" : "blue"}>
          <Handshake className="h-3 w-3" />
          {isRep ? "Représentant Syndical" : "Adhérent"}
        </Badge>
      </div>

      {isRep ? (
        <Panel className="border-gold-500/30">
          <PanelHeader
            title="Prérogatives du représentant"
            subtitle="Ce que votre mandat vous permet"
          />
          <ul className="space-y-2 px-5 py-4">
            {[
              "Publier des communications syndicales depuis le module Annonces.",
              "Assister un adhérent lors d'une procédure disciplinaire.",
              "Être informé des procédures visant un adhérent, sans accès au contenu des dossiers.",
            ].map((t) => (
              <li key={t} className="flex gap-2.5 text-sm text-mist-300">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-500" />
                {t}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {isRep && openCases.length > 0 ? (
        <Panel className="border-warn-500/40">
          <PanelHeader
            title="Adhérents en procédure disciplinaire"
            subtitle="Vous pouvez proposer votre assistance"
            action={<Badge tone="amber">{openCases.length}</Badge>}
          />
          <ul className="divide-y divide-ink-700">
            {openCases.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3"
              >
                <span className="font-mono text-xs text-mist-500">
                  {c.reference}
                </span>
                <Link
                  href={`/roster/${c.subject.id}`}
                  className="text-sm font-medium text-mist-100 hover:text-badge-300"
                >
                  {c.subject.firstName} {c.subject.lastName} #
                  {c.subject.badgeNumber}
                </Link>
                <span className="text-xs text-mist-500">
                  ouvert le {formatDate(c.createdAt)}
                </span>
                <Link
                  href={`/messages?to=${c.subject.id}`}
                  className="ml-auto rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-300 transition-colors hover:bg-ink-800"
                >
                  Contacter
                </Link>
              </li>
            ))}
          </ul>
          <p className="border-t border-ink-700 px-5 py-3 text-xs leading-relaxed text-mist-500">
            Seules les références et les agents concernés vous sont communiqués.
            Le contenu des dossiers reste réservé à l&apos;Internal Affairs
            Division.
          </p>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title="Communications syndicales"
          subtitle="Annonces publiées par un représentant"
          action={
            isRep ? (
              <Link
                href="/announcements"
                className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-mist-300 transition-colors hover:bg-ink-800"
              >
                <Megaphone className="h-3.5 w-3.5" />
                Publier
              </Link>
            ) : null
          }
        />
        {unionPosts.length === 0 ? (
          <EmptyState
            title="Aucune communication"
            description="Les annonces publiées par un représentant syndical apparaîtront ici."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {unionPosts.map((a) => (
              <li key={a.id} className="px-5 py-3.5">
                <p className="text-sm font-medium text-mist-100">{a.title}</p>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-mist-300">
                  {a.body}
                </p>
                <p className="mt-2 text-xs text-mist-500">
                  {a.author.firstName} {a.author.lastName} ·{" "}
                  {formatDateTime(a.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Adhérents"
          subtitle="L'adhésion se règle depuis la gestion des comptes"
        />
        <ul className="divide-y divide-ink-700">
          {[...representatives, ...members].map((m) => (
            <li key={m.userId}>
              <Link
                href={`/roster/${m.user.id}`}
                className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-ink-800/60"
              >
                <AgentAvatar agent={m.user} className="h-9 w-9" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-mist-100">
                    {m.user.firstName} {m.user.lastName}
                  </p>
                  <p className="text-xs text-mist-500">
                    {m.user.rank.name} · #{m.user.badgeNumber} · adhérent depuis
                    le {formatDate(m.joinedAt)}
                  </p>
                </div>

                <div className="hidden gap-1.5 sm:flex">
                  {m.user.divisions.map((d) => (
                    <Badge key={d.division.code}>
                      {divisionShortLabel(
                        d.division.code,
                        m.user.divisionRoles.map((r) => r.divisionRole.code),
                        m.user.subDivisions.map((s) => s.subDivision.code),
                      )}
                    </Badge>
                  ))}
                </div>

                {m.role === "REPRESENTATIVE" ? (
                  <Badge tone="gold">Représentant</Badge>
                ) : (
                  <Badge tone="blue">Adhérent</Badge>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
