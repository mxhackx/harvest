import { BRAND } from "@/lib/brand";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { SITE, jsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Connexion",
  description: `Connectez-vous à ${BRAND.name} avec Google, GitHub ou votre e-mail, ou créez votre compte pour suivre vos leads sur le terrain.`,
  path: "/login",
});

const structured = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE.name,
  description: SITE.description,
  url: SITE.url,
  inLanguage: "fr",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
};

export default function LoginPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
      <Suspense>
        <AuthCard />
      </Suspense>
    </>
  );
}
