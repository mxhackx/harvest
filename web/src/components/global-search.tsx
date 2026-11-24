"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { cleanQuery, isEmpty, type SearchResults } from "@/lib/search";
import { useSession } from "@/lib/session";
import { SearchIcon } from "./icons";

/** Recherche dans toute l'application : leads, contacts, tâches. Raccourci Ctrl+K (ou Cmd+K). */
export function GlobalSearch() {
  const { companyId } = useSession();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

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

  // 250 ms après la dernière frappe ; une réponse qui arrive après une nouvelle frappe est jetée
  const q = cleanQuery(text);
  useEffect(() => {
    if (!q) return;
    let stale = false;
    const t = setTimeout(() => {
      api<SearchResults>(`/search?q=${encodeURIComponent(q)}`, { companyId })
        .then((r) => !stale && setResults(r))
        .catch(() => !stale && setResults({ leads: [], contacts: [], tasks: [] }));
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q, companyId]);

  const shown = q ? results : null;
  const close = () => {
    setOpen(false);
    setText("");
  };
  const item = "flex flex-col rounded-control px-3 py-2 text-body hover:bg-field";

  return (
    <div ref={root} className="relative w-full max-w-[360px]">
      <label className="flex h-9 items-center gap-2 rounded-full border border-border bg-field px-3 text-muted focus-within:border-ink">
        <SearchIcon size={16} />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={open && !!q}
          aria-controls="global-search-results"
          aria-label="Rechercher dans Hivation"
          placeholder="Rechercher… (Ctrl+K)"
          value={text}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          className="min-w-0 flex-1 bg-transparent text-small text-ink placeholder:text-muted focus:outline-none"
        />
      </label>
      {open && q && (
        <div id="global-search-results" role="listbox" aria-label="Résultats" className="absolute left-0 right-0 top-11 z-30 max-h-[70vh] overflow-y-auto rounded-card border border-frame bg-card p-2">
          {shown === null ? (
            <p className="px-3 py-2 text-small text-muted">Recherche…</p>
          ) : isEmpty(shown) ? (
            <p className="px-3 py-2 text-small text-muted">Aucun résultat pour « {q} ».</p>
          ) : (
            <>
              {shown.leads.length > 0 && <p className="px-3 pt-1 text-small uppercase tracking-wide text-muted">Leads</p>}
              {shown.leads.map((l) => (
                <Link key={l.id} href={ROUTES.lead(l.id)} onClick={close} className={item}>
                  <span className="font-medium">{l.name}</span>
                  <span className="text-small text-muted">{[l.sector, l.city].filter(Boolean).join(" · ")}</span>
                </Link>
              ))}
              {shown.contacts.length > 0 && <p className="px-3 pt-2 text-small uppercase tracking-wide text-muted">Contacts</p>}
              {shown.contacts.map((c) => (
                <Link key={c.id} href={ROUTES.lead(c.leadId)} onClick={close} className={item}>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-small text-muted">{[c.leadName, c.email || c.phone].filter(Boolean).join(" · ")}</span>
                </Link>
              ))}
              {shown.tasks.length > 0 && <p className="px-3 pt-2 text-small uppercase tracking-wide text-muted">Tâches</p>}
              {shown.tasks.map((t) => (
                <Link key={t.id} href={t.leadId ? ROUTES.lead(t.leadId) : ROUTES.tasks} onClick={close} className={item}>
                  <span className="font-medium">{t.title}</span>
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
