"use client";

import { useState } from "react";
import type { FormField } from "@/lib/forms";
import { translator } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/config";

/**
 * A contact or newsletter form on a public page.
 *
 * Submits to the API rather than a server action, because a public page is
 * statically cached and has no per-visitor server context to act in.
 */
export function FormBlock({
  formId,
  title,
  fields,
  locale,
}: {
  formId: string;
  title: string;
  fields: FormField[];
  locale: Locale;
}) {
  const t = translator(locale);
  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await fetch(`/api/forms/${formId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const body = await response.json();

      if (response.ok && body.ok) {
        setSuccess(body.message as string);
        setValues({});
        return;
      }

      if (body.fieldErrors) setFieldErrors(body.fieldErrors as Record<string, string>);
      else setError((body.error as string) ?? t("form.error"));
    } catch {
      setError(t("form.error"));
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <p
        role="status"
        className="w-full px-5 py-4 text-center text-sm"
        style={{
          background: "var(--sesame-surface)",
          color: "var(--sesame-text)",
          borderRadius: "var(--sesame-radius)",
        }}
      >
        {success}
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full flex-col gap-3 p-4 text-left"
      style={{ background: "var(--sesame-surface)", borderRadius: "var(--sesame-radius)" }}
    >
      <h2
        className="text-sm font-semibold"
        style={{ color: "var(--sesame-text)", fontFamily: "var(--sesame-font-display)" }}
      >
        {title}
      </h2>

      {fields.map((field) => {
        const inputId = `${formId}-${field.id}`;
        const errorId = `${inputId}-error`;
        const shared = {
          id: inputId,
          name: field.id,
          required: field.required,
          placeholder: field.placeholder,
          value: values[field.id] ?? "",
          "aria-invalid": Boolean(fieldErrors[field.id]),
          "aria-describedby": fieldErrors[field.id] ? errorId : undefined,
          onChange: (
            e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
          ) => setValues((v) => ({ ...v, [field.id]: e.target.value })),
          className:
            "w-full rounded-lg border border-current/20 bg-black/10 px-3 py-2 text-sm outline-none focus:border-current/50",
          style: { color: "var(--sesame-text)" },
        };

        return (
          <div key={field.id} className="flex flex-col gap-1">
            <label
              htmlFor={inputId}
              className="text-xs"
              style={{ color: "var(--sesame-muted)" }}
            >
              {field.label}
              {field.required ? <span aria-hidden> *</span> : null}
            </label>

            {field.type === "textarea" ? (
              <textarea {...shared} rows={3} />
            ) : (
              <input {...shared} type={field.type === "tel" ? "tel" : field.type} />
            )}

            {fieldErrors[field.id] ? (
              <span id={errorId} role="alert" className="text-xs text-[var(--sesame-critical)]">
                {fieldErrors[field.id]}
              </span>
            ) : null}
          </div>
        );
      })}

      {error ? (
        <p role="alert" className="text-xs text-[var(--sesame-critical)]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        style={{
          background: "var(--sesame-accent)",
          color: "var(--sesame-btn-text)",
          borderRadius: "var(--sesame-radius)",
        }}
      >
        {pending ? t("form.sending") : t("form.send")}
      </button>
    </form>
  );
}
