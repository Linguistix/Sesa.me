"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { signUpAction, type ActionState } from "@/actions/auth";
import { Field, TextInput, inputClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
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
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            name="displayName"
            required
            maxLength={60}
            autoFocus
            placeholder="Camille Dupont"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            onChange={(e) => {
              // Mirror the name into the slug until the user edits it themselves.
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
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
              required
              maxLength={32}
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-base text-ink-50 outline-none"
            />
          </div>
        )}
      </Field>

      <Field label="E-mail" error={state.fieldErrors?.email}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>

      <Field label="Mot de passe" error={state.fieldErrors?.password} hint="8 caractères minimum">
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
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

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full">
      {pending ? "Création…" : "Créer ma page"}
    </Button>
  );
}
