import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Connexion" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
      <p className="mt-1 text-sm text-neutral-400">Content de vous revoir.</p>

      <LoginForm />

      <p className="mt-6 text-sm text-neutral-400">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="text-indigo-400 underline-offset-4 hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
