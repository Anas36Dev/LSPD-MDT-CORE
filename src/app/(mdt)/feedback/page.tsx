import type { Metadata } from "next";
import { Bug, Check, MessageSquarePlus, Trash2 } from "lucide-react";

import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { canReviewFeedback } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { FeedbackForm } from "./forms";
import { deleteFeedback, toggleFeedbackReviewed } from "./actions";

export const metadata: Metadata = { title: "Feedback" };

const TYPE_LABELS: Record<string, { label: string; tone: "blue" | "amber" | "neutral" }> = {
  SUGGESTION: { label: "Suggestion", tone: "blue" },
  BUG: { label: "Bug", tone: "amber" },
  OTHER: { label: "Autre", tone: "neutral" },
};

export default async function FeedbackPage() {
  const user = await requireUser();
  const canReview = canReviewFeedback(user);

  const all = canReview
    ? await db.feedback.findMany({
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 200,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              badgeNumber: true,
              rank: { select: { name: true } },
            },
          },
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-mist-100">Feedback</h1>
        <p className="mt-1 text-sm text-mist-500">
          Vos retours et suggestions pour améliorer le MDT
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="self-start lg:col-span-1">
          <PanelHeader
            title="Envoyer un retour"
            subtitle="Suggestion, bug ou remarque"
          />
          <FeedbackForm />
        </Panel>

        {canReview ? (
          <Panel className="lg:col-span-2">
            <PanelHeader
              title="Retours reçus"
              action={<Badge tone="neutral">{all.length}</Badge>}
            />
            {all.length === 0 ? (
              <EmptyState
                title="Aucun retour"
                description="Les retours envoyés par les agents apparaîtront ici."
              />
            ) : (
              <ul className="divide-y divide-ink-700">
                {all.map((f) => {
                  const t = TYPE_LABELS[f.type] ?? TYPE_LABELS.OTHER;
                  return (
                    <li key={f.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={t.tone}>
                          {f.type === "BUG" ? (
                            <Bug className="h-3 w-3" />
                          ) : (
                            <MessageSquarePlus className="h-3 w-3" />
                          )}
                          {t.label}
                        </Badge>
                        {f.status === "REVIEWED" ? (
                          <Badge tone="green">Traité</Badge>
                        ) : (
                          <Badge tone="amber">Nouveau</Badge>
                        )}
                        <span className="text-xs text-mist-500">
                          {f.user.rank.name} {f.user.firstName} {f.user.lastName}{" "}
                          #{f.user.badgeNumber} · {formatDateTime(f.createdAt)}
                        </span>
                        <div className="ml-auto flex items-center gap-1.5">
                          <form action={toggleFeedbackReviewed}>
                            <input type="hidden" name="id" value={f.id} />
                            <button
                              type="submit"
                              title={
                                f.status === "REVIEWED"
                                  ? "Marquer comme nouveau"
                                  : "Marquer comme traité"
                              }
                              className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-ink-600 text-mist-500 transition-colors hover:border-ok-500/50 hover:text-ok-500"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </form>
                          <form action={deleteFeedback}>
                            <input type="hidden" name="id" value={f.id} />
                            <button
                              type="submit"
                              title="Supprimer"
                              className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-ink-600 text-mist-500 transition-colors hover:border-alert-500/50 hover:text-alert-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        </div>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-mist-200">
                        {f.message}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        ) : (
          <Panel className="self-start lg:col-span-2">
            <div className="px-5 py-8 text-center text-sm text-mist-500">
              Merci de contribuer à l&apos;amélioration du terminal. Vos retours
              sont transmis au Chief of Police et à l&apos;Assistant Chief.
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
