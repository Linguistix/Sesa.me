"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction, type ActionState } from "@/actions/auth";
import { Field, TextInput } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const EMPTY: ActionState = {};

export function LoginForm() {
  const [state, formAction] = useActionState(signInAction, EMPTY);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <Field label="E-mail">
        {({ id }) => (
          <TextInput id={id} name="email" type="email" required autoComplete="email" autoFocus />
        )}
      </Field>

      <Field label="Mot de passe">
        {({ id }) => (
          <TextInput id={id} name="password" type="password" required autoComplete="current-password" />
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
      {pending ? "Connexion…" : "Se connecter"}
    </Button>
  );
}
