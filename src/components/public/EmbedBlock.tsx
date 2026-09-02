import { detectEmbed, withParentHost } from "@/lib/embeds/providers";
import { displayHost } from "@/lib/urls";

/**
 * An embedded player.
 *
 * The iframe src is rebuilt by `detectEmbed` from a parsed, allow-listed URL —
 * a user-supplied URL is never passed through. When no provider matches, the
 * block degrades to a plain link rather than embedding something unknown.
 *
 * `loading="lazy"` matters here: a page with three players would otherwise
 * pull several hundred kilobytes of third-party JavaScript before first paint
 * and blow the sub-second budget.
 */
export function EmbedBlock({ url, title }: { url: string; title: string }) {
  const detected = detectEmbed(url);

  if (!detected) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center gap-3 px-5 py-4 text-[15px] font-medium"
        style={{
          background: "var(--sesame-btn-bg)",
          color: "var(--sesame-btn-text)",
          border: "var(--sesame-btn-border)",
          borderRadius: "var(--sesame-radius)",
        }}
      >
        <span className="flex-1 text-center">{title}</span>
      </a>
    );
  }

  const embed = withParentHost(detected, displayHost());

  return (
    /*
      The wrapper reserves the player's height and paints it in the theme's own
      surface colour before the iframe arrives. Without it a third-party player
      flashes white on a dark page while it loads, and shows browser
      broken-frame chrome if it never does — both of which look like the
      creator's page is broken rather than the network being slow.
    */
    <div
      className="relative w-full overflow-hidden"
      style={{
        borderRadius: "var(--sesame-radius)",
        height: embed.height,
        background: "var(--sesame-surface)",
      }}
    >
      <span
        aria-hidden
        className="absolute inset-0 grid place-items-center text-xs"
        style={{ color: "var(--sesame-muted)" }}
      >
        {embed.title}
      </span>

      <iframe
        src={embed.src}
        title={title || embed.title}
        height={embed.height}
        loading="lazy"
        allow={embed.allow}
        // The player is third-party; deny it everything it does not need.
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="strict-origin-when-cross-origin"
        className="relative w-full border-0"
        style={{ height: embed.height, colorScheme: "normal" }}
      />
    </div>
  );
}
