"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  ChartColumn,
  DatabaseZap,
  ClipboardList,
  FileStack,
  FileText,
  FileWarning,
  Fingerprint,
  FolderLock,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  LayoutTemplate,
  Lock,
  Mail,
  Megaphone,
  MessagesSquare,
  Network,
  Radio,
  RadioTower,
  Scale,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Skull,
  UserCog,
  Users,
  UsersRound,
  UserSearch,
  type LucideIcon,
} from "lucide-react";

import { LspdShield } from "@/components/brand/lspd-shield";
import type { ModuleGroup, NavItem } from "@/lib/permissions";
import { cn } from "@/lib/utils";

// Table explicite plutôt qu'un import dynamique : cela garde le bundle client
// limité aux seules icônes réellement utilisées par le menu.
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  ShieldAlert,
  BookOpen,
  GraduationCap,
  Radio,
  RadioTower,
  FileText,
  Users,
  Siren,
  ShieldCheck,
  ClipboardList,
  Megaphone,
  Mail,
  MessagesSquare,
  Network,
  FileStack,
  FileWarning,
  FolderLock,
  Fingerprint,
  UserSearch,
  UsersRound,
  Skull,
  ArrowLeftRight,
  CalendarCheck,
  CalendarClock,
  DatabaseZap,
  Handshake,
  LayoutTemplate,
  Scale,
  ChartColumn,
  UserCog,
  ScrollText,
  Lock,
};

export function Sidebar({
  modules,
  groups,
  logoUrl,
}: {
  modules: NavItem[];
  groups: ModuleGroup[];
  /** Logo déposé dans `public/`. À défaut, l'écusson SVG intégré est utilisé. */
  logoUrl: string | null;
}) {
  const pathname = usePathname();

  // Un seul lien actif : celui dont le href est le plus long préfixe du chemin
  // courant. Évite que `/divisions` s'allume sur `/divisions/METRO/documents`.
  let activeHref: string | null = null;
  for (const m of modules) {
    if (pathname === m.href || pathname.startsWith(`${m.href}/`)) {
      if (!activeHref || m.href.length > activeHref.length) activeHref = m.href;
    }
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-ink-700 bg-ink-900/60">
      <Link
        href="/dashboard"
        className="flex items-center gap-3 border-b border-ink-700 px-5 py-4"
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Los Santos Police Department"
            className="h-10 w-10 shrink-0 object-contain"
          />
        ) : (
          <LspdShield className="h-9 w-auto shrink-0" />
        )}
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-wide text-mist-100">
            LSPD MDT
          </p>
          <p className="text-[0.62rem] tracking-widest text-gold-500 uppercase">
            Station 9
          </p>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Tableau de bord : point d'entrée, rendu seul au-dessus des groupes. */}
        {(() => {
          const dash = modules.find((m) => m.key === "dashboard");
          return dash ? (
            <ul className="mb-5 space-y-0.5">
              <NavLink item={dash} active={dash.href === activeHref} />
            </ul>
          ) : null;
        })()}

        {groups.map((group) => {
          const items = modules.filter(
            (m) => m.group === group && m.key !== "dashboard",
          );
          if (items.length === 0) return null;

          return (
            <div key={group} className="mb-5 last:mb-0">
              <p className="label-tag px-2 pb-2">{group}</p>
              <ul className="space-y-0.5">
                {items.map((m) => (
                  <NavLink key={m.key} item={m} active={m.href === activeHref} />
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <footer className="border-t border-ink-700 px-4 py-3 text-center">
        <Link
          href="/legal"
          className="block text-[0.6rem] leading-relaxed tracking-wide text-mist-600 transition-colors hover:text-mist-400"
        >
          © CORE France Project
          <br />
          by Anas · Mentions légales &amp; CGU
        </Link>
      </footer>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = ICONS[item.icon] ?? FileText;

  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
          active
            ? "bg-badge-600/20 text-badge-300"
            : "text-mist-300 hover:bg-ink-800 hover:text-mist-100",
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            active ? "text-badge-400" : "text-mist-500",
          )}
        />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  );
}
