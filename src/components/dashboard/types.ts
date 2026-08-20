import type { BlockType } from "@/lib/block-types";

export interface EditorLink {
  id: string;
  type: BlockType;
  title: string;
  url: string | null;
  emoji: string | null;
  body: string | null;
  images: string[];
  isActive: boolean;
  /** Set when the block's content is pulled from a connected account. */
  syncProvider: "SPOTIFY_LATEST_RELEASE" | "YOUTUBE_LATEST_VIDEO" | null;
  syncError: string | null;
  /** Whether a password gate exists — the hash itself never leaves the server. */
  hasPassword: boolean;
}
