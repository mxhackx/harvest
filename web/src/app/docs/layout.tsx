import { appHref } from "@/lib/hosts";
import { ROUTES } from "@/lib/routes";
import { BRAND } from "@/lib/brand";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ContactBubble } from "@/components/contact-bubble";
import { DocNav } from "@/components/docs/doc-nav";
import { HeaderSearch } from "@/components/docs/docs-search";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-card">
      <header className="sticky top-0 z-20 border-b border-rule bg-card">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-4 px-6">
          <Link href="/docs" className="flex shrink-0 items-center gap-3" aria-label={`Documentation ${BRAND.name}`}>
            <Image src="/logo.svg" alt="" width={26} height={26} />
            <span className="font-display text-brand font-semibold">{BRAND.name}</span>
            <span className="hidden text-small text-muted sm:inline">Centre d’aide</span>
          </Link>
          <nav aria-label="Parties de la documentation" className="ml-2 hidden items-center gap-5 text-small font-medium md:flex">
            <Link href="/docs#guide" className="hover:underline">Guide utilisateur</Link>
            <Link href="/docs#api" className="hover:underline">API et intégrations</Link>
          </nav>
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-4">
            <HeaderSearch />
            <Link href={appHref(ROUTES.home)} className="hidden shrink-0 text-small font-medium text-link underline decoration-dotted decoration-2 underline-offset-4 sm:inline">
              Ouvrir l&apos;application
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[1100px] flex-1 gap-10 px-6 py-8">
        <aside className="sticky top-20 hidden h-fit max-h-[calc(100dvh-6rem)] w-60 shrink-0 overflow-y-auto md:block">
          <DocNav />
        </aside>
        <div className="min-w-0 flex-1">
          <details className="mb-6 rounded-control border border-border p-2 md:hidden">
            <summary className="cursor-pointer text-small font-medium">Sommaire</summary>
            <div className="mt-2">
              <DocNav />
            </div>
          </details>
          <main className="max-w-3xl">{children}</main>
        </div>
      </div>
      <footer className="border-t border-rule bg-field">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-6 py-6 text-small text-muted">
          <span>© {BRAND.name}</span>
          <nav aria-label="Pied de page" className="flex gap-5">
            <Link href="/" className="hover:underline">Accueil</Link>
            <Link href="/docs" className="hover:underline">Documentation</Link>
            <Link href={appHref(ROUTES.home)} className="hover:underline">Application</Link>
          </nav>
        </div>
      </footer>
      <ContactBubble />
    </div>
  );
}
