"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { attachDomainAction, detachDomainAction, verifyDomainAction } from "@/actions/domain";
import type { ActionState } from "@/actions/auth";
import { Field, inputClass } from "./LinkForm";

const EMPTY: ActionState = {};

export function DomainForm({
  txtRecordName,
  domain,
}: {
  txtRecordName: string;
  domain: { hostname: string; token: string; verified: boolean } | null;
}) {
  const [state, formAction] = useActionState(attachDomainAction, EMPTY);
  const [pending, startTransition] = useTransition();
  const [verifyError, setVerifyError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <Field label="Votre domaine" error={state.fieldErrors?.hostname}>
          <input
            name="hostname"
            defaultValue={domain?.hostname ?? ""}
            placeholder="liens.mon-site.fr"
            className={inputClass}
            aria-invalid={Boolean(state.fieldErrors?.hostname)}
          />
        </Field>
        <SaveButton label={domain ? "Changer de domaine" : "Ajouter le domaine"} />
      </form>

      {domain ? (
        <section
          aria-labelledby="verify-heading"
          className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="verify-heading" className="text-sm font-medium text-neutral-200">
              Vérification
            </h2>
            <span
              className={[
                "rounded-full px-2 py-0.5 text-xs",
                domain.verified
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-amber-500/15 text-amber-300",
              ].join(" ")}
            >
              {domain.verified ? "Vérifié" : "En attente"}
            </span>
          </div>

          <p className="text-sm text-neutral-400">
            Ajoutez cet enregistrement TXT chez votre hébergeur DNS, puis lancez la
            vérification. Tant que le domaine n&apos;est pas vérifié, il ne sert pas votre page.
          </p>

          <dl className="mt-3 grid gap-2 rounded-lg border border-white/10 bg-black/25 p-3 text-xs">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-neutral-500">Type</dt>
              <dd className="text-neutral-200">TXT</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-neutral-500">Nom</dt>
              <dd className="break-all font-mono text-neutral-200">
                {txtRecordName}.{domain.hostname}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-neutral-500">Valeur</dt>
              <dd className="break-all font-mono text-neutral-200">{domain.token}</dd>
            </div>
          </dl>

          <p className="mt-3 text-sm text-neutral-400">
            Pointez ensuite votre domaine vers Sesame avec un enregistrement CNAME.
          </p>

          {verifyError ? (
            <p role="alert" className="mt-3 text-sm text-red-400">
              {verifyError}
            </p>
          ) : null}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setVerifyError(null);
                  const result = await verifyDomainAction();
                  if (result.error) setVerifyError(result.error);
                })
              }
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {pending ? "Vérification…" : "Vérifier maintenant"}
            </button>

            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await detachDomainAction();
                })
              }
              className="rounded-lg px-3 py-2 text-sm text-red-400 transition hover:bg-red-500/10"
            >
              Retirer
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-3 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
    >
      {pending ? "…" : label}
    </button>
  );
}
