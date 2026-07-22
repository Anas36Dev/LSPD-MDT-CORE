"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSession, verifyPassword, audit } from "@/lib/auth";
import { db } from "@/lib/db";

export type LoginState = { error?: string } | undefined;

const schema = z.object({
  identifier: z.string().trim().min(1, "Identifiant requis"),
  password: z.string().min(1, "Mot de passe requis"),
});

export async function login(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    identifier: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { identifier, password } = parsed.data;

  // On accepte deux formes d'identifiant : l'adresse réglementaire
  // (prenom.nom@lspd.core) ou le numéro de badge. La présence d'un « @ »
  // départage sans ambiguïté puisqu'un badge est purement numérique.
  const isEmail = identifier.includes("@");
  const user = isEmail
    ? await db.user.findUnique({ where: { email: identifier.toLowerCase() } })
    : await db.user.findUnique({ where: { badgeNumber: identifier } });

  // Message volontairement identique dans les deux cas : indiquer qu'un
  // identifiant existe permettrait d'énumérer les comptes du département.
  const GENERIC = "Identifiant ou mot de passe incorrect.";

  if (!user) return { error: GENERIC };

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    await audit({
      userId: user.id,
      action: "LOGIN_FAILED",
      detail: `Tentative de connexion échouée pour ${identifier}`,
    });
    return { error: GENERIC };
  }

  if (user.status === "SUSPENDED") {
    return { error: "Compte suspendu. Contactez les Affaires Internes." };
  }
  if (user.status === "DISCHARGED") {
    return { error: "Compte désactivé. Vous ne faites plus partie du LSPD." };
  }

  const h = await headers();
  await createSession(user.id, {
    ip: h.get("x-forwarded-for") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  });
  await audit({ userId: user.id, action: "LOGIN", detail: "Connexion par identifiants" });

  // `redirect` lève une exception de contrôle de flux : il doit rester hors
  // de tout try/catch, sinon la redirection serait avalée.
  redirect("/dashboard");
}
