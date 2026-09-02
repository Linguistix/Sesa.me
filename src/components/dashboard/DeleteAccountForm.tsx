"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteAccountAction } from "@/actions/account";
import type { ActionState } from "@/actions/auth";
import { Field, TextInput } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const EMPTY: ActionState = {};

export function DeleteAccountForm({ expected }: { expected: string }) {
  const [state, formAction] = useActionState(deleteAccountAction, EMPTY);
  const [confirmation, setConfirmation] = useState("");

  return (
    <form
      action={formAction}
      className="rounded-xl bg-critical-500/[0.04] p-4 ring-1 ring-inset ring-critical-500/25"
    >
      <input type="hidden" name="expected" value={expected} />

      <Field
        label={`Tapez « ${expected} » pour confirmer`}
        error={state.fieldErrors?.confirmation}
      >
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            name="confirmation"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>

      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-critical-400">
          {state.error}
        </p>
      ) : null}

      <DeleteButton disabled={confirmation !== expected} />
    </form>
  );
}

function DeleteButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="danger"
      disabled={disabled || pending}
      className="mt-3"
    >
      {pending ? "Suppression…" : "Supprimer définitivement mon compte"}
    </Button>
  );
}
