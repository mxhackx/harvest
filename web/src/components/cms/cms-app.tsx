"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getActiveCompanyId, withActiveFirst } from "@/lib/active-company";
import { BRAND } from "@/lib/brand";
import { TEMPLATES, loadSites, newSite, saveSites, type Site, type TemplateId } from "@/lib/cms/site";
import { appHref } from "@/lib/hosts";
import { ROUTES } from "@/lib/routes";
import { useMe } from "@/lib/use-me";
import { PlusIcon, TrashIcon } from "../icons";
import { Button, Notice } from "../ui";
import { themeStyle } from "./preview";
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

  const store = useCallback((next: (list: Site[]) => Site[]) => {
    setSites((list) => {
      const updated = next(list);
      setSaved(saveSites(companyId, updated));
      return updated;
    });
  }, [companyId]);
  const open = (id: string | null) => {
    window.history.replaceState(null, "", id ? `#${id}` : window.location.pathname);
    setOpenId(id);
  };
  const [template, setTemplate] = useState<TemplateId>("restaurant");
  const create = () => {
    const site = newSite(`Site ${sites.length + 1}`, template);
    store((list) => [...list, site]);
    open(site.id);
  };
  const current = sites.find((x) => x.id === openId);
  const change = useCallback((site: Site) => store((list) => list.map((x) => (x.id === site.id ? site : x))), [store]);

  if (current) return <Studio key={current.id} site={current} saved={saved} onChange={change} onBack={() => open(null)} />;
  return (
    <div className="min-h-dvh bg-field">
      <header className="flex h-14 items-center justify-between border-b border-rule bg-card px-6">
        <span className="flex items-center gap-2 font-display text-lead font-semibold">
          <Image src="/logo.svg" alt="" width={26} height={26} />
          {BRAND.name} · Sites
        </span>
        <Link href={appHref(ROUTES.home)} className="text-small text-link underline">Ouvrir l’application</Link>
      </header>
      <main className="mx-auto max-w-[1080px] p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-title font-semibold">Mes sites</h1>
          <div className="flex items-center gap-2">
            <select aria-label="Modèle de départ" value={template} onChange={(e) => setTemplate(e.target.value as TemplateId)} className="h-9 rounded-control border border-border bg-card px-2 text-small">
              {Object.entries(TEMPLATES).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
            </select>
            <Button className="h-9 w-auto" onClick={create}><PlusIcon size={16} /> Nouveau site</Button>
          </div>
        </div>
        <p className="mt-1 text-small text-muted">Première version de l’éditeur : les sites restent sur cet appareil et ne sont pas encore publiables.</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <li key={site.id} className="overflow-hidden rounded-card border border-border bg-card">
              <button type="button" onClick={() => open(site.id)} aria-label={`Ouvrir ${site.name}`} className="block h-36 w-full p-4 text-left" style={themeStyle(site.theme)}>
                <span className="block text-lead font-bold">{site.blocks.find((b) => b.type === "hero")?.title || site.name}</span>
                <span className="mt-3 block h-2 w-24 rounded-full bg-[var(--s-accent)]" />
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
    </div>
  );
}
