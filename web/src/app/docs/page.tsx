import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { DocsSearch } from "@/components/docs/docs-search";
import { COLLECTIONS, SECTIONS, pagesOf, type DocSection } from "@/lib/docs";
import { docMetadata } from "@/lib/seo";

export const metadata = docMetadata("/docs");

/** Accueil du centre d'aide : une recherche en grand, puis les deux parties (usage, API) et leurs collections. */
export default function Page() {
  return (
    <div>
      <section className="rounded-card bg-field px-6 py-10 text-center">
        <h1 className="font-display text-heading font-bold tracking-display">Comment peut-on vous aider ?</h1>
        <p className="mx-auto mt-2 max-w-[520px] text-muted">
          Tout ce qu’il faut pour prospecter par vagues avec {BRAND.name}, et pour le brancher à vos autres outils.
        </p>
        <div className="mt-6 flex justify-center">
          <DocsSearch large />
        </div>
      </section>

      {(Object.keys(SECTIONS) as DocSection[]).map((section) => (
        <section key={section} id={section} aria-labelledby={`${section}-title`} className="mt-10 scroll-mt-20">
          <h2 id={`${section}-title`} className="font-display text-title font-semibold">{SECTIONS[section].title}</h2>
          <p className="text-small text-muted">{SECTIONS[section].description}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {COLLECTIONS.filter((c) => c.section === section).map((c) => (
              <article key={c.id} id={c.id} className="scroll-mt-20 rounded-card border border-border bg-card p-5">
                <h3 className="font-semibold">{c.title}</h3>
                <p className="mb-3 text-small text-muted">
                  {c.description} · {c.hrefs.length} article{c.hrefs.length > 1 ? "s" : ""}
                </p>
                <ul className="flex flex-col gap-1.5 text-small">
                  {pagesOf(c).map((p) => (
                    <li key={p.href}>
                      <Link href={p.href} className="font-medium text-link underline decoration-dotted decoration-2 underline-offset-4">
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
