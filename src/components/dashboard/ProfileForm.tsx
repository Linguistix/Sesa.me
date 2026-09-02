"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfileAction } from "@/actions/page";
import type { ActionState } from "@/actions/auth";
import { Field, TextArea, TextInput, inputClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ImageUploader } from "./ImageUploader";
import { displayHost } from "@/lib/urls";

const EMPTY: ActionState = {};
const BIO_MAX = 280;

export function ProfileForm({
  page,
  storageEnabled,
}: {
  page: { slug: string; displayName: string; bio: string | null; avatarUrl: string | null };
  storageEnabled: boolean;
}) {
  const [state, formAction] = useActionState(updateProfileAction, EMPTY);
  const [avatarUrl, setAvatarUrl] = useState(page.avatarUrl ?? "");
  const [bio, setBio] = useState(page.bio ?? "");
  const saved = state !== EMPTY && !state.error && !state.fieldErrors;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/*
        The avatar leads: it is the largest thing on the finished page, so it
        should be the largest thing in the form that produces it.
      */}
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              aria-hidden
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover ring-1 ring-inset ring-white/10"
            />
          ) : (
            <div
              aria-hidden
              className="grid h-16 w-16 place-items-center rounded-full bg-ink-800 text-xl font-semibold text-ink-500 ring-1 ring-inset ring-white/8"
            >
              {page.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Field
            label="Avatar"
            hint={storageEnabled ? undefined : "URL"}
            error={state.fieldErrors?.avatarUrl}
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                name="avatarUrl"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…/photo.jpg"
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>

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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom affiché" error={state.fieldErrors?.displayName}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              name="displayName"
              defaultValue={page.displayName}
              required
              maxLength={60}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>

        <Field label="Votre lien" error={state.fieldErrors?.slug}>
          {({ id, describedBy, invalid }) => (
            <div
              className={`${inputClass} flex h-9 items-center gap-0 px-0 focus-within:ring-2 focus-within:ring-accent-500`}
            >
              <span className="pl-3 text-ink-500">{displayHost()}/</span>
              <input
                id={id}
                name="slug"
                defaultValue={page.slug}
                required
                maxLength={32}
                pattern="[a-z0-9\-]+"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-base text-ink-50 outline-none"
              />
            </div>
          )}
        </Field>
      </div>

      <Field
        label="Bio"
        hint={`${bio.length}/${BIO_MAX}`}
        error={state.fieldErrors?.bio}
      >
        {({ id, describedBy, invalid }) => (
          <TextArea
            id={id}
            name="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            maxLength={BIO_MAX}
            placeholder="Une phrase sur vous."
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>

      {state.error ? (
        <p role="alert" className="text-sm text-critical-400">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <SaveButton />
        {saved ? (
          <span role="status" className="flex items-center gap-1.5 text-sm text-positive-400">
            <svg viewBox="0 0 12 12" aria-hidden className="h-3.5 w-3.5">
              <path d="m2.5 6.5 2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Enregistré
          </span>
        ) : null}
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Enregistrement…" : "Enregistrer"}
    </Button>
  );
}
