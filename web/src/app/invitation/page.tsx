import { BRAND } from "@/lib/brand";
import { Suspense } from "react";
import { InvitationPage } from "@/components/invitation-page";
import { pageMetadata } from "@/lib/seo";

// Lien personnel : jamais indexé.
export const metadata = pageMetadata({
  title: "Invitation",
  description: `Rejoignez une entreprise sur ${BRAND.name}.`,
  path: "/invitation",
  index: false,
});

export default function Page() {
  return (
    <Suspense>
      <InvitationPage />
    </Suspense>
  );
}
