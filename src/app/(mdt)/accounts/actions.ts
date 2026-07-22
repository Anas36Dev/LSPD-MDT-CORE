"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  audit,
  buildEmail,
  getCurrentUser,
  hashPassword,
  revokeUserSessions,
} from "@/lib/auth";
import {
  ACCOUNT_STATUSES,
  type AccountStatus,
  BLOCKING_STATUSES,
  LEFT_STATUSES,
} from "@/lib/account-status";
import { generateBadgeNumber, normalizeMatricule } from "@/lib/badge";
import { nextCasierReference } from "@/lib/references";
import { db } from "@/lib/db";
import { fetchDiscordUserAsBot, discordAvatarUrl, discordDisplayName } from "@/lib/discord";
import { assertPermission } from "@/lib/guard";
import {
  can,
  canHoldDivision,
  isDepartmentHead,
  type SessionUser,
} from "@/lib/permissions";

export type ActionState = { error?: string; success?: string } | undefined;

const fail = (error: string): ActionState => ({ error });

/**
 * Empêche l'escalade de privilèges.
 *
 * Règle générale : on n'administre qu'un agent de grade STRICTEMENT inférieur
 * au sien. Sans elle, un Deputy Chief pourrait se promouvoir Chief of Police,
 * ou réinitialiser le mot de passe de son supérieur pour prendre son compte.
 *
 * Exception : le chef du département. N'ayant aucun supérieur, il administre
 * tous les comptes, y compris le sien — sinon sa propre fiche serait
 * définitivement figée.
 */
async function assertCanManage(actor: SessionUser, targetId: number) {
  const target = await db.user.findUnique({
    where: { id: targetId },
    include: { rank: true },
  });
  if (!target) throw new Error("Agent introuvable.");

  if (actor.isSuperAdmin) return target;

  if (target.isSuperAdmin) {
    throw new Error("Le compte technique ne peut pas être administré ici.");
  }

  if (isDepartmentHead(actor)) return target;

  if (target.rank.level >= actor.rank.level) {
    throw new Error(
      "Vous ne pouvez pas administrer un agent de grade supérieur ou égal au vôtre.",
    );
  }
  return target;
}

async function assertRankAllowed(actor: SessionUser, rankId: number) {
  const rank = await db.rank.findUnique({ where: { id: rankId } });
  if (!rank) throw new Error("Grade inconnu.");

  // Le chef du département peut attribuer n'importe quel grade, y compris le
  // sien — c'est ainsi qu'il désigne son successeur.
  if (isDepartmentHead(actor)) return rank;

  if (rank.level >= actor.rank.level) {
    throw new Error(
      `Vous ne pouvez pas attribuer le grade « ${rank.name} » : il est supérieur ou égal au vôtre.`,
    );
  }
  return rank;
}

// ---------------------------------------------------------------------------
// Création d'un compte
// ---------------------------------------------------------------------------

const createSchema = z.object({
  firstName: z.string().trim().min(2, "Prénom trop court"),
  lastName: z.string().trim().min(2, "Nom trop court"),
  matricule: z.string().trim().min(1, "Matricule requis"),
  rankId: z.coerce.number().int().positive("Grade requis"),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères"),
  recruitedAt: z.string().optional(),
  promotion: z.string().optional(),
  recruitmentSession: z.string().optional(),
  discordId: z
    .string()
    .trim()
    .regex(/^\d{17,20}$/, "Identifiant Discord invalide (17 à 20 chiffres)")
    .optional()
    .or(z.literal("")),
});

export async function createAccount(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let newId: number;

  try {
    const actor = await assertPermission(can.createAccount);

    const parsed = createSchema.safeParse({
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      matricule: formData.get("matricule"),
      rankId: formData.get("rankId"),
      password: formData.get("password"),
      recruitedAt: formData.get("recruitedAt"),
      promotion: formData.get("promotion"),
      recruitmentSession: formData.get("recruitmentSession"),
      discordId: formData.get("discordId"),
    });
    if (!parsed.success) return fail(parsed.error.issues[0].message);

    const d = parsed.data;
    const rank = await assertRankAllowed(actor, d.rankId);

    const matricule = normalizeMatricule(d.matricule);
    if (!matricule) return fail("Le matricule doit comporter 1 ou 2 chiffres.");

    const email = buildEmail(d.firstName, d.lastName);

    if (await db.user.findUnique({ where: { email } })) {
      return fail(`L'identifiant ${email} est déjà utilisé.`);
    }
    if (d.discordId && (await db.user.findUnique({ where: { discordId: d.discordId } }))) {
      return fail("Cet identifiant Discord est déjà rattaché à un autre agent.");
    }

    const created = await db.user.create({
      data: {
        firstName: d.firstName,
        lastName: d.lastName,
        email,
        matricule,
        badgeNumber: await generateBadgeNumber(matricule),
        rankId: d.rankId,
        passwordHash: await hashPassword(d.password),
        recruitedAt: d.recruitedAt ? new Date(d.recruitedAt) : new Date(),
        promotion: d.promotion?.trim() || null,
        recruitmentSession: d.recruitmentSession?.trim() || null,
        discordId: d.discordId || null,
        createdById: actor.id,
      },
    });
    newId = created.id;

    // Tout agent du LSPD est aussi un citoyen : on lui crée son casier judiciaire.
    // Le Department of Justice, extérieur au LSPD, en est exclu.
    if (rank.code !== "DOJ") {
      await db.civilian.create({
        data: {
          reference: await nextCasierReference(),
          firstName: d.firstName,
          lastName: d.lastName,
          agentId: created.id,
          authorId: actor.id,
          notes: "Casier généré automatiquement à l'ouverture du compte.",
        },
      });
    }

    // Récupération de l'avatar Discord si le bot est configuré.
    if (d.discordId) {
      const discord = await fetchDiscordUserAsBot(d.discordId);
      if (discord) {
        await db.user.update({
          where: { id: created.id },
          data: {
            discordUsername: discordDisplayName(discord),
            discordAvatarUrl: discordAvatarUrl(discord),
          },
        });
      }
    }

    await audit({
      userId: actor.id,
      action: "USER_CREATE",
      targetType: "User",
      targetId: created.id,
      detail: `Création du compte ${email} (${d.firstName} ${d.lastName})`,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }

  redirect(`/accounts/${newId}`);
}

// ---------------------------------------------------------------------------
// Identité, grade et statut
// ---------------------------------------------------------------------------

export async function updateIdentity(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await assertPermission(can.editRoster);
    const id = Number(formData.get("id"));
    await assertCanManage(actor, id);

    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const rawMatricule = String(formData.get("matricule") ?? "").trim();
    const rankId = Number(formData.get("rankId"));
    const recruitedAt = String(formData.get("recruitedAt") ?? "");
    const phone = String(formData.get("phone") ?? "").trim();

    if (firstName.length < 2 || lastName.length < 2) {
      return fail("Prénom et nom sont obligatoires.");
    }

    // Le grade n'est modifiable que par ceux qui en ont le droit.
    const current = await db.user.findUniqueOrThrow({ where: { id } });
    if (rankId && rankId !== current.rankId) {
      await assertRankAllowed(actor, rankId);
    }

    const matricule = normalizeMatricule(rawMatricule);
    if (!matricule) return fail("Le matricule doit comporter 1 ou 2 chiffres.");

    const email = buildEmail(firstName, lastName);
    const clash = await db.user.findFirst({
      where: { email, id: { not: id } },
    });
    if (clash) return fail(`L'identifiant ${email} est déjà utilisé.`);

    // Le badge encode le matricule : s'il change, le badge est retiré au
    // profit d'un nouveau tirage conservant le nouveau préfixe.
    const badgeNumber =
      matricule === current.matricule
        ? current.badgeNumber
        : await generateBadgeNumber(matricule);

    await db.user.update({
      where: { id },
      data: {
        firstName,
        lastName,
        email, // l'identifiant suit toujours prenom.nom@lspd.core
        matricule,
        badgeNumber,
        rankId: rankId || current.rankId,
        recruitedAt: recruitedAt ? new Date(recruitedAt) : current.recruitedAt,
        phone: phone || null,
      },
    });

    await audit({
      userId: actor.id,
      action: "USER_UPDATE",
      targetType: "User",
      targetId: id,
      detail: `Identité et grade mis à jour pour ${email}`,
    });

    revalidatePath(`/accounts/${id}`);
    revalidatePath("/roster");
    return { success: "Identité et grade enregistrés." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

// ---------------------------------------------------------------------------
// Affectations : divisions, sous-unités, rôles internes
// ---------------------------------------------------------------------------

export async function updateAssignments(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await assertPermission(can.editRoster);
    const id = Number(formData.get("id"));
    const target = await assertCanManage(actor, id);

    const divisionIds = formData.getAll("divisions").map(Number).filter(Boolean);

    // Contrôle du grade face aux divisions choisies : chaque division impose
    // son propre grade plancher (minRankLevel), réglé par le Command Staff.
    if (divisionIds.length > 0) {
      const chosen = await db.division.findMany({
        where: { id: { in: divisionIds } },
        select: { name: true, minRankLevel: true },
      });
      const forbidden = chosen.filter(
        (d) => !canHoldDivision(target.rank.level, d.minRankLevel),
      );
      if (forbidden.length > 0) {
        return fail(
          `Le grade ${target.rank.name} n'atteint pas le grade minimum requis pour : ${forbidden.map((d) => d.name).join(", ")}.`,
        );
      }
    }
    const subDivisionIds = formData.getAll("subDivisions").map(Number).filter(Boolean);
    const roleIds = formData.getAll("roles").map(Number).filter(Boolean);
    const primary = Number(formData.get("primaryDivision")) || divisionIds[0];

    // Remplacement intégral : plus simple et plus sûr qu'un différentiel, et
    // le volume concerné est de l'ordre de quelques lignes par agent.
    await db.$transaction([
      db.userDivision.deleteMany({ where: { userId: id } }),
      db.userSubDivision.deleteMany({ where: { userId: id } }),
      db.userDivisionRole.deleteMany({ where: { userId: id } }),
      db.userDivision.createMany({
        data: divisionIds.map((divisionId) => ({
          userId: id,
          divisionId,
          isPrimary: divisionId === primary,
        })),
      }),
      db.userSubDivision.createMany({
        data: subDivisionIds.map((subDivisionId) => ({ userId: id, subDivisionId })),
      }),
      db.userDivisionRole.createMany({
        data: roleIds.map((divisionRoleId) => ({ userId: id, divisionRoleId })),
      }),
    ]);

    await audit({
      userId: actor.id,
      action: "USER_ASSIGNMENTS",
      targetType: "User",
      targetId: id,
      detail: `${divisionIds.length} division(s), ${subDivisionIds.length} unité(s), ${roleIds.length} fonction(s)`,
    });

    revalidatePath(`/accounts/${id}`);
    revalidatePath("/roster");
    return { success: "Affectations enregistrées." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

// ---------------------------------------------------------------------------
// Certifications et syndicat
// ---------------------------------------------------------------------------

export async function updateCertifications(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await assertPermission(can.awardCertification);
    const id = Number(formData.get("id"));
    await assertCanManage(actor, id);

    const certIds = formData.getAll("certifications").map(Number).filter(Boolean);
    const union = String(formData.get("union") ?? "NONE");

    const existing = await db.userCertification.findMany({ where: { userId: id } });
    const toAdd = certIds.filter(
      (c) => !existing.some((e) => e.certificationId === c),
    );

    await db.$transaction([
      db.userCertification.deleteMany({
        where: { userId: id, certificationId: { notIn: certIds.length ? certIds : [0] } },
      }),
      db.userCertification.createMany({
        data: toAdd.map((certificationId) => ({
          userId: id,
          certificationId,
          awardedById: actor.id,
        })),
      }),
    ]);

    if (union === "NONE") {
      await db.unionMembership.deleteMany({ where: { userId: id } });
    } else {
      await db.unionMembership.upsert({
        where: { userId: id },
        update: { role: union as "REPRESENTATIVE" | "MEMBER" },
        create: { userId: id, role: union as "REPRESENTATIVE" | "MEMBER" },
      });
    }

    await audit({
      userId: actor.id,
      action: "USER_CERTIFICATIONS",
      targetType: "User",
      targetId: id,
      detail: `${certIds.length} certification(s), syndicat: ${union}`,
    });

    revalidatePath(`/accounts/${id}`);
    return { success: "Certifications enregistrées." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

// ---------------------------------------------------------------------------
// Médailles
// ---------------------------------------------------------------------------

export async function awardMedal(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await assertPermission(can.awardMedal);
    const id = Number(formData.get("id"));
    const medalId = Number(formData.get("medalId"));
    const citation = String(formData.get("citation") ?? "").trim();

    if (!medalId) return fail("Sélectionnez une décoration.");
    if (citation.length < 5) {
      return fail("La citation justificative est obligatoire.");
    }

    await db.userMedal.create({
      data: { userId: id, medalId, citation, awardedById: actor.id },
    });

    await audit({
      userId: actor.id,
      action: "MEDAL_AWARD",
      targetType: "User",
      targetId: id,
      detail: citation,
    });

    revalidatePath(`/accounts/${id}`);
    revalidatePath(`/roster/${id}`);
    return { success: "Décoration attribuée." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function updateMedalCitation(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await assertPermission(can.awardMedal);
    const userMedalId = Number(formData.get("userMedalId"));
    const citation = String(formData.get("citation") ?? "").trim();

    // Une citation vide efface le motif : la décoration reste, sans texte.
    const medal = await db.userMedal.update({
      where: { id: userMedalId },
      data: { citation: citation || null },
      select: { userId: true },
    });

    await audit({
      userId: actor.id,
      action: "MEDAL_CITATION_EDIT",
      targetType: "User",
      targetId: medal.userId,
      detail: citation.slice(0, 120),
    });

    revalidatePath(`/accounts/${medal.userId}`);
    revalidatePath(`/roster/${medal.userId}`);
    return { success: "Citation modifiée." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

export async function revokeMedal(formData: FormData) {
  const actor = await assertPermission(can.awardMedal);
  const userMedalId = Number(formData.get("userMedalId"));
  const userId = Number(formData.get("id"));

  await db.userMedal.delete({ where: { id: userMedalId } });
  await audit({
    userId: actor.id,
    action: "MEDAL_REVOKE",
    targetType: "User",
    targetId: userId,
  });

  revalidatePath(`/accounts/${userId}`);
  revalidatePath(`/roster/${userId}`);
}

// ---------------------------------------------------------------------------
// Discord et photo de profil
// ---------------------------------------------------------------------------

export async function updateDiscord(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await assertPermission(can.setAvatar);
    const id = Number(formData.get("id"));
    await assertCanManage(actor, id);

    const discordId = String(formData.get("discordId") ?? "").trim();
    const manualAvatarUrl = String(formData.get("manualAvatarUrl") ?? "").trim();
    const avatarSource = String(formData.get("avatarSource") ?? "DISCORD");

    if (discordId && !/^\d{17,20}$/.test(discordId)) {
      return fail("Identifiant Discord invalide (17 à 20 chiffres).");
    }
    if (discordId) {
      const clash = await db.user.findFirst({
        where: { discordId, id: { not: id } },
      });
      if (clash) {
        return fail(`Cet identifiant Discord est déjà rattaché à ${clash.email}.`);
      }
    }

    let discordUsername: string | undefined;
    let fetchedAvatar: string | undefined;
    if (discordId) {
      const discord = await fetchDiscordUserAsBot(discordId);
      if (discord) {
        discordUsername = discordDisplayName(discord);
        fetchedAvatar = discordAvatarUrl(discord);
      }
    }

    await db.user.update({
      where: { id },
      data: {
        discordId: discordId || null,
        discordUsername: discordUsername ?? undefined,
        discordAvatarUrl: fetchedAvatar ?? undefined,
        manualAvatarUrl: manualAvatarUrl || null,
        avatarSource: avatarSource === "MANUAL" ? "MANUAL" : "DISCORD",
        avatarSetById: avatarSource === "MANUAL" ? actor.id : null,
      },
    });

    await audit({
      userId: actor.id,
      action: "USER_DISCORD",
      targetType: "User",
      targetId: id,
      detail: `Discord: ${discordId || "délié"}, avatar: ${avatarSource}`,
    });

    revalidatePath(`/accounts/${id}`);
    revalidatePath(`/roster/${id}`);
    return { success: "Discord et photo de profil enregistrés." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

// ---------------------------------------------------------------------------
// Mot de passe
// ---------------------------------------------------------------------------

export async function resetPassword(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await assertPermission(can.resetPassword);
    const id = Number(formData.get("id"));
    await assertCanManage(actor, id);

    const password = String(formData.get("password") ?? "");
    if (password.length < 8) {
      return fail("Le mot de passe doit faire au moins 8 caractères.");
    }

    await db.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(password) },
    });

    // Toute session ouverte devient caduque : sans cela, un compte compromis
    // resterait accessible malgré le changement de mot de passe.
    await revokeUserSessions(id);

    await audit({
      userId: actor.id,
      action: "USER_PASSWORD_RESET",
      targetType: "User",
      targetId: id,
      detail: "Mot de passe réinitialisé, sessions révoquées",
    });

    return { success: "Mot de passe redéfini. Les sessions ouvertes ont été fermées." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

// ---------------------------------------------------------------------------
// Statut du compte
// ---------------------------------------------------------------------------

export async function updateStatus(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await assertPermission(can.suspendAccount);
    const id = Number(formData.get("id"));
    const status = String(formData.get("status"));

    await assertCanManage(actor, id);

    if (!ACCOUNT_STATUSES.some((s) => s.value === status)) {
      return fail("Statut invalide.");
    }

    // Se placer soi-même dans un statut bloquant révoque sa propre session
    // sur-le-champ et rend le compte inaccessible — y compris pour le rétablir.
    if (
      id === actor.id &&
      BLOCKING_STATUSES.includes(status as (typeof BLOCKING_STATUSES)[number])
    ) {
      return fail(
        "Vous ne pouvez pas vous appliquer ce statut : vous perdriez immédiatement l'accès au terminal, sans pouvoir le rétablir.",
      );
    }

    await db.user.update({
      where: { id },
      data: { status: status as AccountStatus },
    });

    // Un agent suspendu, licencié, démissionné ou décédé perd l'accès aussitôt.
    if (BLOCKING_STATUSES.includes(status as (typeof BLOCKING_STATUSES)[number])) {
      await revokeUserSessions(id);
    }

    await audit({
      userId: actor.id,
      action: "USER_STATUS",
      targetType: "User",
      targetId: id,
      detail: `Statut passé à ${status}`,
    });

    revalidatePath(`/accounts/${id}`);
    revalidatePath("/roster");
    return { success: `Statut mis à jour : ${status}.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erreur inattendue.");
  }
}

/** Identifiant proposé en direct dans le formulaire de création. */
export async function previewEmail(firstName: string, lastName: string) {
  await getCurrentUser();
  return buildEmail(firstName, lastName);
}

/**
 * Suppression DÉFINITIVE d'un compte agent — réservée au Chief of Police.
 *
 * Uniquement possible sur un agent ayant quitté l'effectif (licencié,
 * démissionné ou décédé) et avec confirmation par le numéro de badge, car
 * l'opération retire aussi toutes ses données liées (rapports, mandats, notes…).
 */
export async function deleteAccount(formData: FormData) {
  const actor = await assertPermission(
    isDepartmentHead,
    "Seul le Chief of Police peut supprimer un compte.",
  );
  const id = Number(formData.get("id"));
  const confirm = String(formData.get("confirm") ?? "").trim();

  if (id === actor.id) {
    throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
  }

  const target = await db.user.findUnique({
    where: { id },
    select: {
      isSuperAdmin: true,
      badgeNumber: true,
      status: true,
      firstName: true,
      lastName: true,
    },
  });
  if (!target) throw new Error("Compte introuvable.");
  if (target.isSuperAdmin) {
    throw new Error("Le compte technique ne peut pas être supprimé.");
  }
  if (!LEFT_STATUSES.includes(target.status as AccountStatus)) {
    throw new Error(
      "Seul un compte licencié, démissionné ou décédé peut être supprimé définitivement.",
    );
  }
  if (confirm !== target.badgeNumber) {
    throw new Error(
      "Confirmation invalide : saisissez le numéro de badge de l'agent.",
    );
  }

  // On retire d'abord toutes les données liées qui bloqueraient la suppression
  // (contraintes de clés étrangères) ; le reste est nettoyé en cascade par la
  // base. L'ensemble est atomique : en cas d'échec, rien n'est supprimé.
  await db.$transaction([
    db.reportValidation.deleteMany({ where: { reviewerId: id } }),
    db.report.deleteMany({ where: { authorId: id } }),
    db.warrant.deleteMany({ where: { issuedById: id } }),
    db.bolo.deleteMany({ where: { issuedById: id } }),
    db.firearmCertificate.deleteMany({ where: { issuedById: id } }),
    db.announcement.deleteMany({ where: { authorId: id } }),
    db.iaCaseNote.deleteMany({ where: { authorId: id } }),
    db.iaCase.deleteMany({
      where: { OR: [{ investigatorId: id }, { subjectId: id }] },
    }),
    db.investigationNote.deleteMany({ where: { authorId: id } }),
    db.investigationInfo.deleteMany({ where: { authorId: id } }),
    db.investigation.deleteMany({ where: { leadId: id } }),
    db.divisionDocument.deleteMany({ where: { authorId: id } }),
    db.agentNote.deleteMany({ where: { authorId: id } }),
    db.academyDocument.deleteMany({ where: { authorId: id } }),
    db.traineeEvaluation.deleteMany({
      where: { OR: [{ instructorId: id }, { traineeId: id }] },
    }),
    db.partnershipNote.deleteMany({ where: { authorId: id } }),
    db.factionNote.deleteMany({ where: { authorId: id } }),
    db.user.delete({ where: { id } }),
  ]);

  await audit({
    userId: actor.id,
    action: "USER_DELETE",
    targetType: "User",
    targetId: id,
    detail: `${target.firstName} ${target.lastName} (#${target.badgeNumber})`,
  });

  revalidatePath("/accounts");
  redirect("/accounts");
}
