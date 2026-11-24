import { BRAND } from "@/lib/brand";
import { Onboarding } from "@/components/onboarding";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Créer votre entreprise",
  description: `Créez l’espace de travail de votre entreprise sur ${BRAND.name}.`,
  path: "/onboarding",
  index: false,
});

export default function OnboardingPage() {
  return <Onboarding />;
}
