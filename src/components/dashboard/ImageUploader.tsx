"use client";

import { useRef, useState } from "react";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, formatBytes, type UploadPurpose } from "@/lib/storage";

export interface UploadedImage {
  url: string;
  key: string;
}

/**
 * Direct-to-storage uploader.
 *
 * The file never passes through the application server: the browser asks for a
 * presigned URL and then PUTs straight to the bucket. That keeps an 8 MB photo
 * off the request path of a serverless function with a body-size limit, and
 * off our egress bill.
 *
 * The headers below are not optional — they are part of the signature, so an
 * upload that omits them is rejected by the provider.
 */
export function ImageUploader({
  purpose,
  label,
  multiple = false,
  onUploaded,
}: {
  purpose: UploadPurpose;
  label: string;
  multiple?: boolean;
  onUploaded: (images: UploadedImage[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function uploadOne(file: File): Promise<UploadedImage> {
    const presignResponse = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purpose,
        contentType: file.type,
        contentLength: file.size,
      }),
    });

    const body = await presignResponse.json();
    if (!presignResponse.ok) throw new Error(body.error ?? "Téléversement impossible.");

    const put = await fetch(body.uploadUrl, {
      method: "PUT",
      headers: body.headers,
      body: file,
    });

    if (!put.ok) {
      throw new Error("Le stockage a refusé le fichier.");
    }

    return { url: body.publicUrl, key: body.key };
  }

  async function handleFiles(files: FileList) {
    setError(null);

    const selected = Array.from(files);

    // Checked client-side too, so an obviously oversized file fails instantly
    // rather than after a round trip. The server check is the real one.
    const max = MAX_UPLOAD_BYTES[purpose];
    const tooBig = selected.find((f) => f.size > max);
    if (tooBig) {
      setError(`« ${tooBig.name} » dépasse ${formatBytes(max)}.`);
      return;
    }

    const wrongType = selected.find((f) => !(f.type in ALLOWED_IMAGE_TYPES));
    if (wrongType) {
      setError(`« ${wrongType.name} » n'est pas un format d'image accepté.`);
      return;
    }

    setProgress({ done: 0, total: selected.length });
    const uploaded: UploadedImage[] = [];

    try {
      for (const file of selected) {
        uploaded.push(await uploadOne(file));
        setProgress({ done: uploaded.length, total: selected.length });
      }
      onUploaded(uploaded);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Téléversement impossible.");
      // Anything that did land is still reported: losing three successful
      // uploads because the fourth failed would be worse than a partial result.
      if (uploaded.length > 0) onUploaded(uploaded);
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const busy = progress !== null;

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept={Object.keys(ALLOWED_IMAGE_TYPES).join(",")}
        multiple={multiple}
        className="sr-only"
        id={`upload-${purpose}`}
        onChange={(event) => {
          if (event.target.files?.length) void handleFiles(event.target.files);
        }}
      />

      <label
        htmlFor={`upload-${purpose}`}
        className={[
          "inline-flex cursor-pointer items-center gap-2 self-start rounded-md px-3 py-1.5 text-xs text-ink-200 ring-1 ring-inset ring-white/12 transition",
          busy ? "cursor-wait opacity-60" : "hover:bg-white/5",
        ].join(" ")}
      >
        {busy ? `Téléversement ${progress.done}/${progress.total}…` : label}
      </label>

      {error ? (
        <span role="alert" className="text-xs text-critical-400">
          {error}
        </span>
      ) : null}
    </div>
  );
}
