import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { CreateAccountForm } from "../forms";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function NewAccountPage() {
  const user = await requirePermission(can.createAccount);

  // On ne propose que les grades strictement inférieurs à celui de l'auteur :
  // impossible de créer un compte de rang supérieur ou égal au sien.
  const [ranks, promotions] = await Promise.all([
    db.rank.findMany({
      where: user.isSuperAdmin ? {} : { level: { lt: user.rank.level } },
      orderBy: { level: "desc" },
      select: { id: true, name: true, level: true },
    }),
    db.academyPromotion.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/accounts"
        className="inline-flex items-center gap-2 text-sm text-mist-500 transition-colors hover:text-mist-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux comptes
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-mist-100">
          Créer un compte agent
        </h1>
        <p className="mt-1 text-sm text-mist-500">
          L&apos;identifiant et le numéro de badge sont générés automatiquement.
          Les affectations se règlent ensuite sur la fiche de l&apos;agent.
        </p>
      </div>

      <Panel>
        <PanelHeader
          title="Nouvel agent"
          subtitle="Le mot de passe est défini ici et ne pourra pas être modifié par l'agent"
        />
        <div className="px-5 py-5">
          <CreateAccountForm
            ranks={ranks}
            promotions={promotions.map((p) => p.name)}
          />
        </div>
      </Panel>
    </div>
  );
}
