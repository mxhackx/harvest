"use client";

import { ROUTES } from "@/lib/routes";
import { BRAND } from "@/lib/brand";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, type ComponentType, type ReactNode } from "react";
import { LeadsProvider } from "@/lib/leads";
import { StagesProvider } from "@/lib/stages-store";
import { SessionProvider, type Session } from "@/lib/session";
import { getActiveCompanyId, withActiveFirst } from "@/lib/active-company";
import { usePins } from "@/lib/pins";
import { useMe } from "@/lib/use-me";
import { AvatarMenu } from "./avatar-menu";
import { BoardIcon, CalendarIcon, CheckIcon, BriefcaseIcon, CoinIcon, FormIcon, HomeIcon, PushPinIcon, TrashIcon, UserIcon, UsersIcon } from "./icons";
import { NotificationsBell } from "./notifications-bell";
import { Notice } from "./ui";

type Icon = ComponentType<{ size?: number }>;
type Page = { label: string; short: string; href: string; icon: Icon; /** droit requis pour voir la page */ needs?: string };
type Module = { key: string; label: string; href: string; icon: Icon; pages: Page[]; /** droit requis pour voir le module */ needs?: string };

// Seuls les modules et pages réellement construits apparaissent.
const MODULES: Module[] = [
  {
    key: "home",
    label: "Accueil",
    href: ROUTES.home,
    icon: HomeIcon,
    pages: [
      { label: "Tableau de bord", short: "Accueil", href: ROUTES.home, icon: HomeIcon },
      { label: "Calendrier", short: "Calendrier", href: ROUTES.calendar, icon: CalendarIcon },
    ],
  },
  {
    key: "crm",
    label: "CRM",
    href: ROUTES.leads,
    icon: UsersIcon,
    pages: [
      { label: "Leads", short: "Leads", href: ROUTES.leads, icon: UsersIcon },
      { label: "Contacts", short: "Contacts", href: ROUTES.contacts, icon: UserIcon },
      { label: "Tâches", short: "Tâches", href: ROUTES.tasks, icon: CheckIcon },
      { label: "Modèles", short: "Modèles", href: ROUTES.templates, icon: FormIcon },
      { label: "Pipeline", short: "Pipeline", href: ROUTES.pipeline, icon: BoardIcon },
      { label: "Rapports", short: "Rapports", href: ROUTES.reports, icon: CoinIcon },
      { label: "Corbeille", short: "Corbeille", href: ROUTES.trash, icon: TrashIcon, needs: "lead:delete" },
    ],
  },
  {
    key: "team",
    label: "ERP",
    href: ROUTES.team,
    icon: BriefcaseIcon,
    needs: "member:read",
    pages: [{ label: "Équipe", short: "Équipe", href: ROUTES.team, icon: UsersIcon }],
  },
];

const moduleFor = (path: string, modules: Module[]) =>
  modules.find((m) => m.pages.some((p) => p.href !== ROUTES.home && path.startsWith(p.href))) ?? modules[0];

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const s = useMe();
  const { pins, toggle: togglePinned } = usePins();

  useEffect(() => {
    if (s.status === "unauthenticated") router.replace("/login");
    if (s.status === "ready" && s.me.memberships.length === 0) router.replace("/onboarding");
  }, [s, router]);

  // mobile : la barre du bas défile ; la page courante doit y rester visible
  useEffect(() => {
    document.querySelector('nav.fixed a[aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [path, s.status]);

  const session = useMemo<Session | null>(() => {
    if (s.status !== "ready" || s.me.memberships.length === 0) return null;
    // l'entreprise choisie passe en tête : tout l'espace lit `memberships[0]` comme entreprise active
    const memberships = withActiveFirst(s.me.memberships, getActiveCompanyId());
    const { company } = memberships[0];
    return { me: { ...s.me, memberships }, companyId: company.id, company };
  }, [s]);

  if (s.status === "error")
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <div className="w-full max-w-[400px]">
          <Notice>Impossible de joindre le serveur. Vérifiez votre connexion.</Notice>
        </div>
      </main>
    );
  if (!session) return <main className="min-h-dvh" aria-busy />;

  const granted = session.me.memberships[0].permissions.map((p) => p.permission);
  const modules = MODULES.filter((m) => !m.needs || granted.includes(m.needs)).map((m) => ({ ...m, pages: m.pages.filter((p) => !p.needs || granted.includes(p.needs)) }));
  const mobilePages = modules.flatMap((m) => m.pages);
  const active = moduleFor(path, modules);
  const pinnedPages = pins.map((h) => mobilePages.find((p) => p.href === h)).filter((p): p is Page => !!p);
  const row = (p: Page) => (
    <li key={p.href} className="group relative">
      <Link
        href={p.href}
        aria-current={p.href === path ? "page" : undefined}
        className={`flex h-10 items-center gap-2 rounded-control border px-2 pr-9 text-body ${
          p.href === path ? "border-accent/25 bg-accent-soft font-medium" : "border-transparent hover:bg-field"
        }`}
      >
        <p.icon size={18} />
        {p.label}
      </Link>
      <button
        type="button"
        onClick={() => togglePinned(p.href)}
        aria-pressed={pins.includes(p.href)}
        aria-label={pins.includes(p.href) ? `Désépingler ${p.label}` : `Épingler ${p.label}`}
        className={`absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-card hover:text-ink focus-visible:opacity-100 ${pins.includes(p.href) ? "text-accent-press" : "opacity-0 group-hover:opacity-100"}`}
      >
        <PushPinIcon size={15} />
      </button>
    </li>
  );
  const page = active.pages.find((p) => p.href === path) ?? active.pages[0];

  return (
    <SessionProvider value={session}>
      <StagesProvider>
      <LeadsProvider>
      <div className="flex min-h-dvh">
        {/* Rail de modules, 80 px */}
        <nav aria-label="Modules" className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col items-center gap-2 border-r border-rule bg-field py-3 md:flex">
          <Link href={ROUTES.home} aria-label={BRAND.name} className="mb-2 flex size-11 items-center justify-center">
            <Image src="/logo.svg" alt="" width={38} height={38} priority />
          </Link>
          {modules.map((m) => (
            <Link
              key={m.key}
              href={m.href}
              aria-current={m.key === active.key ? "page" : undefined}
              className={`flex h-14 w-16 flex-col items-center justify-center gap-1 rounded-control text-small ${
                m.key === active.key ? "bg-accent-soft font-medium text-accent-press" : "text-muted hover:bg-card hover:text-ink"
              }`}
            >
              <m.icon />
              {m.label}
            </Link>
          ))}
        </nav>

        {/* Colonne du module, 232 px */}
        <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col gap-4 border-r border-rule bg-card p-3 md:flex">
          <div className="rounded-control border border-frame px-3 py-2">
            <p className="font-display text-brand font-semibold leading-tight">{BRAND.name}</p>
            <p className="truncate text-small text-muted">{session.company.name}</p>
          </div>
          {pinnedPages.length > 0 && (
            <>
              <p className="px-2 text-small uppercase tracking-wide text-muted">Épinglées</p>
              <ul className="flex flex-col gap-1">{pinnedPages.map((p) => row(p))}</ul>
              <p className="px-2 text-small uppercase tracking-wide text-muted">{active.label}</p>
            </>
          )}
          {pinnedPages.length === 0 && <p className="px-2 text-small uppercase tracking-wide text-muted">{active.label}</p>}
          <ul className="flex flex-col gap-1">{active.pages.map((p) => row(p))}</ul>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-rule bg-card px-6">
            <div className="flex items-center gap-3">
              <Link href={ROUTES.home} aria-label={BRAND.name} className="md:hidden">
                <Image src="/logo.svg" alt="" width={26} height={26} />
              </Link>
              <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-small">
                <Link href={ROUTES.home} className="hidden text-muted hover:text-ink hover:underline sm:inline">Admin</Link>
                <span aria-hidden className="hidden text-muted sm:inline">›</span>
                <Link href={active.href} className="text-muted hover:text-ink hover:underline">{active.label}</Link>
                <span aria-hidden className="text-muted">›</span>
                <span aria-current="page" className="font-medium text-ink">{page.label}</span>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <NotificationsBell />
              <AvatarMenu />
            </div>
          </header>
          <main className="flex-1 p-6 pb-24 md:pb-6">{children}</main>
        </div>
      </div>

      {/* Navigation basse sur mobile : le gérant est en tournée */}
      <nav aria-label="Modules" className="fixed inset-x-0 bottom-0 z-20 flex h-16 overflow-x-auto border-t border-rule bg-card md:hidden">
        {mobilePages.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            aria-current={p.href === path ? "page" : undefined}
            className={`flex min-w-[76px] flex-1 shrink-0 flex-col items-center justify-center gap-1 text-small ${
              p.href === path ? "bg-accent-soft font-medium text-accent-press" : "text-muted"
            }`}
          >
            <p.icon />
            {p.short}
          </Link>
        ))}
      </nav>
      </LeadsProvider>
      </StagesProvider>
    </SessionProvider>
  );
}
