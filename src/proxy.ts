import { NextResponse, type NextRequest } from "next/server";

/**
 * Filtre de premier niveau (ex-« middleware », renommé `proxy` en Next 16).
 *
 * IMPORTANT : ce contrôle est volontairement OPTIMISTE — il se contente de
 * regarder si un cookie de session existe. Aucune requête base de données
 * n'est faite ici, car le proxy s'exécute aussi sur les préchargements de
 * routes et ralentirait toute la navigation.
 *
 * La vraie vérification (session valide, compte non suspendu, droits sur le
 * module) se fait dans `src/lib/guard.ts`, appelé par chaque page et chaque
 * Server Action. Ne jamais considérer ce fichier comme une barrière de sécurité.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("lspd_session");
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname === "/legal" ||
    pathname.startsWith("/api/auth/discord");

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Exclut les assets statiques : sans ce filtre, le proxy s'exécuterait sur
  // chaque fichier CSS, JS et image, et bloquerait le rendu de /login.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
