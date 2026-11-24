import { BRAND } from "@/lib/brand";
import { ForgotPasswordPage } from "@/components/password-reset";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Mot de passe oublié", description: `Recevez un lien pour choisir un nouveau mot de passe ${BRAND.name}.`, path: "/forgot-password", index: false });

export default function Page() {
  return <ForgotPasswordPage />;
}
