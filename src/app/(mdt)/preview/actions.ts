"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { audit, getCurrentUser } from "@/lib/auth";
import { isDepartmentHead } from "@/lib/permissions";
import { PREVIEW_COOKIE, type PreviewSpec } from "@/lib/preview";

/**
 * Active le mode aperçu.
 *
 * `getCurrentUser` renvoie déjà le profil simulé quand un aperçu est actif ;
 * on vérifie donc le grade réel avant toute chose, sinon un aperçu de Rookie
 * empêcherait d'en changer ou d'en sortir.
 */
export async function startPreview(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const alreadyPreviewing = user.preview?.active === true;
  if (!alreadyPreviewing && !isDepartmentHead(user)) {
    throw new Error("Le mode aperçu est réservé au chef du département.");
  }

  const rankCode = String(formData.get("rankCode") ?? "");
  if (!rankCode) throw new Error("Sélectionnez un grade.");

  const spec: PreviewSpec = {
    rankCode,
    divisionCodes: formData.getAll("divisions").map(String),
    divisionRoleCodes: formData.getAll("divisionRoles").map(String),
    subDivisionCodes: formData.getAll("subDivisions").map(String),
    certificationCodes: formData.getAll("certifications").map(String),
    unionRole:
      formData.get("unionRole") === "REPRESENTATIVE"
        ? "REPRESENTATIVE"
        : formData.get("unionRole") === "MEMBER"
          ? "MEMBER"
          : null,
  };

  const store = await cookies();
  store.set(PREVIEW_COOKIE, JSON.stringify(spec), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // L'aperçu expire de lui-même : on ne veut pas qu'un chef reste bloqué
    // en vue Rookie parce qu'il a fermé l'onglet.
    maxAge: 60 * 60,
  });

  await audit({
    userId: user.id,
    action: "PREVIEW_START",
    detail: `Aperçu du grade ${rankCode}`,
  });

  redirect("/dashboard");
}

export async function stopPreview() {
  const user = await getCurrentUser();
  const store = await cookies();
  store.delete(PREVIEW_COOKIE);

  if (user) {
    await audit({ userId: user.id, action: "PREVIEW_STOP" });
  }

  redirect("/preview");
}
