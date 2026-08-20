import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata = { title: "Créer un compte" };

export default async function SignupPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Créer votre page</h1>
      <p className="mt-1 text-sm text-neutral-400">Tous vos liens, une seule adresse.</p>

      <SignupForm />

      <p className="mt-6 text-sm text-neutral-400">
        Déjà inscrit ?{" "}
        <Link href="/login" className="text-indigo-400 underline-offset-4 hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
