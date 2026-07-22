import type { Metadata } from "next";
import { Car, User } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireModule } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { formatDate, officerSignature } from "@/lib/utils";
import { closeBolo, updateWarrantStatus } from "./actions";
import { BoloForm, WarrantForm } from "./forms";

export const metadata: Metadata = { title: "Mandats & avis de recherche" };

const PRIORITY: Record<
  string,
  { label: string; tone: "neutral" | "blue" | "amber" | "red" }
> = {
  LOW: { label: "Basse", tone: "neutral" },
  MEDIUM: { label: "Moyenne", tone: "blue" },
  HIGH: { label: "Haute", tone: "amber" },
  CRITICAL: { label: "Critique", tone: "red" },
};

export default async function WarrantsPage() {
  const user = await requireModule("warrants");
  // Le Department of Justice consulte les mandats et BOLO, sans en émettre ni
  // les clore : ces actions restent aux agents assermentés.
  const canIssue = can.issueWarrant(user);

  const [warrants, bolos, vehicles] = await Promise.all([
    db.warrant.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: {
        issuedBy: { select: { firstName: true, lastName: true } },
      },
    }),
    db.bolo.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: {
        vehicle: { select: { plate: true } },
        issuedBy: { select: { firstName: true, lastName: true } },
      },
    }),
    db.vehicle.findMany({
      orderBy: { plate: "asc" },
      select: { id: true, plate: true, make: true, model: true },
    }),
  ]);

  const vehicleOptions = vehicles.map((v) => ({
    id: v.id,
    label: `${v.plate}${v.make ? ` — ${v.make} ${v.model ?? ""}`.trimEnd() : ""}`,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          Mandats & avis de recherche
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          Mandats d&apos;arrêt, perquisitions et avis de recherche en cours
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel className="px-5 py-4">
          <p className="label-tag">Mandats actifs</p>
          <p className="mt-1 text-2xl font-semibold text-mist-100">
            {warrants.length}
          </p>
        </Panel>
        <Panel className="px-5 py-4">
          <p className="label-tag">Avis de recherche actifs</p>
          <p className="mt-1 text-2xl font-semibold text-mist-100">
            {bolos.length}
          </p>
        </Panel>
      </div>

      {/* --- Mandats -------------------------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Mandats actifs"
          subtitle="Ils apparaissent en alerte sur la fiche de l'individu"
        />
        {warrants.length === 0 ? (
          <EmptyState
            title="Aucun mandat actif"
            description="Les mandats émis apparaîtront ici jusqu'à leur exécution."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {warrants.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="w-32 shrink-0 font-mono text-xs text-badge-300">
                  {w.reference}
                </span>
                <Badge tone={w.type === "ARREST" ? "red" : "amber"}>
                  {w.type === "ARREST" ? "Arrêt" : "Perquisition"}
                </Badge>
                <span className="text-sm font-medium text-mist-100">
                  {w.subjectName}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-mist-300">
                  {w.reason}
                </span>
                <span className="text-xs text-mist-500">
                  {w.issuedBy.firstName} {w.issuedBy.lastName} ·{" "}
                  {formatDate(w.createdAt)}
                </span>

                {canIssue ? (
                  <form action={updateWarrantStatus} className="flex gap-1.5">
                    <input type="hidden" name="warrantId" value={w.id} />
                    <button
                      type="submit"
                      name="status"
                      value="EXECUTED"
                      className="rounded-md border border-ok-500/40 px-2.5 py-1 text-xs text-ok-500 transition-colors hover:bg-ok-500/10"
                    >
                      Exécuté
                    </button>
                    <button
                      type="submit"
                      name="status"
                      value="CANCELLED"
                      className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-500 transition-colors hover:text-alert-500"
                    >
                      Annuler
                    </button>
                  </form>
                ) : null}
                {w.signature ? (
                  <p className="w-full font-serif text-xs italic text-mist-400">
                    Signé : {w.signature}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canIssue ? (
          <div className="border-t border-ink-700">
            <p className="label-tag px-5 pt-4">Émettre un mandat</p>
            <WarrantForm signature={officerSignature(user)} />
          </div>
        ) : null}
      </Panel>

      {/* --- BOLO ----------------------------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Avis de recherche (BOLO)"
          subtitle="Be On the Look Out — diffusés à tous les agents"
        />
        {bolos.length === 0 ? (
          <EmptyState
            title="Aucun avis actif"
            description="Les avis de recherche diffusés apparaîtront ici."
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {bolos.map((b) => {
              const p = PRIORITY[b.priority] ?? PRIORITY.MEDIUM;
              return (
                <li key={b.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs text-badge-300">
                      {b.reference}
                    </span>
                    <Badge tone={p.tone}>{p.label}</Badge>
                    {b.type === "VEHICLE" ? (
                      <Badge tone="neutral">
                        <Car className="h-3 w-3" />
                        {b.vehicle?.plate ?? "Véhicule"}
                      </Badge>
                    ) : b.type === "PERSON" ? (
                      <Badge tone="neutral">
                        <User className="h-3 w-3" />
                        {b.subjectName || "Personne"}
                      </Badge>
                    ) : null}
                    <p className="text-sm font-medium text-mist-100">
                      {b.title}
                    </p>

                    {canIssue ? (
                      <form action={closeBolo} className="ml-auto">
                        <input type="hidden" name="boloId" value={b.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-ink-600 px-2.5 py-1 text-xs text-mist-500 transition-colors hover:text-mist-100"
                        >
                          Clore
                        </button>
                      </form>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-mist-300">
                    {b.description}
                  </p>
                  <p className="mt-1 text-xs text-mist-500">
                    {b.issuedBy.firstName} {b.issuedBy.lastName} ·{" "}
                    {formatDate(b.createdAt)}
                  </p>
                  {b.signature ? (
                    <p className="mt-1 font-serif text-xs italic text-mist-400">
                      Signé : {b.signature}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {canIssue ? (
          <div className="border-t border-ink-700">
            <p className="label-tag px-5 pt-4">Diffuser un avis</p>
            <BoloForm
              vehicles={vehicleOptions}
              signature={officerSignature(user)}
            />
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
