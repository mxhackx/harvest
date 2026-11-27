"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getActiveCompanyId, withActiveFirst } from "@/lib/active-company";
import { BRAND } from "@/lib/brand";
import { TEMPLATES, insert, loadSites, newSite, saveSites, walk, type Site } from "@/lib/cms/model";
import { parseNode, type Component } from "@/lib/cms/library";
import { Gallery } from "./gallery";
import { useCatalog } from "./library-panel";
import { rootVariables } from "@/lib/cms/style";
import { appHref } from "@/lib/hosts";
import { ROUTES } from "@/lib/routes";
import { useMe } from "@/lib/use-me";
import { PlusIcon, TrashIcon } from "../icons";
import { Button, Notice } from "../ui";
import { Studio } from "./studio";

/** Application CMS, à part de l'application principale : la liste des sites, puis l'éditeur. Réservée au CEO. */
export function CmsApp() {
  const router = useRouter();
  const s = useMe();
  const memberships = s.status === "ready" ? withActiveFirst(s.me.memberships, getActiveCompanyId()) : [];
  const companyId = memberships[0]?.company.id;
  const allowed = !!memberships[0]?.permissions.some((p) => p.permission === "company:update");

  useEffect(() => {
    if (s.status === "unauthenticated") router.replace("/login");
  }, [s.status, router]);

  if (s.status === "error") return <main className="grid min-h-dvh place-items-center p-6"><Notice>Impossible de joindre le serveur.</Notice></main>;
  if (s.status !== "ready" || !companyId) return <main className="min-h-dvh" aria-busy />;
  if (!allowed) return <main className="grid min-h-dvh place-items-center p-6 text-small text-muted">Le CMS est réservé au CEO de l’entreprise.</main>;
  return <Sites key={companyId} companyId={companyId} />;
}

function Sites({ companyId }: { companyId: string }) {
  // monté seulement après la lecture de la session, donc dans le navigateur
  const [sites, setSites] = useState<Site[]>(() => loadSites(companyId));
  const [openId, setOpenId] = useState<string | null>(() => window.location.hash.slice(1) || null);
  const [saved, setSaved] = useState(true);
  // « Ajouter à Hivation » depuis la marketplace : /cms?add=<composant>, posé après confirmation dans le site ouvert
  const [pending, setPending] = useState<string | null>(() => /^[a-z0-9-]{1,60}$/.exec(new URLSearchParams(window.location.search).get("add") ?? "")?.[0] ?? null);
  const donePending = () => {
    setPending(null);
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  };

  const store = useCallback((next: (list: Site[]) => Site[]) => {
    setSites((list) => {
      const updated = next(list);
      setSaved(saveSites(companyId, updated));
      return updated;
    });
  }, [companyId]);
  const open = (id: string | null) => {
    window.history.replaceState(null, "", window.location.pathname + window.location.search + (id ? `#${id}` : ""));
    setOpenId(id);
  };
  const [template, setTemplate] = useState("restaurant");
  const [section, setSection] = useState<"sites" | "components">("sites");
  const create = () => {
    const site = newSite(`Site ${sites.length + 1}`, template);
    store((list) => [...list, site]);
    open(site.id);
  };
  const current = sites.find((x) => x.id === openId);
  const change = useCallback((site: Site) => store((list) => list.map((x) => (x.id === site.id ? site : x))), [store]);

  if (current) return <Studio key={current.id} site={current} saved={saved} onChange={change} onBack={() => open(null)} pending={pending} onPendingDone={donePending} />;
  return (
    <div className="min-h-dvh bg-field">
      <header className="flex h-14 items-center justify-between border-b border-rule bg-card px-6">
        <span className="flex items-center gap-2 font-display text-lead font-semibold">
          <Image src="/logo.svg" alt="" width={26} height={26} />
          {BRAND.name} · Sites
        </span>
        <Link href={appHref(ROUTES.home)} className="text-small text-link underline">Ouvrir l’application</Link>
      </header>
      <div role="tablist" className="mx-auto flex max-w-[1180px] gap-1 px-6 pt-4">
        {([["sites", "Mes sites"], ["components", "Composants"]] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={section === key} onClick={() => setSection(key)} className={`h-9 rounded-control px-4 text-small font-medium ${section === key ? "bg-card text-ink" : "text-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>
      {section === "components" ? (
        <ComponentsSection
          sites={sites}
          onAdd={(component, siteId) => {
            const node = parseNode(component.node);
            if (!node) return;
            // dans le site choisi (première page), ou un nouveau site
            const target = sites.find((x) => x.id === siteId) ?? newSite(`Site ${sites.length + 1}`, template);
            const [first, ...rest] = target.pages;
            const updated = { ...target, pages: [{ ...first, root: insert(first.root, null, node) }, ...rest], updatedAt: new Date().toISOString() };
            store((list) => (list.some((x) => x.id === updated.id) ? list.map((x) => (x.id === updated.id ? updated : x)) : [...list, updated]));
            open(updated.id);
          }}
        />
      ) : (
      <main className="mx-auto max-w-[1080px] p-6">
        {pending && <p className="mb-4 rounded-control bg-accent-soft px-3 py-2 text-small">Ouvrez ou créez un site pour y poser le composant choisi.</p>}
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-title font-semibold">Mes sites</h1>
          <div className="flex items-center gap-2">
            <select aria-label="Modèle de départ" value={template} onChange={(e) => setTemplate(e.target.value)} className="h-9 rounded-control border border-border bg-card px-2 text-small">
              {Object.entries(TEMPLATES).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
            </select>
            <Button className="h-9 w-auto" onClick={create}><PlusIcon size={16} /> Nouveau site</Button>
          </div>
        </div>
        <p className="mt-1 text-small text-muted">Les sites restent sur cet appareil. Exportez le code pour les héberger.</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <li key={site.id} className="overflow-hidden rounded-card border border-border bg-card">
              <button type="button" onClick={() => open(site.id)} aria-label={`Ouvrir ${site.name}`} className="block h-36 w-full p-4 text-left" style={{ ...rootVariables(site), background: "var(--fond)", color: "var(--texte)" }}>
                <span className="block text-lead font-bold">{walk(site.pages[0].root).find((n) => n.textStyle === "h1")?.text || site.name}</span>
                <span className="mt-3 block h-2 w-24 rounded-full bg-[var(--accent)]" />
              </button>
              <div className="flex items-center justify-between gap-2 border-t border-rule px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-small font-semibold">{site.name}</span>
                  <span className="text-caption text-muted">Brouillon · {new Date(site.updatedAt).toLocaleDateString("fr-FR")}</span>
                </span>
                <button type="button" aria-label={`Supprimer ${site.name}`} onClick={() => window.confirm(`Supprimer « ${site.name} » ?`) && store((list) => list.filter((x) => x.id !== site.id))} className="flex size-8 items-center justify-center rounded-full text-muted hover:text-fail">
                  <TrashIcon size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </main>
      )}
    </div>
  );
}

/** Section « Composants » : la galerie, aux couleurs du site où l'on va poser. */
function ComponentsSection({ sites, onAdd }: { sites: Site[]; onAdd: (component: Component, siteId: string) => void }) {
  const catalog = useCatalog();
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  // thème « Clair » tant qu'aucun site n'est choisi
  const [sample] = useState(() => newSite("Aperçu", "boutique"));
  return (
    <main className="mx-auto max-w-[1180px] p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-title font-semibold">Composants</h1>
        <label className="flex items-center gap-2 text-small">
          Ajouter dans
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="h-9 rounded-control border border-border bg-card px-2 text-small">
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="">Un nouveau site</option>
          </select>
        </label>
      </div>
      <Gallery catalog={catalog} site={sites.find((s) => s.id === siteId) ?? sample} addLabel="Ajouter" onAdd={(c) => onAdd(c, siteId)} />
    </main>
  );
}
