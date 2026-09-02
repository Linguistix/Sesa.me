"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { attachDomainAction, detachDomainAction, verifyDomainAction } from "@/actions/domain";
import type { ActionState } from "@/actions/auth";
import { Field, TextInput } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge, Panel, SectionHeader } from "@/components/ui/Panel";

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
    <div className="flex flex-col gap-5">
      <Panel className="p-5">
        <form action={formAction}>
          <Field label="Votre domaine" error={state.fieldErrors?.hostname}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                name="hostname"
                defaultValue={domain?.hostname ?? ""}
                placeholder="liens.mon-site.fr"
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>
          <SaveButton label={domain ? "Changer de domaine" : "Ajouter le domaine"} />
        </form>
      </Panel>

      {domain ? (
        <Panel className="p-5" aria-labelledby="verify-heading">
          <SectionHeader
            id="verify-heading"
            title="Vérification"
            description="Ajoutez cet enregistrement TXT chez votre hébergeur DNS, puis lancez la vérification. Tant que le domaine n'est pas vérifié, il ne sert pas votre page."
            action={
              <Badge tone={domain.verified ? "positive" : "caution"}>
                {domain.verified ? "Vérifié" : "En attente"}
              </Badge>
            }
          />

          {/*
            Monospace and generous breaking: every character here has to be
            copied exactly into a DNS panel, and a token that wraps mid-word
            with no visual seam is a token someone will mistype.
          */}
          <dl className="grid gap-2.5 rounded-lg bg-ink-950 p-3.5 text-xs ring-1 ring-inset ring-white/6">
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-ink-400">Type</dt>
              <dd className="font-mono text-ink-100">TXT</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-ink-400">Nom</dt>
              <dd className="break-all font-mono text-ink-100">
                {txtRecordName}.{domain.hostname}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-ink-400">Valeur</dt>
              <dd className="break-all font-mono text-ink-100">{domain.token}</dd>
            </div>
          </dl>

          <p className="mt-3 text-sm text-ink-400">
            Pointez ensuite votre domaine vers Sesame avec un enregistrement CNAME.
          </p>

          {verifyError ? (
            <p role="alert" className="mt-3 text-sm text-critical-400">
              {verifyError}
            </p>
          ) : null}

          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setVerifyError(null);
                  const result = await verifyDomainAction();
                  if (result.error) setVerifyError(result.error);
                })
              }
            >
              {pending ? "Vérification…" : "Vérifier maintenant"}
            </Button>

            <Button
              type="button"
              variant="danger"
              onClick={() =>
                startTransition(async () => {
                  await detachDomainAction();
                })
              }
            >
              Retirer
            </Button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending} className="mt-3">
      {pending ? "Enregistrement…" : label}
    </Button>
  );
}
