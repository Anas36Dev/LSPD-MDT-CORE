import Link from "next/link";
import { Users } from "lucide-react";

export type ChannelMember = {
  id: number;
  name: string;
  badge: string;
  rank: string;
  avatarUrl: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Panneau latéral listant les membres du canal, chacun cliquable vers son profil. */
export function ChannelMembers({ members }: { members: ChannelMember[] }) {
  return (
    <aside className="hidden h-[calc(100vh-13rem)] w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-ink-700 bg-ink-900/60 lg:flex">
      <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
        <Users className="h-4 w-4 text-badge-300" />
        <span className="text-xs font-semibold tracking-wider text-mist-300 uppercase">
          Membres
        </span>
        <span className="ml-auto text-xs text-mist-500">{members.length}</span>
      </div>
      <ul className="flex-1 divide-y divide-ink-800 overflow-y-auto">
        {members.map((m) => (
          <li key={m.id}>
            <Link
              href={`/roster/${m.id}`}
              className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-ink-800/60"
            >
              {m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.avatarUrl}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full border border-ink-600 object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink-600 bg-ink-850 text-[0.55rem] font-semibold text-mist-300">
                  {initials(m.name)}
                </span>
              )}
              <div className="min-w-0 leading-tight">
                <p className="truncate text-xs font-medium text-mist-100">
                  {m.name}
                </p>
                <p className="truncate text-[0.62rem] text-mist-500">
                  {m.rank} · #{m.badge}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
