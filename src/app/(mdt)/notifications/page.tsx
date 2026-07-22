import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  FileText,
  Mail,
  PackageOpen,
  Trash2,
  UserPlus,
} from "lucide-react";

import { Button, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { formatDateTime } from "@/lib/utils";
import { clearNotifications, deleteNotification } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

function iconFor(type: string) {
  if (type.startsWith("REPORT_")) return FileText;
  if (type === "MESSAGE") return Mail;
  if (type.startsWith("TRANSFER_")) return UserPlus;
  if (type === "CONVOCATION") return CalendarClock;
  if (type === "LOCKER_EMPTY") return PackageOpen;
  return Bell;
}

export default async function NotificationsPage() {
  const user = await requireUser();

  const list = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Ouvrir la page vaut lecture : on retient d'abord ce qui était non lu pour
  // le mettre en évidence cette fois-ci, puis on solde le compteur.
  const unread = new Set(list.filter((n) => !n.readAt).map((n) => n.id));
  if (unread.size > 0) {
    await db.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">Notifications</h1>
          <p className="mt-1 text-sm text-mist-500">
            Messages vous concernant.
          </p>
        </div>
        {list.length > 0 ? (
          <form action={clearNotifications}>
            <Button variant="ghost" type="submit" className="text-xs">
              <CheckCheck className="h-4 w-4" />
              Tout effacer
            </Button>
          </form>
        ) : null}
      </div>

      <Panel>
        <PanelHeader
          title="Boîte de réception"
          subtitle={`${list.length} notification(s)`}
        />
        {list.length === 0 ? (
          <EmptyState
            title="Aucune notification"
          />
        ) : (
          <ul className="divide-y divide-ink-700">
            {list.map((n) => {
              const Icon = iconFor(n.type);
              const fresh = unread.has(n.id);
              const row = (
                <div
                  className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                    n.link ? "hover:bg-ink-800/60" : ""
                  } ${fresh ? "bg-badge-600/5" : ""}`}
                >
                  <span
                    className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                      fresh
                        ? "border-badge-500/40 bg-badge-600/15 text-badge-300"
                        : "border-ink-600 bg-ink-850 text-mist-400"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-mist-100">
                      {n.title}
                    </p>
                    {n.body ? (
                      <p className="mt-0.5 text-xs leading-relaxed text-mist-300">
                        {n.body}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[0.68rem] text-mist-500">
                      {formatDateTime(n.createdAt)}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={n.id} className="flex items-center">
                  <div className="min-w-0 flex-1">
                    {n.link ? <Link href={n.link}>{row}</Link> : row}
                  </div>
                  <form action={deleteNotification} className="px-3">
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      type="submit"
                      title="Supprimer"
                      className="cursor-pointer rounded-md border border-ink-600 p-1.5 text-mist-500 transition-colors hover:border-alert-500/50 hover:text-alert-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
