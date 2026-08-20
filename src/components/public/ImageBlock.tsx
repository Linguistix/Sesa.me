/**
 * A large clickable image card.
 *
 * Rendered as a figure when there is no destination, and as a link when there
 * is — rather than an always-anchor with a dead href, which reads as
 * interactive to a screen reader but goes nowhere.
 */
export function ImageBlock({
  src,
  title,
  href,
  linkId,
}: {
  src: string;
  title: string;
  href: string | null;
  linkId: string;
}) {
  if (!src) return null;

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={title}
      loading="lazy"
      decoding="async"
      className="w-full object-cover"
      style={{ borderRadius: "var(--sesame-radius)" }}
    />
  );

  if (!href) {
    return (
      <figure className="w-full">
        {image}
        {title ? (
          <figcaption className="mt-1.5 text-xs" style={{ color: "var(--sesame-muted)" }}>
            {title}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-link-id={linkId}
      className="block w-full transition-transform duration-150 hover:-translate-y-0.5"
    >
      {image}
    </a>
  );
}
