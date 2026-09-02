"use client";

import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";

/**
 * Form controls.
 *
 * One `Field` owns the label/hint/error relationship and wires `htmlFor`,
 * `aria-describedby` and `aria-invalid` itself. Left to each screen, those
 * associations are the first thing to be forgotten — and their absence is
 * invisible until someone uses a screen reader.
 */

export const inputClass = [
  "w-full rounded-md bg-ink-900 px-3 text-base text-ink-50",
  "ring-1 ring-inset ring-white/10",
  "transition-[box-shadow,background-color] duration-[120ms]",
  "placeholder:text-ink-600",
  "hover:ring-white/16",
  "focus:outline-none focus:ring-2 focus:ring-accent-500",
  "disabled:opacity-50",
  "aria-[invalid=true]:ring-critical-500/60",
].join(" ");

const CONTROL_HEIGHT = "h-9";

export function Field({
  label,
  hint,
  error,
  className = "",
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  /** Receives the ids to wire onto the control. */
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-ink-300">
        {label}
        {hint ? (
          <span id={hintId} className="ml-1.5 font-normal text-ink-500">
            {hint}
          </span>
        ) : null}
      </label>

      {children({ id, describedBy, invalid: Boolean(error) })}

      {error ? (
        <span id={errorId} role="alert" className="text-xs text-critical-400">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function TextInput({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${inputClass} ${CONTROL_HEIGHT} ${className}`} {...props} />;
}

export function TextArea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${inputClass} resize-y py-2 ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <select className={`${inputClass} ${CONTROL_HEIGHT} pr-8 ${className}`} {...props}>
      {children}
    </select>
  );
}

/**
 * A switch, not a checkbox.
 *
 * The native checkbox is fine semantically but renders as a system control
 * with a system accent colour — the one element on screen that ignores the
 * design system. This keeps `role="switch"` on a real button so keyboard and
 * screen-reader behaviour are unchanged.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full",
        "transition-colors duration-[120ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        "disabled:opacity-45",
        checked ? "bg-accent-500" : "bg-ink-700",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm",
          "transition-transform duration-[120ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          checked ? "translate-x-[1.125rem]" : "translate-x-[0.1875rem]",
        ].join(" ")}
      />
    </button>
  );
}
