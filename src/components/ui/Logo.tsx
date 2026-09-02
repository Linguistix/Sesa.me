/**
 * The Sesame wordmark.
 *
 * One definition, used by the marketing header, the dashboard header and the
 * auth pages. It was written out inline in each of them, which is how a mark
 * ends up subtly different in three places.
 *
 * The tile is `aria-hidden` and the word carries the name: a screen reader
 * announcing "S Sesame" is the letter being read twice.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 text-md font-semibold tracking-tight ${className}`}>
      <span
        aria-hidden
        className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-accent-400 to-accent-600 text-2xs font-bold text-ink-950"
      >
        S
      </span>
      Sesame
    </span>
  );
}
