export interface EditorLink {
  id: string;
  type: "LINK" | "HEADING" | "TEXT" | "SOCIAL";
  title: string;
  url: string | null;
  emoji: string | null;
  body: string | null;
  isActive: boolean;
  /** Whether a password gate exists — the hash itself never leaves the server. */
  hasPassword: boolean;
}
