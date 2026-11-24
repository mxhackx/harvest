"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COLLECTIONS, SECTIONS, pagesOf, type DocSection } from "@/lib/docs";

/** Menu de la documentation : deux parties (usage, API), chacune avec ses collections et leurs articles. */
export function DocNav() {
  const path = usePathname();
  return (
    <nav aria-label="Sommaire de la documentation" className="flex flex-col gap-5">
      {(Object.keys(SECTIONS) as DocSection[]).map((section) => (
        <div key={section}>
          <p className="mb-2 px-2 text-small font-semibold uppercase tracking-wide text-muted">{SECTIONS[section].title}</p>
          <div className="flex flex-col gap-3">
            {COLLECTIONS.filter((c) => c.section === section).map((c) => (
              <div key={c.id}>
                <p className="px-2 text-small font-semibold">{c.title}</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {pagesOf(c).map((p) => (
                    <li key={p.href}>
                      <Link
                        href={p.href}
                        aria-current={p.href === path ? "page" : undefined}
                        className={`flex min-h-8 items-center rounded-control border px-2 text-small ${p.href === path ? "border-accent/25 bg-accent-soft font-medium" : "border-transparent text-muted hover:bg-field hover:text-ink"}`}
                      >
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
