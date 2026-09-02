/**
 * The block kinds a page can contain.
 *
 * Declared once here and reused by the Prisma enum, the Zod schemas, the
 * editor and the renderer, so adding a kind surfaces as a type error in every
 * place that has to handle it rather than as a silently unrendered block.
 */
export const BLOCK_TYPES = [
  "LINK",
  "SOCIAL",
  "HEADING",
  "TEXT",
  "EMBED",
  "GALLERY",
  "IMAGE",
  "FORM",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

/** Kinds that point somewhere and therefore need a validated URL. */
export const URL_BLOCK_TYPES: readonly BlockType[] = ["LINK", "SOCIAL", "EMBED"];

/** Kinds that carry images. */
export const IMAGE_BLOCK_TYPES: readonly BlockType[] = ["GALLERY", "IMAGE"];

export const BLOCK_LABELS: Record<BlockType, string> = {
  LINK: "Lien",
  SOCIAL: "Réseau social",
  HEADING: "Titre de section",
  TEXT: "Bloc de texte",
  EMBED: "Lecteur (Spotify, YouTube…)",
  GALLERY: "Galerie photo",
  IMAGE: "Image cliquable",
  FORM: "Formulaire",
};

/**
 * A glyph per block kind, shown when a block has no emoji of its own.
 *
 * An empty square in a list of ten rows makes the list look broken; a
 * consistent placeholder makes the kinds scannable at a glance.
 */
export const BLOCK_GLYPHS: Record<BlockType, string> = {
  LINK: "\u2197",
  SOCIAL: "\u25CE",
  HEADING: "\u00B6",
  TEXT: "\u201C",
  EMBED: "\u25B6",
  GALLERY: "\u25A6",
  IMAGE: "\u25A3",
  FORM: "\u2709",
};
