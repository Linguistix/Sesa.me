import { S3Client } from "@aws-sdk/client-s3";

/**
 * Object storage for avatars and gallery images.
 *
 * S3-compatible rather than S3-specific: the same configuration drives
 * Cloudflare R2, Backblaze B2, MinIO or S3 itself, which is why `S3_ENDPOINT`
 * exists and `forcePathStyle` is on — R2 and MinIO address buckets by path,
 * while S3 defaults to virtual-host style.
 *
 * Optional, like Stripe and the AI engine: with no credentials the uploader is
 * hidden and image fields accept a URL as before.
 */
let cached: S3Client | null | undefined;

export function getS3(): S3Client | null {
  if (cached !== undefined) return cached;

  if (!isStorageConfigured()) {
    cached = null;
    return cached;
  }

  cached = new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });

  return cached;
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY,
  );
}

export function bucket(): string {
  return process.env.S3_BUCKET ?? "";
}

/** Testing seam: drops the memoised client so new env vars take effect. */
export function resetStorageForTests(): void {
  cached = undefined;
}

// --- What may be uploaded --------------------------------------------------

/**
 * Allowed image types, mapped to the extension the stored key gets.
 *
 * SVG is deliberately absent. An SVG is a document that can carry script, and
 * these files are served from a URL the page embeds — accepting one would be
 * stored XSS against every visitor. The cost of excluding it is that a creator
 * cannot upload a vector logo; that is the right trade.
 */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export type UploadPurpose = "avatar" | "gallery";

/**
 * Size caps, per purpose.
 *
 * An avatar renders at 96px and never needs to be large; a gallery photo is
 * viewed full-screen in the lightbox and does.
 */
export const MAX_UPLOAD_BYTES: Record<UploadPurpose, number> = {
  avatar: 2 * 1024 * 1024,
  gallery: 8 * 1024 * 1024,
};

export interface UploadRequest {
  purpose: UploadPurpose;
  contentType: string;
  contentLength: number;
}

export type ValidationError =
  | { ok: false; error: string };

export function validateUpload(request: UploadRequest): { ok: true } | ValidationError {
  const extension = ALLOWED_IMAGE_TYPES[request.contentType];
  if (!extension) {
    return {
      ok: false,
      error: `Format non accepté. Formats autorisés : ${Object.values(ALLOWED_IMAGE_TYPES).join(", ")}.`,
    };
  }

  const max = MAX_UPLOAD_BYTES[request.purpose];
  if (!Number.isFinite(request.contentLength) || request.contentLength <= 0) {
    return { ok: false, error: "Taille de fichier invalide." };
  }
  if (request.contentLength > max) {
    return {
      ok: false,
      error: `Fichier trop lourd (${formatBytes(request.contentLength)}). Maximum : ${formatBytes(max)}.`,
    };
  }

  return { ok: true };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Builds the object key.
 *
 * Generated server-side from the authenticated user's id plus randomness — the
 * client never chooses it. If it did, one user could name their key under
 * another user's prefix and overwrite their avatar, and an uploaded filename
 * could carry `../` or a second extension.
 */
export function buildObjectKey(params: {
  userId: string;
  purpose: UploadPurpose;
  contentType: string;
  random?: string;
}): string {
  const extension = ALLOWED_IMAGE_TYPES[params.contentType];
  if (!extension) throw new Error(`Unsupported content type: ${params.contentType}`);

  // Only [a-z0-9] survives from the user id, so a hypothetical exotic id
  // cannot introduce a path separator.
  const safeUserId = params.userId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 32);
  const random = params.random ?? crypto.randomUUID().replace(/-/g, "");

  return `uploads/${safeUserId}/${params.purpose}/${random}.${extension}`;
}

/**
 * The public URL an uploaded object is served from.
 *
 * `S3_PUBLIC_URL` is the CDN or custom domain in front of the bucket. Without
 * it the endpoint URL is used, which works for MinIO and for public S3 buckets
 * but is not what a production deployment should serve images from.
 */
export function publicUrlFor(key: string): string {
  const base = process.env.S3_PUBLIC_URL?.replace(/\/+$/, "");
  if (base) return `${base}/${key}`;

  const endpoint = process.env.S3_ENDPOINT?.replace(/\/+$/, "");
  if (endpoint) return `${endpoint}/${bucket()}/${key}`;

  return `https://${bucket()}.s3.${process.env.S3_REGION ?? "us-east-1"}.amazonaws.com/${key}`;
}

/**
 * True when a URL points at our own bucket.
 *
 * Used before deleting: the image fields also accept external URLs, and a
 * delete must never be attempted against something we do not own.
 */
export function isOwnStorageUrl(url: string): boolean {
  if (!isStorageConfigured()) return false;
  try {
    const parsed = new URL(url);
    const base = process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT;
    if (!base) return false;
    return parsed.origin === new URL(base).origin && parsed.pathname.includes("/uploads/");
  } catch {
    return false;
  }
}

/**
 * Extracts the object key from a public URL, or null if it does not look like
 * one of ours.
 *
 * Finds the `/uploads/` segment rather than stripping a fixed prefix, so it
 * works for both a CDN root and a path-style endpoint that puts the bucket
 * name in front of the key.
 */
export function keyFromPublicUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const index = path.indexOf("/uploads/");
    if (index === -1) return null;
    return path.slice(index + 1);
  } catch {
    return null;
  }
}
