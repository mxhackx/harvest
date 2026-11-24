import { BRAND } from "@/lib/brand";
import Image from "next/image";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Hors connexion", description: `Vous n'avez pas de connexion : ${BRAND.name} réessaiera dès son retour.`, path: "/offline", index: false });

/** Page affichée quand on ouvre l'application sans réseau et sans copie en mémoire. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-4 px-6 text-center">
      <Image src="/logo.svg" alt="" width={56} height={56} />
      <h1 className="font-display text-heading font-bold">Vous êtes hors connexion</h1>
      <p className="text-muted">
        {BRAND.name} n’a pas encore de copie de cette page. Reconnectez-vous une fois : les pages que vous ouvrez ensuite
        restent lisibles sans réseau.
      </p>
      <a href="/dashboard" className="inline-flex h-11 items-center rounded-control bg-accent px-5 text-body font-medium text-white hover:bg-accent-hover">
        Réessayer
      </a>
    </main>
  );
}
