/**
 * Génération de l'identifiant de connexion, utilisable côté client pour
 * l'aperçu en direct dans le formulaire de création.
 *
 * La règle est identique à `buildEmail` de `src/lib/auth.ts` — ce dernier reste
 * la référence côté serveur, seul à faire foi lors de l'enregistrement.
 */
export function buildEmailClient(firstName: string, lastName: string) {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");

  const f = clean(firstName);
  const l = clean(lastName);
  if (!f || !l) return "";
  return `${f}.${l}@lspd.core`;
}
