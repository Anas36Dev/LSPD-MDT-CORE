import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Link2,
  Pencil,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";

import { ConfirmButton } from "@/components/confirm-button";
import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { isSupervisor } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { officerSignature } from "@/lib/utils";
import {
  deleteCivilian,
  deleteCriminalRecord,
  unlinkCivilianReport,
} from "../actions";
import {
  CriminalRecordForm,
  ReportLinkForm,
  ValidateCivilianForm,
} from "../forms";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await db.civilian.findUnique({
    where: { id: Number(id) },
    select: { firstName: true, lastName: true, reference: true },
  });
  return {
    title: c ? `${c.reference} — ${c.firstName} ${c.lastName}` : "Casier",
  };
}

export default async function CasierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModule("civilians");
  const { id } = await params;

  const civilianId = Number(id);
  if (!Number.isInteger(civilianId)) notFound();

  const [civilian, penalCodes, reportOptions] = await Promise.all([
    db.civilian.findUnique({
      where: { id: civilianId },
      include: {
        author: { select: { firstName: true, lastName: true } },
        validatedBy: { select: { firstName: true, lastName: true } },
        criminalRecords: {
          orderBy: { occurredAt: "desc" },
          include: {
            charges: { include: { penalCode: true } },
            author: { select: { firstName: true, lastName: true } },
            linkedReports: {
              include: { report: { select: { id: true, reference: true, title: true } } },
            },
            references: {
              include: { to: { select: { id: true, reference: true } } },
            },
          },
        },
        warrants: {
          where: { status: "ACTIVE" },
          include: { issuedBy: { select: { firstName: true, lastName: true } } },
        },
        firearmCerts: { where: { status: "VALID" } },
        linkedReports: {
          orderBy: { linkedAt: "desc" },
          include: {
            report: { select: { id: true, reference: true, title: true } },
          },
        },
      },
    }),
    db.penalCode.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        title: true,
        fine: true,
        jailTime: true,
        isLifeSentence: true,
      },
    }),
    db.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, reference: true, title: true },
    }),
  ]);

  if (!civilian) notFound();

  const canManage = isSupervisor(user);
  const recordOptions = civilian.criminalRecords.map((r) => ({
    id: r.id,
    reference: r.reference,
    description: r.description,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/casiers-judiciaires"
          className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux casiers
        </Link>

        {canManage ? (
          <ConfirmButton
            action={deleteCivilian}
            fields={{ id: civilian.id }}
            title="Supprimer le casier"
            message={`Supprimer définitivement le casier ${civilian.reference} (${civilian.firstName} ${civilian.lastName}) et toutes ses infractions ?`}
            confirmLabel="Supprimer"
            danger
            triggerTitle="Supprimer le casier"
            triggerClassName="inline-flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-2 text-xs text-mist-400 transition-colors hover:border-alert-500/50 hover:text-alert-500"
            trigger={
              <>
                <X className="h-3.5 w-3.5" />
                Supprimer
              </>
            }
          />
        ) : null}
      </div>

      {/* --- Alertes en tête ---------------------------------------------- */}
      {civilian.isFlagged ? (
        <div className="flex items-start gap-3 rounded-xl border border-alert-500/50 bg-alert-600/15 px-5 py-4">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-alert-500" />
          <div>
            <p className="text-sm font-semibold text-alert-500">
              Individu signalé comme dangereux
            </p>
            <p className="mt-1 text-sm text-mist-300">{civilian.flagReason}</p>
          </div>
        </div>
      ) : null}

      {civilian.warrants.length > 0 ? (
        <div className="rounded-xl border border-alert-500/50 bg-alert-600/10 px-5 py-4">
          <p className="text-sm font-semibold text-alert-500">
            {civilian.warrants.length} mandat(s) actif(s)
          </p>
          <ul className="mt-2 space-y-1.5">
            {civilian.warrants.map((w) => (
              <li key={w.id} className="text-sm text-mist-300">
                <span className="font-mono text-xs text-badge-300">
                  {w.reference}
                </span>{" "}
                · {w.type === "ARREST" ? "Mandat d'arrêt" : "Perquisition"} ·{" "}
                {w.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* --- Identité ----------------------------------------------------- */}
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
          <div className="flex gap-5">
            {civilian.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={civilian.photoUrl}
                alt={`${civilian.firstName} ${civilian.lastName}`}
                className="h-28 w-28 shrink-0 rounded-lg border border-ink-600 object-cover"
              />
            ) : (
              <div className="flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink-600 bg-ink-850 text-center">
                <span className="text-lg font-semibold text-mist-500">
                  {(civilian.firstName[0] ?? "") + (civilian.lastName[0] ?? "")}
                </span>
                <span className="px-1 text-[0.6rem] leading-tight text-mist-600">
                  Aucune photo
                </span>
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-mist-100">
                  {civilian.firstName} {civilian.lastName}
                </h1>
                <span className="font-mono text-xs text-badge-300">
                  {civilian.reference}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
                <Item
                  label="Date de naissance"
                  value={
                    civilian.dateOfBirth
                      ? formatDate(civilian.dateOfBirth)
                      : "Inconnue"
                  }
                />
                <Item label="Lieu de naissance" value={civilian.placeOfBirth ?? "—"} />
                <Item label="Nationalité" value={civilian.nationality ?? "—"} />
                <Item label="Genre" value={civilian.gender ?? "—"} />
                <Item label="Téléphone" value={civilian.phone ?? "—"} />
                <Item label="Adresse" value={civilian.address ?? "—"} />
                <Item
                  label="Signalement physique"
                  value={
                    [civilian.height, civilian.weight]
                      .filter(Boolean)
                      .join(" · ") || "—"
                  }
                />
                <Item
                  label="Yeux / cheveux"
                  value={
                    [civilian.eyeColor, civilian.hairColor]
                      .filter(Boolean)
                      .join(" / ") || "—"
                  }
                />
                <Item
                  label="Tatouages"
                  value={
                    civilian.hasTattoos
                      ? civilian.tattoosDescription || "Oui"
                      : "Non"
                  }
                />
                <Item label="Groupuscule" value={civilian.groupuscule ?? "—"} />
              </dl>
            </div>
          </div>

          <Link
            href={`/casiers-judiciaires/${civilian.id}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-xs text-mist-300 transition-colors hover:bg-ink-800"
          >
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </Link>
        </div>

        {civilian.notes ? (
          <div className="border-t border-ink-700 px-6 py-4">
            <p className="label-tag">Observations</p>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-mist-300">
              {civilian.notes}
            </p>
          </div>
        ) : null}

        {/* --- Signature / validation ------------------------------------ */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ink-700 px-6 py-4">
          <div className="space-y-0.5 text-xs text-mist-500">
            <p>
              Rédigé par {civilian.author.firstName} {civilian.author.lastName}
              {civilian.authorSignature ? (
                <span className="ml-2 font-serif text-mist-300 italic">
                  {civilian.authorSignature}
                </span>
              ) : null}
            </p>
            {civilian.validatedAt && civilian.validatedBy ? (
              <p className="text-ok-500">
                <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                Validé par {civilian.validatedBy.firstName}{" "}
                {civilian.validatedBy.lastName} le{" "}
                {formatDate(civilian.validatedAt)}
                <span className="ml-2 font-serif italic">
                  {civilian.validationSignature}
                </span>
              </p>
            ) : (
              <p className="text-warn-500">Casier en attente de validation</p>
            )}
          </div>
          {!civilian.validatedAt ? (
            <Badge tone="amber">En attente</Badge>
          ) : (
            <Badge tone="green">Validé</Badge>
          )}
        </div>

        {canManage && !civilian.validatedAt ? (
          <div className="border-t border-ink-700">
            <ValidateCivilianForm
              id={civilian.id}
              signature={officerSignature(user)}
            />
          </div>
        ) : null}
      </Panel>

      {/* --- Rapports rattachés au casier (niveau fiche) ------------------ */}
      <Panel>
        <PanelHeader
          title="Rapports liés au casier"
          subtitle={`${civilian.linkedReports.length} rapport(s) rattaché(s)`}
        />
        {civilian.linkedReports.length > 0 ? (
          <ul className="divide-y divide-ink-700">
            {civilian.linkedReports.map((l) => (
              <li
                key={l.report.id}
                className="flex items-center gap-3 px-5 py-3"
              >
                <Link2 className="h-4 w-4 shrink-0 text-mist-500" />
                <Link
                  href={`/reports/${l.report.id}`}
                  className="w-52 shrink-0 font-mono text-xs text-badge-300 hover:underline"
                >
                  {l.report.reference}
                </Link>
                <span className="min-w-0 flex-1 truncate text-sm text-mist-100">
                  {l.report.title}
                </span>
                <form action={unlinkCivilianReport}>
                  <input type="hidden" name="civilianId" value={civilian.id} />
                  <input type="hidden" name="reportId" value={l.report.id} />
                  <button
                    type="submit"
                    title="Détacher le rapport"
                    className="rounded-md p-1 text-mist-500 transition-colors hover:text-alert-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <ReportLinkForm civilianId={civilian.id} reportOptions={reportOptions} />
      </Panel>

      {/* --- Casier judiciaire (infractions) ------------------------------ */}
      <Panel>
        <PanelHeader
          title="Casier judiciaire"
          subtitle={`${civilian.criminalRecords.length} infraction(s)`}
        />
        {civilian.criminalRecords.length === 0 ? (
          <EmptyState
            title="Casier vierge"
            description="Aucune infraction enregistrée pour cet individu."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {civilian.criminalRecords.map((r) => (
              <li key={r.id} className="flex gap-4 px-5 py-4">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {r.reference ? (
                      <span className="font-mono text-xs text-badge-300">
                        {r.reference}
                      </span>
                    ) : null}
                    {r.charges.length > 0 ? (
                      r.charges.map((ch) => (
                        <span
                          key={ch.id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-850 px-2 py-0.5"
                        >
                          <span className="font-mono text-xs text-badge-300">
                            {ch.penalCode.code}
                          </span>
                          <span className="text-xs text-mist-100">
                            {ch.penalCode.title}
                          </span>
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-mist-100">
                        Fait hors nomenclature
                      </span>
                    )}
                    <span className="text-xs text-mist-500">
                      {formatDate(r.occurredAt)}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-mist-300">
                    {r.description}
                  </p>

                  {r.sentence || r.fine ? (
                    <p className="text-xs text-mist-500">
                      {r.sentence ? `Peine : ${r.sentence}` : ""}
                      {r.fine
                        ? `${r.sentence ? " · " : ""}Amende : ${r.fine.toLocaleString("fr-FR")} $`
                        : ""}
                    </p>
                  ) : null}

                  {r.observations ? (
                    <p className="text-xs text-mist-400">
                      <span className="text-mist-500">Observations : </span>
                      {r.observations}
                    </p>
                  ) : null}

                  {r.linkedReports.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <FileText className="h-3.5 w-3.5 text-mist-500" />
                      {r.linkedReports.map((lr) => (
                        <Link
                          key={lr.report.id}
                          href={`/reports/${lr.report.id}`}
                          className="font-mono text-[0.68rem] text-badge-300 hover:underline"
                          title={lr.report.title}
                        >
                          {lr.report.reference}
                        </Link>
                      ))}
                    </div>
                  ) : null}

                  {r.references.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5 text-mist-500" />
                      <span className="text-[0.68rem] text-mist-500">
                        Renvois :
                      </span>
                      {r.references.map((ref) => (
                        <span
                          key={ref.to.id}
                          className="font-mono text-[0.68rem] text-mist-400"
                        >
                          {ref.to.reference ?? `#${ref.to.id}`}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <p className="text-[0.66rem] text-mist-600">
                    Inscrit par {r.author.firstName} {r.author.lastName}
                  </p>
                </div>

                {canManage ? (
                  <form action={deleteCriminalRecord}>
                    <input type="hidden" name="recordId" value={r.id} />
                    <input type="hidden" name="civilianId" value={civilian.id} />
                    <button
                      type="submit"
                      title="Retirer du casier"
                      className="h-fit rounded-md p-1 text-mist-500 transition-colors hover:text-alert-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <CriminalRecordForm
          civilianId={civilian.id}
          penalCodes={penalCodes}
          reportOptions={reportOptions}
          recordOptions={recordOptions}
        />
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
