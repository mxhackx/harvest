"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, type ComponentType, type ReactNode } from "react";
import { LeadsProvider } from "@/lib/leads";
import { StagesProvider } from "@/lib/stages-store";
import { SessionProvider, type Session } from "@/lib/session";
import { getActiveCompanyId, withActiveFirst } from "@/lib/active-company";
import { useMe } from "@/lib/use-me";
import { AvatarMenu } from "./avatar-menu";
import { BoardIcon, CalendarIcon, CheckIcon, BriefcaseIcon, CoinIcon, HomeIcon, UsersIcon } from "./icons";
import { NotificationsBell } from "./notifications-bell";
import { Notice } from "./ui";

type Icon = ComponentType<{ size?: number }>;
type Page = { label: string; short: string; href: string; icon: Icon };
type Module = { key: string; label: string; href: string; icon: Icon; pages: Page[]; /** droit requis pour voir le module */ needs?: string };

// Seuls les modules et pages réellement construits apparaissent.
const MODULES: Module[] = [
  {
    key: "home",
    label: "Accueil",
    href: "/",
    icon: HomeIcon,
    pages: [
      { label: "Tableau de bord", short: "Accueil", href: "/", icon: HomeIcon },
      { label: "Calendrier", short: "Calendrier", href: "/calendrier", icon: CalendarIcon },
    ],
  },
  {
    key: "crm",
    label: "CRM",
    href: "/leads",
    icon: UsersIcon,
    pages: [
      { label: "Leads", short: "Leads", href: "/leads", icon: UsersIcon },
      { label: "Tâches", short: "Tâches", href: "/taches", icon: CheckIcon },
      { label: "Pipeline", short: "Pipeline", href: "/pipeline", icon: BoardIcon },
      { label: "Rapports", short: "Rapports", href: "/rapports", icon: CoinIcon },
    ],
  },
  {
    key: "team",
    label: "ERP",
    href: "/equipe",
    icon: BriefcaseIcon,
    needs: "member:read",
    pages: [{ label: "Équipe", short: "Équipe", href: "/equipe", icon: UsersIcon }],
  },
];

const moduleFor = (path: string, modules: Module[]) =>
  modules.find((m) => m.pages.some((p) => p.href !== "/" && path.startsWith(p.href))) ?? modules[0];

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const s = useMe();

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
  const modules = MODULES.filter((m) => !m.needs || granted.includes(m.needs));
  const mobilePages = modules.flatMap((m) => m.pages);
  const active = moduleFor(path, modules);
  const page = active.pages.find((p) => p.href === path) ?? active.pages[0];

  return (
    <SessionProvider value={session}>
      <StagesProvider>
      <LeadsProvider>
      <div className="flex min-h-dvh">
        {/* Rail de modules, 80 px */}
        <nav aria-label="Modules" className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col items-center gap-2 bg-accent py-3 md:flex">
          <Link href="/" aria-label="Harvest" className="mb-2 flex size-11 items-center justify-center">
            <Image src="/logo.png" alt="" width={34} height={39} priority />
          </Link>
          {modules.map((m) => (
            <Link
              key={m.key}
              href={m.href}
              aria-current={m.key === active.key ? "page" : undefined}
              className={`flex h-14 w-16 flex-col items-center justify-center gap-1 rounded-control text-small ${
                m.key === active.key ? "bg-white font-medium text-accent-press" : "text-[#d6e8fb] hover:bg-white/10"
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
            <p className="font-serif text-brand font-semibold leading-tight">Harvest</p>
            <p className="truncate text-small text-muted">{session.company.name}</p>
          </div>
          <p className="px-2 text-small uppercase tracking-wide text-muted">{active.label}</p>
          <ul className="flex flex-col gap-1">
            {active.pages.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  aria-current={p.href === path ? "page" : undefined}
                  className={`flex h-10 items-center gap-2 rounded-control border px-2 text-body ${
                    p.href === path ? "border-accent/25 bg-accent-soft font-medium" : "border-transparent hover:bg-field"
                  }`}
                >
                  <p.icon size={18} />
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-rule bg-card px-6">
            <div className="flex items-center gap-3">
              <Link href="/" aria-label="Harvest" className="md:hidden">
                <Image src="/logo.png" alt="" width={24} height={28} />
              </Link>
              <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-small">
                <Link href="/" className="hidden text-muted hover:text-ink hover:underline sm:inline">Admin</Link>
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
      <nav aria-label="Modules" className="fixed inset-x-0 bottom-0 z-20 flex h-16 overflow-x-auto bg-accent md:hidden">
        {mobilePages.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            aria-current={p.href === path ? "page" : undefined}
            className={`flex min-w-[76px] flex-1 shrink-0 flex-col items-center justify-center gap-1 text-small ${
              p.href === path ? "bg-white font-medium text-accent-press" : "text-[#d6e8fb]"
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
