import "server-only";

import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { hash, verify } from "@node-rs/argon2";

import { BLOCKING_STATUSES } from "@/lib/account-status";
import { db } from "@/lib/db";
import { isDepartmentHead, type SessionUser } from "@/lib/permissions";
import { applyPreview, readPreview } from "@/lib/preview";

export const SESSION_COOKIE = "lspd_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12; // 12 h

// ---------------------------------------------------------------------------
// Mots de passe
// ---------------------------------------------------------------------------

export const hashPassword = (plain: string) => hash(plain);

export const verifyPassword = (storedHash: string, plain: string) =>
  verify(storedHash, plain);

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

/** Génère l'identifiant de connexion réglementaire : prenom.nom@lspd.core */
export const buildEmail = (firstName: string, lastName: string) =>
  `${slug(firstName)}.${slug(lastName)}@lspd.core`;

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * Les sessions sont stockées en base plutôt que dans un JWT auto-porteur :
 * quand un Assistant Chief suspend un agent, sa session doit être révoquée
 * immédiatement, ce qu'un JWT ne permet pas.
 */
export async function createSession(
  userId: number,
  meta?: { ip?: string; userAgent?: string },
) {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.session.create({
    data: { id, userId, expiresAt, ip: meta?.ip, userAgent: meta?.userAgent },
  });
  await db.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return id;
}

export async function destroySession() {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (id) {
    await db.session.deleteMany({ where: { id } });
    store.delete(SESSION_COOKIE);
  }
}

/** Révoque toutes les sessions d'un agent (suspension, changement de mot de passe). */
export async function revokeUserSessions(userId: number) {
  await db.session.deleteMany({ where: { userId } });
}

const sessionUserInclude = {
  rank: true,
  divisions: { include: { division: true } },
  divisionRoles: {
    include: {
      divisionRole: { include: { division: true, subDivision: true } },
    },
  },
  subDivisions: { include: { subDivision: true } },
  certifications: { include: { certification: true } },
  unionMembership: true,
} as const;

/**
 * Agent connecté, ou null.
 *
 * Mémoïsé par `cache()` sur la durée d'un rendu : sans cela, chaque composant
 * serveur qui appelle cette fonction déclencherait sa propre requête MySQL.
 *
 * Retourne null si la session a expiré ou si le compte n'est plus actif —
 * un agent suspendu perd donc l'accès sur-le-champ, sans attendre l'expiration.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: { include: sessionUserInclude } },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  const u = session.user;
  // Un compte suspendu, licencié ou décédé ne peut plus accéder au terminal.
  if (BLOCKING_STATUSES.includes(u.status as (typeof BLOCKING_STATUSES)[number]))
    return null;

  const real: SessionUser = {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    badgeNumber: u.badgeNumber,
    status: u.status,
    isSuperAdmin: u.isSuperAdmin,
    rank: {
      code: u.rank.code,
      name: u.rank.name,
      level: u.rank.level,
      category: u.rank.category,
    },
    divisions: u.divisions.map((d) => ({
      id: d.division.id,
      code: d.division.code,
      name: d.division.name,
      isPrimary: d.isPrimary,
    })),
    divisionRoles: u.divisionRoles.map((r) => ({
      code: r.divisionRole.code,
      name: r.divisionRole.name,
      divisionCode: r.divisionRole.division.code,
      subDivisionCode: r.divisionRole.subDivision?.code ?? null,
      isDivisionChief: r.divisionRole.isDivisionChief,
      isUnitLead: r.divisionRole.isUnitLead,
      canTrain: r.divisionRole.canTrain,
    })),
    subDivisionCodes: u.subDivisions.map((s) => s.subDivision.code),
    certificationCodes: u.certifications
      .filter((c) => c.revokedAt === null)
      .map((c) => c.certification.code),
    unionRole: u.unionMembership?.role ?? null,
    preview: null,
  };

  // Mode aperçu : réservé au chef du département, et jamais persisté en base.
  if (!isDepartmentHead(real)) return real;

  const spec = await readPreview();
  if (!spec) return real;

  const [ranks, divisions, divisionRoles] = await Promise.all([
    db.rank.findMany({
      select: { code: true, name: true, level: true, category: true },
    }),
    db.division.findMany({ select: { id: true, code: true, name: true } }),
    db.divisionRole.findMany({
      include: { division: true, subDivision: true },
    }),
  ]);

  return applyPreview(real, spec, {
    ranks,
    divisions,
    divisionRoles: divisionRoles.map((r) => ({
      code: r.code,
      name: r.name,
      divisionCode: r.division.code,
      subDivisionCode: r.subDivision?.code ?? null,
      isDivisionChief: r.isDivisionChief,
      isUnitLead: r.isUnitLead,
      canTrain: r.canTrain,
    })),
  });
});

// ---------------------------------------------------------------------------
// Journal d'audit
// ---------------------------------------------------------------------------

export async function audit(entry: {
  userId?: number | null;
  action: string;
  targetType?: string;
  targetId?: string | number;
  detail?: string;
  ip?: string;
}) {
  await db.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId != null ? String(entry.targetId) : null,
      detail: entry.detail,
      ip: entry.ip,
    },
  });
}
