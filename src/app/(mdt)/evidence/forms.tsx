"use client";

import { useActionState, useRef, useState } from "react";
import { Clipboard, ImagePlus, Link2, Plus, Trash2, X } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { ActionFeedback } from "@/components/action-feedback";
import {
  addEvidenceItems,
  createFolder,
  deleteEvidenceItem,
  deleteFolder,
  linkFolderToInvestigation,
  type EvidenceState,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 focus:border-badge-500 focus:outline-none";

function Feedback({ state }: { state: EvidenceState }) {
  return (
    <ActionFeedback error={state?.error} success={state?.success} />
  );
}

export function CreateFolderForm() {
  const [state, action, pending] = useActionState<EvidenceState, FormData>(
    createFolder,
    undefined,
  );

  return (
    <form action={action} className="space-y-4 px-5 py-4">
      <Field label="Titre du dossier">
        <Input name="title" required placeholder="Braquage bijouterie — Vinewood" />
      </Field>
      <Field label="Description (facultatif)">
        <textarea name="description" rows={2} className={inputClass} />
      </Field>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        <Plus className="h-4 w-4" />
        {pending ? "Création…" : "Créer le dossier"}
      </Button>
    </form>
  );
}

type Pasted = { id: string; dataUrl: string };

/**
 * Zone de dépôt de preuves : on colle une capture (CTRL+V) ou on saisit un ou
 * plusieurs liens (Discord, Imgur…). Les images collées sont converties en data
 * URL côté client puis téléversées comme fichiers par l'action serveur.
 */
export function AddEvidenceForm({ folderId }: { folderId: number }) {
  const [state, action, pending] = useActionState<EvidenceState, FormData>(
    addEvidenceItems,
    undefined,
  );
  const [pasted, setPasted] = useState<Pasted[]>([]);
  const counter = useRef(0);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      if (dataUrl.startsWith("data:image/")) {
        counter.current += 1;
        setPasted((p) => [...p, { id: `p${counter.current}`, dataUrl }]);
      }
    };
    reader.readAsDataURL(file);
  }

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(e.clipboardData.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length > 0) {
      e.preventDefault();
      files.forEach(readFile);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length > 0) {
      e.preventDefault();
      files.forEach(readFile);
    }
  }

  function remove(id: string) {
    setPasted((p) => p.filter((x) => x.id !== id));
  }

  return (
    <form
      action={(fd) => {
        // Les images collées ne sont pas dans un input natif : on les injecte.
        pasted.forEach((p) => fd.append("image", p.dataUrl));
        action(fd);
        setPasted([]);
        counter.current = 0;
      }}
      className="space-y-3 border-t border-ink-700 px-5 py-4"
    >
      <input type="hidden" name="folderId" value={folderId} />

      <div
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        tabIndex={0}
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-ink-600 bg-ink-850/50 px-4 py-6 text-center text-xs text-mist-500 focus:border-badge-500 focus:outline-none"
      >
        <Clipboard className="h-5 w-5 text-mist-400" />
        <span>
          Cliquez ici puis <span className="text-mist-200">collez une image</span>{" "}
          (CTRL+V) — ou glissez-déposez un fichier image.
        </span>
      </div>

      {pasted.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {pasted.map((p) => (
            <div
              key={p.id}
              className="relative h-20 w-20 overflow-hidden rounded-md border border-ink-600"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.dataUrl}
                alt="Preuve collée"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-ink-900/80 text-mist-300 hover:text-alert-500"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <Field label="Liens d'images (un par ligne)">
        <textarea
          name="links"
          rows={2}
          placeholder="https://cdn.discordapp.com/…&#10;https://i.imgur.com/…"
          className={inputClass}
        />
      </Field>

      <Field label="Légende commune (facultatif)">
        <Input name="caption" placeholder="Caméra de surveillance, 03h12" />
      </Field>

      <Feedback state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        <ImagePlus className="h-4 w-4" />
        {pending ? "Ajout…" : "Ajouter les pièces"}
      </Button>
    </form>
  );
}

export function LinkInvestigationForm({
  folderId,
  investigations,
  currentInvestigationId,
}: {
  folderId: number;
  investigations: { id: number; label: string }[];
  currentInvestigationId: number | null;
}) {
  const [state, action, pending] = useActionState<EvidenceState, FormData>(
    linkFolderToInvestigation,
    undefined,
  );

  return (
    <form action={action} className="space-y-3 border-t border-ink-700 px-5 py-4">
      <input type="hidden" name="folderId" value={folderId} />
      <div className="flex gap-2">
        <select
          name="investigationId"
          defaultValue={currentInvestigationId ?? ""}
          className={inputClass}
        >
          <option value="">— Aucune enquête —</option>
          {investigations.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.label}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          variant="secondary"
          disabled={pending}
          className="shrink-0"
        >
          <Link2 className="h-4 w-4" />
          {pending ? "…" : "Rattacher"}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function DeleteItemButton({ itemId }: { itemId: number }) {
  return (
    <form action={deleteEvidenceItem}>
      <input type="hidden" name="itemId" value={itemId} />
      <button
        type="submit"
        title="Supprimer la pièce"
        className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-ink-900/80 text-mist-300 transition-colors hover:text-alert-500"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

export function DeleteFolderButton({ folderId }: { folderId: number }) {
  return (
    <ConfirmButton
      action={deleteFolder}
      fields={{ folderId }}
      title="Supprimer le dossier"
      message="Supprimer définitivement ce dossier de preuves et toutes ses pièces ?"
      confirmLabel="Supprimer le dossier"
      triggerClassName="inline-flex items-center gap-1.5 rounded-md border border-alert-500/50 px-2.5 py-1 text-xs text-alert-500 transition-colors hover:bg-alert-600/15"
      trigger={
        <>
          <Trash2 className="h-3.5 w-3.5" />
          Supprimer le dossier
        </>
      }
    />
  );
}
