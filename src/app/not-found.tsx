import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-5 text-center">
      <p aria-hidden className="text-4xl font-semibold tracking-tight text-ink-600">
        404
      </p>
      <h1 className="mt-3 text-xl font-semibold tracking-tight text-ink-50">
        Cette page n&apos;existe pas.
      </h1>
      <p className="mt-2 text-sm text-ink-400">
        Le lien est peut-être erroné, ou la page a été supprimée.
      </p>
      <ButtonLink href="/" variant="primary" className="mt-6">
        Retour à l&apos;accueil
      </ButtonLink>
    </div>
  );
}
