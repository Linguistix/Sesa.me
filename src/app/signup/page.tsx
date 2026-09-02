import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignupForm } from "@/components/auth/SignupForm";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata = { title: "Créer un compte" };

export default async function SignupPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <AuthShell
      title="Créer votre page"
      subtitle="Tous vos liens, une seule adresse."
      footer={
        <>
          Déjà inscrit ?{" "}
          <Link href="/login" className="text-accent-400 underline-offset-4 hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
