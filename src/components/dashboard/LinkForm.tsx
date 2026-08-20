"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createLinkAction, updateLinkAction } from "@/actions/page";
import type { ActionState } from "@/actions/auth";
import type { EditorLink } from "./types";

const EMPTY: ActionState = {};

const TYPE_OPTIONS = [
  { value: "LINK", label: "Lien" },
  { value: "SOCIAL", label: "Réseau social" },
  { value: "HEADING", label: "Titre de section" },
  { value: "TEXT", label: "Bloc de texte" },
] as const;

export function LinkForm({
  mode,
  link,
  onDone,
}: {
  mode: "create" | "edit";
  link?: EditorLink;
  onDone?: () => void;
}) {
  const action = mode === "create" ? createLinkAction : updateLinkAction;
  const [state, formAction] = useActionState(action, EMPTY);
  const [type, setType] = useState<EditorLink["type"]>(link?.type ?? "LINK");
  const [changePassword, setChangePassword] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const succeeded = state === EMPTY ? false : !state.error && !state.fieldErrors;

  useEffect(() => {
    if (!succeeded) return;
    if (mode === "create") formRef.current?.reset();
    onDone?.();
    // `state` identity changes on every action result, which is the signal here.
  }, [state, succeeded, mode, onDone]);

  const needsUrl = type === "LINK" || type === "SOCIAL";

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      {link ? <input type="hidden" name="linkId" value={link.id} /> : null}
      {link ? <input type="hidden" name="isActive" value={String(link.isActive)} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Field label="Type" className="sm:w-44">
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as EditorLink["type"])}
            className={inputClass}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Emoji" className="sm:w-24" hint="facultatif">
          <input name="emoji" defaultValue={link?.emoji ?? ""} maxLength={8} className={inputClass} />
        </Field>

        <Field label="Titre" error={state.fieldErrors?.title} className="flex-1">
          <input
            name="title"
            defaultValue={link?.title ?? ""}
            required
            maxLength={80}
            placeholder="Ma chaîne YouTube"
            className={inputClass}
            aria-invalid={Boolean(state.fieldErrors?.title)}
          />
        </Field>
      </div>

      {needsUrl ? (
        <Field label="URL" error={state.fieldErrors?.url}>
          <input
            name="url"
            type="url"
            defaultValue={link?.url ?? ""}
            placeholder="https://…"
            className={inputClass}
            aria-invalid={Boolean(state.fieldErrors?.url)}
          />
        </Field>
      ) : (
        <input type="hidden" name="url" value="" />
      )}

      {type === "TEXT" ? (
        <Field label="Contenu" error={state.fieldErrors?.body}>
          <textarea
            name="body"
            defaultValue={link?.body ?? ""}
            rows={3}
            maxLength={1000}
            className={inputClass}
          />
        </Field>
      ) : null}

      {needsUrl ? (
        <div className="rounded-lg border border-white/10 p-3">
          {mode === "edit" && link?.hasPassword && !changePassword ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-neutral-400">
                🔒 Ce lien est protégé par un mot de passe.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setChangePassword(true)}
                  className="rounded-md px-2 py-1 text-xs text-neutral-300 hover:bg-white/5"
                >
                  Changer
                </button>
                <button
                  type="submit"
                  name="password"
                  value=""
                  className="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                >
                  Retirer
                </button>
              </div>
            </div>
          ) : (
            <Field
              label="Mot de passe"
              hint={mode === "edit" ? "laisser vide pour ne pas changer" : "facultatif"}
            >
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                maxLength={72}
                placeholder="Protéger l'accès à ce lien"
                className={inputClass}
              />
            </Field>
          )}
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <SubmitButton label={mode === "create" ? "Ajouter le bloc" : "Enregistrer"} />
        {mode === "edit" && onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/5"
          >
            Annuler
          </button>
        ) : null}
      </div>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
    >
      {pending ? "…" : label}
    </button>
  );
}

export const inputClass =
  "w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-indigo-400";

export function Field({
  label,
  hint,
  error,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-neutral-400">
        {label}
        {hint ? <span className="ml-1 font-normal text-neutral-600">({hint})</span> : null}
      </span>
      {children}
      {error ? (
        <span role="alert" className="text-xs text-red-400">
          {error}
        </span>
      ) : null}
    </label>
  );
}
