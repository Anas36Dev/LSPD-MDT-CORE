import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Panel — conteneur de base du MDT
// ---------------------------------------------------------------------------

export function Panel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl border border-ink-700 bg-ink-900/80 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-ink-700 px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold tracking-wide text-mist-100">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-mist-500">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "discord";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-badge-600 text-white hover:bg-badge-500 border border-badge-500/60 shadow-sm shadow-badge-600/30",
  secondary:
    "bg-ink-800 text-mist-100 hover:bg-ink-700 border border-ink-600",
  ghost: "text-mist-300 hover:text-mist-100 hover:bg-ink-800 border border-transparent",
  danger: "bg-alert-600 text-white hover:bg-alert-500 border border-alert-500/60",
  discord: "bg-[#5865F2] text-white hover:bg-[#4752c4] border border-[#5865F2]",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Champs de formulaire
// ---------------------------------------------------------------------------

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label-tag">{label}</span>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1.5 text-xs text-alert-500">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-mist-500">{hint}</p>
      ) : null}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-sm text-mist-100",
        "placeholder:text-mist-500/70 focus:border-badge-500 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Badge / pastille
// ---------------------------------------------------------------------------

type BadgeTone = "neutral" | "blue" | "gold" | "green" | "red" | "amber";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "border-ink-600 bg-ink-800 text-mist-300",
  blue: "border-badge-500/40 bg-badge-600/15 text-badge-300",
  gold: "border-gold-500/40 bg-gold-600/15 text-gold-400",
  green: "border-ok-500/40 bg-ok-500/15 text-ok-500",
  red: "border-alert-500/40 bg-alert-600/15 text-alert-500",
  amber: "border-warn-500/40 bg-warn-500/15 text-warn-500",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// État vide
// ---------------------------------------------------------------------------

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p className="text-sm font-medium text-mist-300">{title}</p>
      {description ? (
        <p className="max-w-md text-xs leading-relaxed text-mist-500">
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}
