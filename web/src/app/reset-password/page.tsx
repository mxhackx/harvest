import { BRAND } from "@/lib/brand";
import { Suspense } from "react";
import { ResetPasswordPage } from "@/components/password-reset";
import { pageMetadata } from "@/lib/seo";

// Lien personnel : jamais indexé.
export const metadata = pageMetadata({ title: "Nouveau mot de passe", description: `Choisissez un nouveau mot de passe ${BRAND.name}.`, path: "/reset-password", index: false });

export default function Page() {
  return (
    <Suspense>
      <ResetPasswordPage />
    </Suspense>
  );
}
