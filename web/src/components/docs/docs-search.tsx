"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { collectionOf, searchDocs, SECTIONS } from "@/lib/docs";
import { SearchIcon } from "../icons";

/** Recherche dans la documentation (titres et descriptions), raccourci Ctrl+K ou Cmd+K. Entièrement côté navigateur. */
export function DocsSearch({ large = false }: { large?: boolean }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const results = searchDocs(text);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const away = (e: MouseEvent) => root.current && !root.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", key);
    document.addEventListener("mousedown", away);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("mousedown", away);
    };
  }, []);

  return (
    <div ref={root} className={`relative w-full ${large ? "max-w-[560px]" : "max-w-[320px]"}`}>
      <label className={`flex items-center gap-2 rounded-full border border-border bg-field px-4 text-muted focus-within:border-ink ${large ? "h-12" : "h-9"}`}>
        <SearchIcon size={large ? 18 : 16} />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="docs-search-results"
          aria-label="Rechercher dans la documentation"
          placeholder="Rechercher…  Ctrl+K"
          value={text}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          className="min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-muted focus:outline-none"
        />
      </label>
      {open && text.trim().length >= 2 && (
        <div id="docs-search-results" role="listbox" aria-label="Résultats" className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[60vh] overflow-y-auto rounded-card border border-frame bg-card p-2">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-small text-muted">Aucun article pour « {text.trim()} ». Essayez un autre mot, ou écrivez-nous avec la bulle en bas de page.</p>
          ) : (
            results.map((p) => {
              const c = collectionOf(p.href);
              return (
                <Link key={p.href} href={p.href} onClick={() => setOpen(false)} className="flex flex-col rounded-control px-3 py-2 hover:bg-field">
                  <span className="font-medium">{p.title}</span>
                  <span className="text-small text-muted">{c ? `${SECTIONS[c.section].title} › ${c.title}` : "Documentation"}</span>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/** Recherche de l'en-tête : absente sur l'accueil de la documentation, qui a déjà la sienne en grand. */
export function HeaderSearch() {
  const path = usePathname();
  return path === "/docs" ? null : <DocsSearch />;
}
