import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata = { title: "Connexion" };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <AuthShell
      title="Connexion"
      subtitle="Content de vous revoir."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href="/signup" className="text-accent-400 underline-offset-4 hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
