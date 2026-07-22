import "server-only";

import { db } from "@/lib/db";
import { hasCertification, inDivision, type SessionUser } from "./permissions";

/**
 * Canaux de discussion. Les cinq canaux prédéfinis restent en code (accès par
 * catégorie de grade, immuables). Le Command Staff peut créer des canaux
 * personnalisés (accès par grades et/ou membres précis), stockés en base.
 */
export type Channel = {
  /** Identifiant en base pour les canaux personnalisés (absent pour les prédéfinis). */
  id?: number;
  key: string;
  name: string;
  builtin: boolean;
  /** Catégories de grade autorisées (canaux prédéfinis). */
  categories: string[];
  /** Codes de grade autorisés (canaux personnalisés). */
  rankCodes: string[];
  /** Agents autorisés individuellement (canaux personnalisés). */
  userIds: number[];
  /** Codes de division dont les membres ont accès. */
  divisionCodes: string[];
  /** Codes d'habilitation donnant accès. */
  certCodes: string[];
};

const BUILTIN_DEFS: {
  key: string;
  name: string;
  categories: string[];
  divisionCodes?: string[];
}[] = [
  {
    key: "station-9",
    name: "Station 9",
    categories: [
      "PROBATIONARY",
      "EXECUTIVE_STAFF",
      "DETECTIVE_STAFF",
      "SUPERVISOR_STAFF",
      "COMMAND_STAFF",
      "CHIEF_OFFICE",
    ],
  },
  {
    key: "superviseur",
    name: "Superviseurs",
    categories: ["SUPERVISOR_STAFF", "CHIEF_OFFICE"],
  },
  {
    key: "detective-staff",
    name: "Detectives",
    categories: ["DETECTIVE_STAFF", "CHIEF_OFFICE"],
    // Inclut tout le Detective Bureau, dont son superviseur (rôle DB_SUPERVISOR),
    // même s'il n'a pas un grade de Detective.
    divisionCodes: ["DB"],
  },
  {
    key: "command-staff",
    name: "Command Staff",
    categories: ["COMMAND_STAFF", "CHIEF_OFFICE"],
  },
  { key: "chief-office", name: "Chief Office", categories: ["CHIEF_OFFICE"] },
];

export const BUILTIN_CHANNELS: Channel[] = BUILTIN_DEFS.map((d) => ({
  key: d.key,
  name: d.name,
  builtin: true,
  categories: d.categories,
  rankCodes: [],
  userIds: [],
  divisionCodes: d.divisionCodes ?? [],
  certCodes: [],
}));

export function canAccessChannel(user: SessionUser, ch: Channel) {
  return (
    user.isSuperAdmin ||
    // Le Chief Office a accès à TOUS les canaux, sans exception possible.
    user.rank.category === "CHIEF_OFFICE" ||
    ch.categories.includes(user.rank.category) ||
    ch.rankCodes.includes(user.rank.code) ||
    ch.userIds.includes(user.id) ||
    ch.divisionCodes.some((code) => inDivision(user, code)) ||
    ch.certCodes.some((code) => hasCertification(user, code))
  );
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function toChannel(row: {
  id: number;
  key: string;
  name: string;
  rankCodes: unknown;
  userIds: unknown;
  divisionCodes: unknown;
  certCodes: unknown;
}): Channel {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    builtin: false,
    categories: [],
    rankCodes: arr<string>(row.rankCodes),
    userIds: arr<number>(row.userIds),
    divisionCodes: arr<string>(row.divisionCodes),
    certCodes: arr<string>(row.certCodes),
  };
}

export async function listChannels(): Promise<Channel[]> {
  const custom = await db.messageChannel.findMany({
    orderBy: { createdAt: "asc" },
  });
  return [...BUILTIN_CHANNELS, ...custom.map(toChannel)];
}

export async function accessibleChannels(user: SessionUser): Promise<Channel[]> {
  return (await listChannels()).filter((ch) => canAccessChannel(user, ch));
}

export async function channelByKey(key: string): Promise<Channel | undefined> {
  const builtin = BUILTIN_CHANNELS.find((c) => c.key === key);
  if (builtin) return builtin;
  const row = await db.messageChannel.findUnique({ where: { key } });
  return row ? toChannel(row) : undefined;
}
