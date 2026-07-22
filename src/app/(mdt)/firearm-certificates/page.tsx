import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { formatDate } from "@/lib/utils";
import { IssueForm, RevokeForm } from "./forms";

export const metadata: Metadata = { title: "Certificats d'armes" };

/** Titulaire : nom saisi librement, avec repli sur un ancien lien civil. */
function holderName(c: {
  subjectName: string;
  civilian: { firstName: string; lastName: string } | null;
}) {
  if (c.subjectName) return c.subjectName;
  if (c.civilian) return `${c.civilian.firstName} ${c.civilian.lastName}`;
  return "—";
}

export default async function FirearmCertificatesPage() {
  await requireModule("firearm-certificates");

  const certificates = await db.firearmCertificate.findMany({
    orderBy: [{ status: "asc" }, { issuedAt: "desc" }],
    include: {
      civilian: { select: { firstName: true, lastName: true } },
      issuedBy: {
        select: { firstName: true, lastName: true, badgeNumber: true },
      },
    },
  });

  const valid = certificates.filter((c) => c.status === "VALID");
  const revoked = certificates.filter((c) => c.status !== "VALID");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          Firearm Security Certificate
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          Délivrance et révocation — réservées aux titulaires de
          l&apos;habilitation IFSC
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-ok-500/30 bg-ok-500/5 px-5 py-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ok-500" />
        <p className="text-xs leading-relaxed text-mist-300">
          L&apos;identité du titulaire est saisie librement. Un certificat en
          vigueur atteste du droit au port d&apos;arme jusqu&apos;à sa révocation
          ou son expiration.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Tile label="Certificats en vigueur" value={valid.length} />
        <Tile label="Révoqués ou expirés" value={revoked.length} />
      </div>

      <Panel>
        <PanelHeader
          title="Délivrer un certificat"
          subtitle="Saisissez le prénom et le nom du titulaire"
        />
        <IssueForm />
      </Panel>

      <Panel>
        <PanelHeader
          title="Certificats en vigueur"
          subtitle={`${valid.length} certificat(s)`}
        />
        {valid.length === 0 ? (
          <EmptyState
            title="Aucun certificat en vigueur"
            description="Les certificats délivrés apparaîtront ici."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {valid.map((c) => (
              <li key={c.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs text-badge-300">
                    {c.reference}
                  </span>
                  <span className="text-sm font-medium text-mist-100">
                    {holderName(c)}
                  </span>
                  <Badge tone="green">Valide</Badge>
                  <span className="text-xs text-mist-500">
                    Délivré le {formatDate(c.issuedAt)} par {c.issuedBy.firstName}{" "}
                    {c.issuedBy.lastName} #{c.issuedBy.badgeNumber}
                    {c.expiresAt ? ` · expire le ${formatDate(c.expiresAt)}` : ""}
                  </span>
                </div>
                <RevokeForm certificateId={c.id} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {revoked.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Historique"
            subtitle={`${revoked.length} certificat(s) révoqué(s) ou expiré(s)`}
          />
          <ul className="divide-y divide-ink-700">
            {revoked.map((c) => (
              <li key={c.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs text-mist-500">
                    {c.reference}
                  </span>
                  <span className="text-sm text-mist-300">{holderName(c)}</span>
                  <Badge tone={c.status === "REVOKED" ? "red" : "neutral"}>
                    {c.status === "REVOKED" ? "Révoqué" : "Expiré"}
                  </Badge>
                  {c.revokedAt ? (
                    <span className="text-xs text-mist-500">
                      {formatDate(c.revokedAt)}
                    </span>
                  ) : null}
                </div>
                {c.revokeReason ? (
                  <p className="mt-1 text-xs text-mist-500">
                    {c.revokeReason}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <Panel className="px-5 py-4">
      <p className="label-tag">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-mist-100">{value}</p>
    </Panel>
  );
}
