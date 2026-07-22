"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Send, Trash2, X } from "lucide-react";

import { formatDateTime } from "@/lib/utils";
import { deleteGroupMessage, sendGroupMessage } from "../actions";

export type ChatMessage = {
  id: number;
  senderId: number;
  senderName: string;
  senderBadge: string;
  senderRank: string;
  avatarUrl: string | null;
  body: string | null;
  imageUrl: string | null;
  createdAt: string;
};

const IMG_URL = /^https?:\/\/\S+\.(png|jpe?g|gif|webp|bmp)(\?\S*)?$/i;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function ChatView({
  channelKey,
  channelName,
  currentUserId,
  canModerate,
  messages,
}: {
  channelKey: string;
  channelName: string;
  currentUserId: number;
  canModerate: boolean;
  messages: ChatMessage[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pasted, setPasted] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Rafraîchissement périodique : nouveaux messages des autres agents.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [router]);

  // Auto-défilement en bas quand la conversation change.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pasted]);

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

  async function send() {
    if (sending) return;
    if (!body.trim() && !pasted) return;
    setSending(true);
    setError(null);
    const fd = new FormData();
    fd.set("channel", channelKey);
    fd.set("body", body);
    if (pasted) fd.set("image", pasted);
    const res = await sendGroupMessage(undefined, fd);
    setSending(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setBody("");
    setPasted(null);
    router.refresh();
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col overflow-hidden rounded-xl border border-ink-700 bg-ink-900/60">
      {/* --- Fil de discussion ------------------------------------------- */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-mist-500">
            Aucun message. Lancez la conversation.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === currentUserId;
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}
              >
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.avatarUrl}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full border border-ink-600 object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-600 bg-ink-850 text-[0.6rem] font-semibold text-mist-300">
                    {initials(m.senderName)}
                  </span>
                )}

                <div className={`group max-w-[75%] ${mine ? "items-end" : ""}`}>
                  {!mine ? (
                    <p className="mb-0.5 px-1 text-[0.68rem] text-mist-500">
                      {m.senderRank} {m.senderName} #{m.senderBadge}
                    </p>
                  ) : null}
                  <div
                    className={`relative rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      mine
                        ? "rounded-br-sm bg-badge-600 text-white"
                        : "rounded-bl-sm bg-ink-800 text-mist-100"
                    }`}
                  >
                    {m.body && IMG_URL.test(m.body.trim()) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.body.trim()}
                        alt=""
                        className="max-h-72 rounded-lg"
                      />
                    ) : m.body ? (
                      <p className="whitespace-pre-line break-words">{m.body}</p>
                    ) : null}
                    {m.imageUrl ? (
                      <a href={m.imageUrl} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.imageUrl}
                          alt="pièce jointe"
                          className="mt-1 max-h-72 rounded-lg"
                        />
                      </a>
                    ) : null}
                    <span
                      className={`mt-1 block text-[0.58rem] ${mine ? "text-white/70" : "text-mist-500"}`}
                    >
                      {formatDateTime(m.createdAt)}
                    </span>

                    {mine || canModerate ? (
                      <form
                        action={deleteGroupMessage}
                        className={`absolute -top-2 ${mine ? "-left-2" : "-right-2"} opacity-0 transition-opacity group-hover:opacity-100`}
                      >
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          type="submit"
                          title="Supprimer"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-ink-600 bg-ink-900 text-mist-400 hover:text-alert-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* --- Zone de saisie ---------------------------------------------- */}
      <div className="border-t border-ink-700 bg-ink-900/80 px-4 py-3">
        {pasted ? (
          <div className="mb-2 inline-flex items-start gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pasted}
              alt="à envoyer"
              className="h-16 w-16 rounded-md border border-ink-600 object-cover"
            />
            <button
              type="button"
              onClick={() => setPasted(null)}
              className="text-mist-500 hover:text-alert-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {error ? (
          <p className="mb-2 text-xs text-alert-500">{error}</p>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder={`Envoyer un message dans ${channelName}`}
            className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100 placeholder:text-mist-500/70 focus:border-badge-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || (!body.trim() && !pasted)}
            title="Envoyer"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-badge-500/60 bg-badge-600 text-white transition-colors hover:bg-badge-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pasted ? <ImagePlus className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
