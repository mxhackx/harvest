"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { TEMPLATES, insert, newSite, walk, type Site } from "@/lib/cms/model";
import { parseNode, type Component } from "@/lib/cms/library";
import { createSaver, createSite, deleteSite, legacyDrafts, listSites, putSite, toSite, type SaveStatus } from "@/lib/cms/remote";
import { appHref } from "@/lib/hosts";
import { ROUTES } from "@/lib/routes";
import { useMe } from "@/lib/use-me";
import { PlusIcon, TrashIcon } from "../icons";
import { Button, Notice } from "../ui";
import { rootVariables } from "@/lib/cms/style";
import { CmsLogin, ContinueWithHivation } from "./cms-login";
import { Gallery } from "./gallery";
import { useCatalog } from "./library-panel";
import { Studio } from "./studio";

/** Le CMS, un produit à part : sa connexion, son espace par personne, ses sites. */
export function CmsApp() {
  const s = useMe();
  const [activated, setActivated] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const ready = s.status === "ready";
  useEffect(() => {
    if (ready) api<{ activated: boolean }>("/cms/account").then((a) => setActivated(a.activated)).catch(() => setFailed(true));
  }, [ready]);

  if (s.status === "unauthenticated") return <CmsLogin />;
  if (s.status === "error" || failed) return <main className="grid min-h-dvh place-items-center p-6"><Notice>Impossible de joindre le serveur.</Notice></main>;
  if (s.status !== "ready" || activated === null) return <main className="min-h-dvh" aria-busy />;
  if (!activated)
    return <ContinueWithHivation name={s.me.user.name} email={s.me.user.email} onContinue={() => api("/cms/account", { method: "POST", body: {} }).then(() => setActivated(true)).catch(() => setFailed(true))} />;
  return <Sites userName={s.me.user.name} hasCompany={s.me.memberships.length > 0} />;
}

function Sites({ userName, hasCompany }: { userName: string; hasCompany: boolean }) {
  const [sites, setSites] = useState<Site[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(() => window.location.hash.slice(1) || null);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState(legacyDrafts);
  const [saver] = useState(() => createSaver(putSite, setStatus));
  const fail = useCallback((e: unknown) => setError(describeError(e)), []);

  const load = useCallback(
    () =>
      listSites().then((list) => {
        list.forEach((s) => saver.track(s.id, s.version));
        setSites(list.map(toSite));
      }).catch(fail),
    [saver, fail],
  );
  useEffect(() => {
    load();
  }, [load]);
  // fermer l'onglet avant la fin d'un enregistrement ferait perdre la dernière saisie
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => saver.unsaved() && e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saver]);

  const open = (id: string | null) => {
    if (!id) void saver.flush();
    window.history.replaceState(null, "", window.location.pathname + window.location.search + (id ? `#${id}` : ""));
    setOpenId(id);
  };
  const add = async (draft: Site) => {
    try {
      const stored = await createSite(draft);
      saver.track(stored.id, stored.version);
      const site = toSite(stored);
      setSites((list) => [site, ...(list ?? [])]);
      return site;
    } catch (e) {
      fail(e);
      return null;
    }
  };
  const change = useCallback((site: Site) => {
    setSites((list) => (list ?? []).map((x) => (x.id === site.id ? site : x)));
    saver.change(site);
  }, [saver]);
  const importDrafts = async () => {
    for (const d of drafts) {
      let all = true;
      for (const site of d.sites) all = !!(await add(site)) && all;
      // on ne retire le brouillon local que s'il est entièrement arrivé
      if (all) localStorage.removeItem(d.key);
    }
    setDrafts(legacyDrafts());
  };
  const logout = async () => {
    await saver.flush();
    await api("/auth/logout", { method: "POST", body: {} }).catch(() => {});
    window.location.reload();
  };

  const [template, setTemplate] = useState("restaurant");
  const [section, setSection] = useState<"sites" | "components">("sites");
  // « /cms?add=<composant> » : posé après confirmation dans le site ouvert
  const [pending, setPending] = useState<string | null>(() => /^[a-z0-9-]{1,60}$/.exec(new URLSearchParams(window.location.search).get("add") ?? "")?.[0] ?? null);
  const donePending = () => {
    setPending(null);
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  };
  if (sites === null) return <main className="grid min-h-dvh place-items-center p-6" aria-busy>{error && <Notice>{error}</Notice>}</main>;
  const create = async () => {
    const site = await add(newSite(`Site ${sites.length + 1}`, template));
    if (site) open(site.id);
  };
  const current = sites.find((x) => x.id === openId);

  if (current) return <Studio key={current.id} site={current} status={status} onChange={change} onBack={() => open(null)} pending={pending} onPendingDone={donePending} />;
  return (
    <div className="min-h-dvh bg-field">
      <header className="flex h-14 items-center justify-between border-b border-rule bg-card px-6">
        <span className="flex items-center gap-2 font-display text-lead font-semibold">
          <Image src="/logo.svg" alt="" width={26} height={26} />
          {BRAND.name} · Sites
        </span>
        <span className="flex items-center gap-4 text-small">
          <span className="text-muted max-sm:hidden">{userName}</span>
          {hasCompany && <Link href={appHref(ROUTES.home)} className="text-link underline">Ouvrir le CRM</Link>}
          <button type="button" onClick={logout} className="text-link underline">Se déconnecter</button>
        </span>
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
          onAdd={async (component, siteId) => {
            const node = parseNode(component.node);
            if (!node) return;
            // dans le site choisi (première page), ou un nouveau site
            const existing = sites.find((x) => x.id === siteId);
            const target = existing ?? (await add(newSite(`Site ${sites.length + 1}`, template)));
            if (!target) return;
            const [first, ...rest] = target.pages;
            change({ ...target, pages: [{ ...first, root: insert(first.root, null, node) }, ...rest], updatedAt: new Date().toISOString() });
            open(target.id);
          }}
        />
      ) : (
      <main className="mx-auto max-w-[1080px] p-6">
        {error && <div className="mb-4"><Notice onClose={() => setError(null)}>{error}</Notice></div>}
        {drafts.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-control bg-accent-soft px-3 py-2 text-small">
            Des sites créés avant sont restés dans ce navigateur.
            <button type="button" onClick={importDrafts} className="h-8 rounded-control bg-accent px-3 font-medium text-white">Les enregistrer sur mon compte</button>
          </div>
        )}
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
        <p className="mt-1 text-small text-muted">Vos sites sont enregistrés sur votre compte. La publication en un clic arrive ; en attendant, exportez le code.</p>
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
                <button type="button" aria-label={`Supprimer ${site.name}`} onClick={() => {
                  if (!window.confirm(`Supprimer « ${site.name} » ?`)) return;
                  saver.forget(site.id);
                  deleteSite(site.id).then(() => setSites((list) => (list ?? []).filter((x) => x.id !== site.id))).catch(fail);
                }} className="flex size-8 items-center justify-center rounded-full text-muted hover:text-fail">
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
