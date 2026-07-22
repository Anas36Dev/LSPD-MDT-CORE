import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DATETIME_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDate = (d: Date | string) => DATE_FMT.format(new Date(d));
export const formatDateTime = (d: Date | string) =>
  DATETIME_FMT.format(new Date(d));

/** Initiales servant de photo de profil de repli. */
export const initials = (firstName: string, lastName: string) =>
  `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

/**
 * Signature officielle d'un agent, au format « Grade Matricule | Prénom NOM ».
 * Apposée sur les documents (rapports, mandats, avis) au moment de la signature.
 */
export const officerSignature = (o: {
  rank: { name: string };
  badgeNumber: number | string;
  firstName: string;
  lastName: string;
}) => `${o.rank.name} ${o.badgeNumber} | ${o.firstName} ${o.lastName.toUpperCase()}`;
