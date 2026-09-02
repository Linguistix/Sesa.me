import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Variants encode intent, not appearance.
 *
 * `danger` is deliberately quiet — a bordered ghost that only turns red on
 * hover. A destructive action rendered in solid red is the loudest thing in a
 * list, which trains people to notice "delete" before the thing they came to
 * do. Confirmation is what makes deletion safe; colour is what makes it
 * findable, and it only needs to be findable.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    // accent-solid rather than accent-500: white on accent-500 is 3.98:1, and a
    // primary action is the last place to spend the AA budget.
    "bg-accent-solid text-white shadow-raise hover:bg-accent-solid-hover active:bg-accent-600 disabled:hover:bg-accent-solid",
  secondary:
    "bg-ink-800 text-ink-100 ring-1 ring-inset ring-white/10 hover:bg-ink-750 hover:ring-white/16 active:bg-ink-800",
  ghost: "text-ink-300 hover:bg-white/6 hover:text-ink-50",
  danger: "text-critical-400 ring-1 ring-inset ring-critical-400/25 hover:bg-critical-500/12",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-2.5 text-xs rounded-md",
  md: "h-9 gap-2 px-3.5 text-base rounded-md",
  lg: "h-11 gap-2 px-5 text-md rounded-lg",
};

const BASE = [
  "inline-flex select-none items-center justify-center whitespace-nowrap font-medium",
  "transition-[background-color,color,box-shadow,transform] duration-[120ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
  "active:translate-y-px",
  "disabled:pointer-events-none disabled:opacity-45",
].join(" ");

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  extra = "",
): string {
  return [BASE, VARIANTS[variant], SIZES[size], extra].filter(Boolean).join(" ");
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button className={buttonClass(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

/** Same shape, for navigation. A link that looks like a button must still be a link. */
export function ButtonLink({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

/** An external or download link styled as a button. */
export function ButtonAnchor({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...props
}: ComponentProps<"a"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <a className={buttonClass(variant, size, className)} {...props}>
      {children}
    </a>
  );
}
