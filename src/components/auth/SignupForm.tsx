"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { signUpAction, type ActionState } from "@/actions/auth";
import { Field, inputClass } from "@/components/dashboard/LinkForm";
import { slugify } from "@/lib/slug";
import { displayHost } from "@/lib/urls";

const EMPTY: ActionState = {};

export function SignupForm() {
  const [state, formAction] = useActionState(signUpAction, EMPTY);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <Field label="Nom affiché" error={state.fieldErrors?.displayName}>
        <input
          name="displayName"
          required
          maxLength={60}
          autoFocus
          placeholder="Camille Dupont"
          className={inputClass}
          onChange={(e) => {
            // Mirror the name into the slug until the user edits it themselves.
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
      </Field>

      <Field label="Votre lien" error={state.fieldErrors?.slug}>
        <div className="flex items-center rounded-lg border border-white/15 bg-black/25 focus-within:border-indigo-400">
          <span className="pl-3 text-sm text-neutral-500">{displayHost()}/</span>
          <input
            name="slug"
            required
            maxLength={32}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            className="w-full bg-transparent px-1 py-2 text-sm text-neutral-100 outline-none"
          />
        </div>
      </Field>

      <Field label="E-mail" error={state.fieldErrors?.email}>
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </Field>

      <Field label="Mot de passe" error={state.fieldErrors?.password} hint="8 caractères minimum">
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>

      {state.error ? (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
    >
      {pending ? "Création…" : "Créer ma page"}
    </button>
  );
}
