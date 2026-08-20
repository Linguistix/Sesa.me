"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfileAction } from "@/actions/page";
import type { ActionState } from "@/actions/auth";
import { Field, inputClass } from "./LinkForm";
import { displayHost } from "@/lib/urls";
import { ImageUploader } from "./ImageUploader";

const EMPTY: ActionState = {};

export function ProfileForm({
  page,
  storageEnabled,
}: {
  page: { slug: string; displayName: string; bio: string | null; avatarUrl: string | null };
  storageEnabled: boolean;
}) {
  const [state, formAction] = useActionState(updateProfileAction, EMPTY);
  const [avatarUrl, setAvatarUrl] = useState(page.avatarUrl ?? "");
  const saved = state !== EMPTY && !state.error && !state.fieldErrors;

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Field label="Nom affiché" error={state.fieldErrors?.displayName} className="flex-1">
          <input
            name="displayName"
            defaultValue={page.displayName}
            required
            maxLength={60}
            className={inputClass}
          />
        </Field>

        <Field label="Votre lien" error={state.fieldErrors?.slug} className="flex-1">
          <div className="flex items-center rounded-lg border border-white/15 bg-black/25 focus-within:border-indigo-400">
            <span className="pl-3 text-sm text-neutral-500">{displayHost()}/</span>
            <input
              name="slug"
              defaultValue={page.slug}
              required
              maxLength={32}
              pattern="[a-z0-9\-]+"
              className="w-full bg-transparent px-1 py-2 text-sm text-neutral-100 outline-none"
            />
          </div>
        </Field>
      </div>

      <Field label="Bio" error={state.fieldErrors?.bio} hint="280 caractères max">
        <textarea name="bio" defaultValue={page.bio ?? ""} rows={2} maxLength={280} className={inputClass} />
      </Field>

      <Field
        label="Avatar"
        error={state.fieldErrors?.avatarUrl}
        hint={storageEnabled ? "téléversez une image ou collez une URL" : "URL, facultatif"}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                aria-hidden
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : null}
            <input
              name="avatarUrl"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…/photo.jpg"
              className={inputClass}
            />
          </div>

          {storageEnabled ? (
            <ImageUploader
              purpose="avatar"
              label="Téléverser une image"
              onUploaded={([image]) => {
                if (image) setAvatarUrl(image.url);
              }}
            />
          ) : null}
        </div>
      </Field>

      {state.error ? (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <SaveButton />
        {saved ? (
          <span role="status" className="text-sm text-emerald-400">
            Enregistré.
          </span>
        ) : null}
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
    >
      {pending ? "Enregistrement…" : "Enregistrer"}
    </button>
  );
}
