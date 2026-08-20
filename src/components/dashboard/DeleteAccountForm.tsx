"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteAccountAction } from "@/actions/account";
import type { ActionState } from "@/actions/auth";
import { Field, inputClass } from "./LinkForm";

const EMPTY: ActionState = {};

export function DeleteAccountForm({ expected }: { expected: string }) {
  const [state, formAction] = useActionState(deleteAccountAction, EMPTY);
  const [confirmation, setConfirmation] = useState("");

  return (
    <form
      action={formAction}
      className="rounded-xl border border-red-500/25 bg-red-500/[0.04] p-4"
    >
      <input type="hidden" name="expected" value={expected} />

      <Field
        label={`Tapez « ${expected} » pour confirmer`}
        error={state.fieldErrors?.confirmation}
      >
        <input
          name="confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
          className={inputClass}
          aria-invalid={Boolean(state.fieldErrors?.confirmation)}
        />
      </Field>

      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-red-400">
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
    <button
      type="submit"
      disabled={disabled || pending}
      className="mt-3 rounded-lg bg-red-500/90 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Suppression…" : "Supprimer définitivement mon compte"}
    </button>
  );
}
