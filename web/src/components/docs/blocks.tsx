import Link from "next/link";
import type { ReactNode } from "react";
import { DOCS, findDoc, flattenDocs } from "@/lib/docs";
import { SITE, jsonLd } from "@/lib/seo";
import { CopyButton } from "./copy-button";

/** Bloc de code sur surface creusée, avec bouton pour copier. */
export function CodeBlock({ code, lang, label }: { code: string; lang: string; label?: string }) {
  return (
    <figure className="my-4 overflow-hidden rounded-control border border-border bg-field">
      <figcaption className="flex items-center justify-between gap-3 border-b border-rule px-3 py-2">
        <span className="font-mono text-small text-muted">{label ?? lang}</span>
        <CopyButton text={code} />
      </figcaption>
      <pre className="overflow-x-auto p-3 font-mono text-small leading-relaxed">
        <code>{code}</code>
      </pre>
    </figure>
  );
}

/** Encadré d'information, dans le style des messages de l'application. */
export function Callout({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <aside className="my-4 rounded-control border border-banner-edge bg-banner p-3 text-small">
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children}
    </aside>
  );
}

/** Gabarit d'une page de documentation : fil d'Ariane, titre, introduction, précédent / suivant, données structurées. */
export function DocArticle({ href, children }: { href: string; children: ReactNode }) {
  const page = findDoc(href)!;
  const parent = DOCS.find((p) => p.children?.some((c) => c.href === href));
  const trail = [{ title: "Documentation", href: "/docs" }, ...(parent ? [{ title: parent.title, href: parent.href }] : []), ...(href === "/docs" ? [] : [{ title: page.title, href }])];
  const all = flattenDocs();
  const i = all.findIndex((p) => p.href === href);
  const prev = all[i - 1];
  const next = all[i + 1];

  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: trail.map((t, n) => ({ "@type": "ListItem", position: n + 1, name: t.title, item: `${SITE.url}${t.href}` })),
    },
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: page.title,
      description: page.description,
      inLanguage: "fr",
      url: `${SITE.url}${href}`,
      isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE.url },
    },
  ];

  return (
    <article className="doc">
      {structured.map((d, n) => (
        <script key={n} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(d) }} />
      ))}
      <nav aria-label="Fil d'Ariane" className="mb-4 flex flex-wrap items-center gap-2 text-small text-muted">
        {trail.map((t, n) => (
          <span key={t.href} className="flex items-center gap-2">
            {n > 0 && <span aria-hidden>›</span>}
            {n === trail.length - 1 ? (
              <span className="font-medium text-ink" aria-current="page">
                {t.title}
              </span>
            ) : (
              <Link href={t.href} className="!font-normal !text-muted">
                {t.title}
              </Link>
            )}
          </span>
        ))}
      </nav>
      <h1 className="font-serif text-title font-semibold">{page.title}</h1>
      <p className="text-muted">{page.description}</p>
      {children}
      <nav aria-label="Pages voisines" className="mt-10 flex flex-wrap justify-between gap-3 border-t border-rule pt-4 text-small">
        {prev ? (
          <Link href={prev.href} rel="prev">
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={next.href} rel="next">
            {next.title} →
          </Link>
        )}
      </nav>
    </article>
  );
}
