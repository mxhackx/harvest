import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { DocNav } from "@/components/docs/doc-nav";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-card">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-rule bg-card px-6">
        <Link href="/docs" className="flex items-center gap-3" aria-label="Documentation Harvest">
          <Image src="/logo.png" alt="" width={24} height={28} />
          <span className="font-serif text-brand font-semibold">Harvest</span>
          <span className="text-small text-muted">Documentation</span>
        </Link>
        <Link href="/" className="text-small font-medium text-link underline decoration-dotted decoration-2 underline-offset-4">
          Ouvrir l&apos;application
        </Link>
      </header>
      <div className="mx-auto flex max-w-[1100px] gap-10 px-6 py-8">
        <aside className="sticky top-20 hidden h-fit w-60 shrink-0 md:block">
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
    </div>
  );
}
