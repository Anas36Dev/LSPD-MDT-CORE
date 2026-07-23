"use client";

import { useActionState, useState } from "react";
import { ImagePlus, X } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { ActionFeedback } from "@/components/action-feedback";
import { sendMessage, type MessageState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

export function MessageForm({
  agents,
  defaultRecipientId,
}: {
  agents: { id: number; label: string }[];
  defaultRecipientId?: number;
}) {
  const [state, action, pending] = useActionState<MessageState, FormData>(
    sendMessage,
    undefined,
  );
  const [pasted, setPasted] = useState<string | null>(null);

  function readImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      if (url.startsWith("data:image/")) setPasted(url);
    };
    reader.readAsDataURL(file);
  }

  function onPaste(e: React.ClipboardEvent) {
    const file = Array.from(e.clipboardData.files).find((f) =>
      f.type.startsWith("image/"),
    );
    if (file) {
      e.preventDefault();
      readImage(file);
    }
  }

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Destinataire">
          <select
            name="recipientId"
            defaultValue={defaultRecipientId ?? ""}
            className={inputClass}
            required
          >
            <option value="">— Choisir —</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Objet">
          <Input name="subject" required />
        </Field>
      </div>

      <Field
        label="Message"
        hint="Astuce : collez une image (Ctrl+V) pour la joindre."
      >
        <textarea
          name="body"
          rows={4}
          onPaste={onPaste}
          className={inputClass}
        />
      </Field>

      {/* L'image collée voyage en data URL dans ce champ caché ; le serveur
          l'enregistre et ne conserve que son chemin. */}
      {pasted ? (
        <>
          <input type="hidden" name="image" value={pasted} />
          <div className="inline-flex items-start gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pasted}
              alt="pièce jointe"
              className="h-20 w-20 rounded-md border border-ink-600 object-cover"
            />
            <button
              type="button"
              onClick={() => setPasted(null)}
              title="Retirer l'image"
              className="text-mist-500 transition-colors hover:text-alert-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : (
        <p className="inline-flex items-center gap-1.5 text-xs text-mist-500">
          <ImagePlus className="h-3.5 w-3.5" />
          Aucune image jointe
        </p>
      )}

      <ActionFeedback error={state?.error} success={state?.success} />

      <Button type="submit" disabled={pending}>
        {pending ? "Envoi…" : "Envoyer"}
      </Button>
    </form>
  );
}
