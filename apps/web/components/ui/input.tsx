import * as React from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "h-12 w-full rounded-field border border-transparent bg-track px-4 text-body text-label transition-colors placeholder:text-ter focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn(fieldClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClass, "h-auto min-h-24 py-3", className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-footnote font-semibold text-sec", className)} {...props} />;
}

/** Label + control + "why we ask" hint + error, wired with aria (Section 6.5). */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: (aria: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
  }) => React.ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && (
        <p id={hintId} className="text-footnote text-ter">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-footnote font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Search field (redesign §5.4): 40px, --track, radius 12, a search glyph. */
export function SearchField({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <label className={cn("relative block", className)}>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-ter"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        className="h-10 w-full rounded-field bg-track pr-3 pl-9 text-body text-label placeholder:text-ter focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        {...props}
      />
    </label>
  );
}
