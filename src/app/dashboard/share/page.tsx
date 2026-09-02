import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEditablePage } from "@/server/pages";
import { SharePanel } from "@/components/dashboard/SharePanel";
import { appUrl } from "@/lib/urls";
import { PageHeader, PageBody } from "@/components/ui/Panel";

export const metadata = { title: "Partager" };

export default async function SharePage() {
  const session = await auth();
  const page = await getEditablePage(session!.user.id);
  if (!page) redirect("/login");

  return (
    <PageBody width="wide">
      <PageHeader
        title="Partager"
        description="Le lien à coller dans votre bio, et un QR code pour tout ce qui s'imprime."
      />
      <SharePanel slug={page.slug} publicUrl={appUrl(`/${page.slug}`)} />
    </PageBody>
  );
}
