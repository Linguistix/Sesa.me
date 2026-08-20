import "server-only";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  bucket,
  buildObjectKey,
  getS3,
  isOwnStorageUrl,
  keyFromPublicUrl,
  publicUrlFor,
  validateUpload,
  type UploadPurpose,
} from "@/lib/storage";

/** Short enough that a leaked URL is not a lasting upload credential. */
const PRESIGN_TTL_SECONDS = 120;

export interface PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  /** Headers the client MUST send, because they are part of the signature. */
  headers: Record<string, string>;
  expiresIn: number;
}

export type PresignResult =
  | { ok: true; upload: PresignedUpload }
  | { ok: false; error: string };

/**
 * Issues a presigned PUT for one object.
 *
 * Three things are signed into the URL, and each closes a hole that a naive
 * presign leaves open:
 *
 *  - **The key**, generated here from the authenticated user's id. A
 *    client-chosen key would let one user write under another's prefix.
 *  - **Content-Type**, forced into the signature via `signableHeaders`, so the
 *    browser cannot upload `text/html` through a URL issued for a PNG. These
 *    files are served from a URL pages embed, so an HTML upload would be
 *    stored XSS.
 *  - **Content-Length**, so the size cap is enforced by the storage provider
 *    rather than by a client-side check anyone can skip.
 *
 * A mismatch on any of them makes the provider reject the upload outright.
 */
export async function presignUpload(params: {
  userId: string;
  purpose: UploadPurpose;
  contentType: string;
  contentLength: number;
}): Promise<PresignResult> {
  const client = getS3();
  if (!client) return { ok: false, error: "Le stockage de fichiers n'est pas configuré." };

  const validation = validateUpload({
    purpose: params.purpose,
    contentType: params.contentType,
    contentLength: params.contentLength,
  });
  if (!validation.ok) return validation;

  const key = buildObjectKey({
    userId: params.userId,
    purpose: params.purpose,
    contentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: params.contentType,
      ContentLength: params.contentLength,
      // Uploaded images are immutable — the key is random, so a changed image
      // is a new key — which makes a long max-age safe and correct.
      CacheControl: "public, max-age=31536000, immutable",
    }),
    {
      expiresIn: PRESIGN_TTL_SECONDS,
      // Without this the presigner hoists Content-Type out of the signature
      // (it signs only `content-length;host` by default), and a URL issued for
      // a PNG would happily accept a text/html body — stored XSS on whatever
      // domain serves the bucket. Verified by `uploads.spec.ts`, which asserts
      // both headers appear in X-Amz-SignedHeaders.
      signableHeaders: new Set(["content-type", "content-length"]),
    },
  );

  return {
    ok: true,
    upload: {
      uploadUrl,
      publicUrl: publicUrlFor(key),
      key,
      headers: {
        "Content-Type": params.contentType,
        "Content-Length": String(params.contentLength),
      },
      expiresIn: PRESIGN_TTL_SECONDS,
    },
  };
}

/**
 * Removes an object we own.
 *
 * Silently ignores URLs that are not ours: the image fields also accept
 * external URLs, and a delete must never be aimed at somebody else's host.
 * Also ignores the key not existing, which is the common case when a user
 * replaces an image twice in a row.
 */
export async function deleteByPublicUrl(url: string, userId: string): Promise<boolean> {
  if (!isOwnStorageUrl(url)) return false;

  const client = getS3();
  if (!client) return false;

  const key = keyFromPublicUrl(url);
  if (!key) return false;

  // Ownership is in the key itself. Re-deriving the prefix and comparing is
  // what stops a crafted URL from deleting another user's object.
  const safeUserId = userId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 32);
  if (!key.startsWith(`uploads/${safeUserId}/`)) return false;

  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch (error) {
    console.error("[uploads] delete failed", error);
    return false;
  }
}
