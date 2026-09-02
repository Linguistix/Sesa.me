"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateFormAction } from "@/actions/forms";
import type { ActionState } from "@/actions/auth";
import type { FormField } from "@/lib/forms";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const EMPTY: ActionState = {};

const FIELD_TYPES = [
  { value: "text", label: "Texte" },
  { value: "email", label: "E-mail" },
  { value: "tel", label: "Téléphone" },
  { value: "textarea", label: "Message long" },
] as const;

export function FormEditor({
  form,
}: {
  form: {
    id: string;
    title: string;
    successMessage: string;
    webhookUrl: string | null;
    fields: FormField[];
  };
}) {
  const [state, formAction] = useActionState(updateFormAction, EMPTY);
  const [fields, setFields] = useState<FormField[]>(form.fields);
  const saved = state !== EMPTY && !state.error && !state.fieldErrors;

  function updateField(index: number, patch: Partial<FormField>) {
    setFields((current) => current.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function addField() {
    // The id is derived once and then fixed: it keys every stored submission,
    // so renaming a label must not orphan the answers already collected.
    const id = `champ_${Date.now().toString(36)}`;
    setFields((current) => [
      ...current,
      { id, label: "Nouveau champ", type: "text", required: false },
    ]);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="formId" value={form.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Titre du formulaire" error={state.fieldErrors?.title}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              name="title"
              defaultValue={form.title}
              maxLength={80}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>

        <Field label="Message de confirmation" error={state.fieldErrors?.successMessage}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              name="successMessage"
              defaultValue={form.successMessage}
              maxLength={300}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
      </div>

      <Field
        label="Webhook"
        hint="facultatif — Brevo, Mailchimp, Zapier…"
        error={state.fieldErrors?.webhookUrl}
      >
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            name="webhookUrl"
            type="url"
            defaultValue={form.webhookUrl ?? ""}
            placeholder="https://…"
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-medium text-ink-300">Champs</legend>

        {state.fieldErrors?.fields ? (
          <p role="alert" className="text-xs text-critical-400">
            {state.fieldErrors.fields}
          </p>
        ) : null}

        <ul className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <li
              key={field.id}
              className="flex flex-wrap items-end gap-2 rounded-lg p-2 ring-1 ring-inset ring-white/8"
            >
              <input type="hidden" name={`field.${index}.id`} value={field.id} />

              <label className="flex flex-1 flex-col gap-1">
                <span className="text-2xs text-ink-500">Libellé</span>
                <TextInput
                  name={`field.${index}.label`}
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  maxLength={80}
                />
              </label>

              <label className="flex flex-col gap-1 sm:w-40">
                <span className="text-2xs text-ink-500">Type</span>
                <Select
                  name={`field.${index}.type`}
                  value={field.type}
                  onChange={(e) =>
                    updateField(index, { type: e.target.value as FormField["type"] })
                  }
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="flex items-center gap-1.5 pb-2 text-xs text-ink-400">
                <input
                  type="checkbox"
                  name={`field.${index}.required`}
                  checked={field.required}
                  onChange={(e) => updateField(index, { required: e.target.checked })}
                  className="h-4 w-4 accent-[var(--color-accent-500)]"
                />
                Requis
              </label>

              <button
                type="button"
                onClick={() => setFields((current) => current.filter((_, i) => i !== index))}
                disabled={fields.length === 1}
                className="pb-2 text-xs text-critical-400 transition hover:text-critical-500 disabled:opacity-40"
                aria-label={`Retirer le champ ${field.label}`}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={addField}
          disabled={fields.length >= 12}
          className="self-start rounded-md px-3 py-1.5 text-xs text-ink-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/6 hover:text-ink-50 disabled:opacity-40"
        >
          Ajouter un champ
        </button>
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-critical-400">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <SaveButton />
        {saved ? (
          <span role="status" className="text-sm text-positive-400">
            Formulaire enregistré.
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
      {pending ? "Enregistrement…" : "Enregistrer le formulaire"}
    </Button>
  );
}
