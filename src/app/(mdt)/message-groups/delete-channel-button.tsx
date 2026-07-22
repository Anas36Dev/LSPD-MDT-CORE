"use client";

import { Trash2 } from "lucide-react";

import { ConfirmButton } from "@/components/confirm-button";
import { deleteChannel } from "./actions";

export function DeleteChannelButton({
  id,
  name,
}: {
  id: number;
  name: string;
}) {
  return (
    <ConfirmButton
      action={deleteChannel}
      fields={{ id }}
      title="Supprimer le canal"
      message={`Supprimer le canal « ${name} » et tous ses messages ? Cette action est irréversible.`}
      confirmLabel="Supprimer"
      triggerTitle="Supprimer le canal"
      triggerClassName="cursor-pointer rounded-md border border-ink-600 p-1.5 text-mist-500 transition-colors hover:border-alert-500/50 hover:text-alert-500"
      trigger={<Trash2 className="h-3.5 w-3.5" />}
    />
  );
}
