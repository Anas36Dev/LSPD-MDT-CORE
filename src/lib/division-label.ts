/**
 * Abréviations des divisions telles qu'affichées sur les badges.
 *
 * Le libellé de Training Division dépend de l'affectation interne de l'agent :
 * « FTO » pour un Field Training Officer (In-Service Training Division),
 * « PA » pour un instructeur de l'académie (Recruit Training Section).
 */
const DIVISION_ABBR: Record<string, string> = {
  METRO: "METRO",
  ASD: "ASD",
  TD: "TD",
  IAD: "IAD",
  PCG: "Public Comms",
  DB: "Detective",
  PATROL: "PATROL",
};

export function divisionShortLabel(
  divisionCode: string,
  roleCodes: string[] = [],
  subDivisionCodes: string[] = [],
): string {
  if (divisionCode === "TD") {
    if (roleCodes.includes("TD_FTO") || subDivisionCodes.includes("TD_IST")) {
      return "FTO";
    }
    if (
      roleCodes.includes("TD_ACADEMY_INSTRUCTOR") ||
      subDivisionCodes.includes("TD_RTS")
    ) {
      return "PA";
    }
    return "Training";
  }

  return DIVISION_ABBR[divisionCode] ?? divisionCode;
}
