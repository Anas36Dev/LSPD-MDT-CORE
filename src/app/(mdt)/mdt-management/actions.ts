"use server";

import { rm } from "node:fs/promises";
import path from "node:path";

import { revalidatePath } from "@/lib/revalidate";

import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/guard";
import { isDepartmentHead } from "@/lib/permissions";
import { WIPE_PHRASE } from "./constants";

export type WipeState = { error?: string; success?: string } | undefined;

export async function wipeOperationalData(
  _state: WipeState,
  formData: FormData,
): Promise<WipeState> {
  try {
    const actor = await assertPermission(
      isDepartmentHead,
      "Réservé au Chief of Police.",
    );

    const confirm = String(formData.get("confirm") ?? "").trim();
    if (confirm !== WIPE_PHRASE) {
      return { error: `Saisissez « ${WIPE_PHRASE} » pour confirmer.` };
    }

    // Suppression des données opérationnelles. Les cascades DB emportent les
    // tables liées (validations, notes, pièces, jointures…). L'ordre limite les
    // conflits de clés étrangères.
    const [
      reports,
      investigations,
      evidence,
      factions,
      certs,
      warrants,
      bolos,
      civilians,
    ] = await db.$transaction([
      db.report.deleteMany({}),
      db.investigation.deleteMany({}),
      db.evidenceFolder.deleteMany({}),
      db.faction.deleteMany({}),
      db.firearmCertificate.deleteMany({}),
      db.warrant.deleteMany({}),
      db.bolo.deleteMany({}),
      // On conserve les civils liés à un agent (auto-générés) ; seuls les civils
      // saisis à la main (agentId nul) sont supprimés.
      db.civilian.deleteMany({ where: { agentId: null } }),
    ]);

    // Fichiers de preuves téléversés (le dossier se recrée au besoin).
    await rm(path.join(process.cwd(), "public", "uploads", "evidence"), {
      recursive: true,
      force: true,
    });

    const detail =
      `${reports.count} rapport(s)/plainte(s), ${investigations.count} enquête(s), ` +
      `${evidence.count} dossier(s) de preuves, ${factions.count} groupuscule(s), ` +
      `${certs.count} certificat(s), ${warrants.count} mandat(s), ${bolos.count} avis, ` +
      `${civilians.count} civil(s)`;

    await audit({
      userId: actor.id,
      action: "MDT_WIPE",
      detail,
    });

    // Toutes les pages concernées se rechargent avec des données vides.
    for (const p of [
      "/reports",
      "/complaints",
      "/casiers-judiciaires",
      "/investigations",
      "/factions",
      "/warrants",
      "/firearm-certificates",
      "/evidence",
      "/dashboard",
    ]) {
      revalidatePath(p);
    }

    return { success: `Réinitialisation effectuée — ${detail}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}
