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
  /** Whether a password gate exists — the hash itself never leaves the server. */
  hasPassword: boolean;
}
