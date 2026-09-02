import type { Theme } from "@/lib/theme/schema";
import { buttonLabel, sanitizeTheme } from "@/lib/theme/sanitize";

/**
 * A miniature of a real page, built from a real theme.
 *
 * The landing page's job is to show what the product makes. Rendering these
 * from the same `Theme` objects the app ships means the marketing can never
 * promise a look the product does not actually produce.
 */
export function ThemeCard({
  theme: input,
  name,
  displayName,
  lines,
}: {
  theme: Theme;
  name: string;
  displayName: string;
  lines: string[];
}) {
  // Through the same gate the live renderer uses. A miniature that skipped the
  // contrast repair could advertise a look the product refuses to ship.
  const { theme } = sanitizeTheme(input);
  const background =
    theme.background_effect.kind === "gradient"
      ? `linear-gradient(${theme.background_effect.angle}deg, ${theme.palette.background}, ${theme.background_effect.secondary ?? theme.palette.surface})`
      : theme.background_effect.kind === "radial"
        ? `radial-gradient(circle at 50% 0%, ${theme.background_effect.secondary ?? theme.palette.surface}, ${theme.palette.background} 70%)`
        : theme.palette.background;

  const radius =
    theme.button_style.shape === "pill"
      ? "9999px"
      : theme.button_style.shape === "square"
        ? "0"
        : "8px";

  const buttonBackground =
    theme.button_style.fill === "solid" ? theme.palette.accent : "transparent";

  const buttonColor = buttonLabel(theme);

  return (
    <figure className="overflow-hidden rounded-xl ring-1 ring-inset ring-white/10">
      <div
        className="flex flex-col items-center gap-2.5 px-5 py-7"
        style={{ background, fontFamily: `"${theme.typography.body_font}", system-ui, sans-serif` }}
      >
        <span
          aria-hidden
          className="h-11 w-11 shrink-0"
          style={{
            background: theme.palette.accent,
            borderRadius:
              theme.avatar_shape === "square"
                ? "2px"
                : theme.avatar_shape === "rounded"
                  ? "10px"
                  : "9999px",
          }}
        />

        <span
          className="text-[13px] font-medium"
          style={{
            color: theme.palette.text_primary,
            fontFamily: `"${theme.typography.display_font}", Georgia, serif`,
          }}
        >
          {displayName}
        </span>

        <span className="mb-1 text-[10px]" style={{ color: theme.palette.text_muted }}>
          {name}
        </span>

        {lines.map((line) => (
          <span
            key={line}
            className="flex w-full items-center justify-center px-3 py-1.5 text-[10px]"
            style={{
              background: buttonBackground,
              color: buttonColor,
              borderRadius: radius,
              border: theme.button_style.border
                ? `1px solid ${theme.button_style.fill === "solid" ? "transparent" : theme.palette.accent}`
                : "1px solid transparent",
              boxShadow: theme.button_style.shadow ? "0 4px 12px rgba(0,0,0,0.25)" : undefined,
            }}
          >
            {line}
          </span>
        ))}
      </div>
    </figure>
  );
}
