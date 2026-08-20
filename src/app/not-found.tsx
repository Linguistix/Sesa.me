import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-5 text-center">
      <p className="text-5xl font-semibold tracking-tight">404</p>
      <h1 className="mt-3 text-lg font-medium">Cette page n&apos;existe pas.</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Le lien est peut-être erroné, ou la page a été supprimée.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
