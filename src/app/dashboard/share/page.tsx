import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEditablePage } from "@/server/pages";
import { SharePanel } from "@/components/dashboard/SharePanel";
import { appUrl } from "@/lib/urls";

export const metadata = { title: "Partager" };

export default async function SharePage() {
  const session = await auth();
  const page = await getEditablePage(session!.user.id);
  if (!page) redirect("/login");

  return (
    <>
      <h1 className="mb-6 text-lg font-semibold">Partager</h1>
      <SharePanel slug={page.slug} publicUrl={appUrl(`/${page.slug}`)} />
    </>
  );
}
