"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createLinkAction, updateLinkAction } from "@/actions/page";
import type { ActionState } from "@/actions/auth";
import type { EditorLink } from "./types";
import {
  BLOCK_GLYPHS,
  BLOCK_LABELS,
  BLOCK_TYPES,
  IMAGE_BLOCK_TYPES,
  URL_BLOCK_TYPES,
} from "@/lib/block-types";
import { Field, Select, TextArea, TextInput } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ImageUploader } from "./ImageUploader";

const EMPTY: ActionState = {};

export function LinkForm({
  mode,
  link,
  onDone,
  storageEnabled = false,
  syncProviders = [],
}: {
  mode: "create" | "edit";
  link?: EditorLink;
  onDone?: () => void;
  storageEnabled?: boolean;
  syncProviders?: Array<{ value: string; label: string }>;
}) {
  const action = mode === "create" ? createLinkAction : updateLinkAction;
  const [state, formAction] = useActionState(action, EMPTY);
  const [type, setType] = useState<EditorLink["type"]>(link?.type ?? "LINK");
  const [images, setImages] = useState<string[]>(link?.images ?? []);
  const [syncProvider, setSyncProvider] = useState<string>(link?.syncProvider ?? "");
  const [changePassword, setChangePassword] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const succeeded = state === EMPTY ? false : !state.error && !state.fieldErrors;

  /*
    Clearing the block's own state after a successful create happens during
    render, not in an effect: an effect would commit the filled-in form to the
    screen and then immediately re-render it empty, and React flags the
    cascading render. Comparing against the last state we handled is the
    documented way to adjust state when an input changes.
  */
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (succeeded && mode === "create") {
      setImages([]);
      setSyncProvider("");
    }
  }

  // The uncontrolled inputs and the parent callback are genuine side effects,
  // so they do stay here.
  useEffect(() => {
    if (!succeeded) return;
    if (mode === "create") formRef.current?.reset();
    onDone?.();
  }, [state, succeeded, mode, onDone]);

  const synced = syncProvider !== "";
  const needsUrl = URL_BLOCK_TYPES.includes(type) && !synced;
  const needsImages = IMAGE_BLOCK_TYPES.includes(type);
  const optionalUrl = type === "IMAGE";
  const canSync = syncProviders.length > 0 && URL_BLOCK_TYPES.includes(type);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {link ? <input type="hidden" name="linkId" value={link.id} /> : null}
      {link ? <input type="hidden" name="isActive" value={String(link.isActive)} /> : null}

      {/*
        Type is a segmented control rather than a dropdown: there are eight
        kinds, they are the first decision, and seeing all of them is what
        tells a new user the page can hold more than links.
      */}
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-ink-300">Type de bloc</legend>
        <input type="hidden" name="type" value={type} />
        <div className="flex flex-wrap gap-1.5">
          {BLOCK_TYPES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              aria-pressed={type === value}
              className={[
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors duration-[120ms]",
                type === value
                  ? "bg-accent-500/16 text-accent-300 ring-1 ring-inset ring-accent-400/35"
                  : "bg-ink-800 text-ink-300 ring-1 ring-inset ring-white/8 hover:bg-ink-750 hover:text-ink-100",
              ].join(" ")}
            >
              <span aria-hidden className="opacity-70">
                {BLOCK_GLYPHS[value]}
              </span>
              {BLOCK_LABELS[value]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Field label="Emoji" hint="facultatif" className="sm:w-24">
          {({ id }) => (
            <TextInput id={id} name="emoji" defaultValue={link?.emoji ?? ""} maxLength={8} />
          )}
        </Field>

        <Field label="Titre" error={state.fieldErrors?.title} className="flex-1">
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              name="title"
              defaultValue={link?.title ?? ""}
              required
              maxLength={80}
              placeholder="Ma chaîne YouTube"
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
      </div>

      {canSync ? (
        <Field label="Source automatique" hint="facultatif">
          {({ id }) => (
            <Select
              id={id}
              name="syncProvider"
              value={syncProvider}
              onChange={(e) => setSyncProvider(e.target.value)}
            >
              <option value="">Aucune — je saisis l&apos;URL moi-même</option>
              {syncProviders.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : (
        <input type="hidden" name="syncProvider" value="" />
      )}

      {synced ? (
        <p className="rounded-md bg-accent-500/8 px-3 py-2 text-xs text-accent-300 ring-1 ring-inset ring-accent-400/20">
          Le titre et le lien sont récupérés automatiquement depuis votre compte connecté.
          {link?.syncError ? <span className="text-caution-400"> {link.syncError}</span> : null}
        </p>
      ) : null}

      {needsImages ? (
        <Field
          label={type === "GALLERY" ? "Images de la galerie" : "Image"}
          hint="une URL par ligne"
          error={state.fieldErrors?.images}
        >
          {({ id, describedBy, invalid }) => (
            <div className="flex flex-col gap-2">
              <TextArea
                id={id}
                name="images"
                value={images.join("\n")}
                onChange={(e) => setImages(e.target.value.split(/\r?\n/))}
                rows={type === "GALLERY" ? 4 : 2}
                placeholder={"https://…/photo-1.jpg\nhttps://…/photo-2.jpg"}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />

              {images.filter(Boolean).length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {images.filter(Boolean).map((src) => (
                    <li key={src}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        aria-hidden
                        width={44}
                        height={44}
                        className="h-11 w-11 rounded-md object-cover ring-1 ring-inset ring-white/10"
                      />
                    </li>
                  ))}
                </ul>
              ) : null}

              {storageEnabled ? (
                <ImageUploader
                  purpose="gallery"
                  label={type === "GALLERY" ? "Téléverser des images" : "Téléverser une image"}
                  multiple={type === "GALLERY"}
                  onUploaded={(uploaded) => {
                    const urls = uploaded.map((u) => u.url);
                    setImages((current) =>
                      type === "GALLERY" ? [...current.filter(Boolean), ...urls] : urls.slice(0, 1),
                    );
                  }}
                />
              ) : null}
            </div>
          )}
        </Field>
      ) : (
        <input type="hidden" name="images" value="" />
      )}

      {needsUrl || optionalUrl ? (
        <Field
          label="URL"
          hint={optionalUrl ? "facultatif" : undefined}
          error={state.fieldErrors?.url}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              name="url"
              type="url"
              defaultValue={link?.url ?? ""}
              placeholder={type === "EMBED" ? "https://open.spotify.com/track/…" : "https://…"}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
      ) : (
        <input type="hidden" name="url" value="" />
      )}

      {type === "EMBED" ? (
        <p className="text-xs text-ink-500">
          Fournisseurs reconnus : Spotify, Apple Music, SoundCloud, YouTube, Twitch. Un autre lien
          reste affiché comme un bouton classique.
        </p>
      ) : null}

      {type === "TEXT" ? (
        <Field label="Contenu" error={state.fieldErrors?.body}>
          {({ id, describedBy, invalid }) => (
            <TextArea
              id={id}
              name="body"
              defaultValue={link?.body ?? ""}
              rows={3}
              maxLength={1000}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
      ) : null}

      {needsUrl ? (
        <div className="rounded-md bg-ink-900/60 p-3 ring-1 ring-inset ring-white/6">
          {mode === "edit" && link?.hasPassword && !changePassword ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-400">Ce lien est protégé par un mot de passe.</p>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setChangePassword(true)}>
                  Changer
                </Button>
                <Button type="submit" name="password" value="" variant="danger" size="sm">
                  Retirer
                </Button>
              </div>
            </div>
          ) : (
            <Field
              label="Mot de passe"
              hint={mode === "edit" ? "laisser vide pour ne pas changer" : "facultatif"}
            >
              {({ id }) => (
                <TextInput
                  id={id}
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  maxLength={72}
                  placeholder="Protéger l'accès à ce lien"
                />
              )}
            </Field>
          )}
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-critical-400">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <SubmitButton label={mode === "create" ? "Ajouter le bloc" : "Enregistrer"} />
        {mode === "edit" && onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            Annuler
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}
