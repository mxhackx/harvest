"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, type ComponentType, type ReactNode } from "react";
import { LeadsProvider } from "@/lib/leads";
import { SessionProvider, type Session } from "@/lib/session";
import { useMe } from "@/lib/use-me";
import { AvatarMenu } from "./avatar-menu";
import { HomeIcon, UsersIcon } from "./icons";
import { Notice } from "./ui";

type Module = {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<{ size?: number }>;
  pages: { label: string; href: string }[];
};

// Seuls les modules réellement construits apparaissent dans le rail.
const MODULES: Module[] = [
  { key: "home", label: "Accueil", href: "/", icon: HomeIcon, pages: [{ label: "Tableau de bord", href: "/" }] },
  { key: "leads", label: "Leads", href: "/leads", icon: UsersIcon, pages: [{ label: "Tous les leads", href: "/leads" }] },
];

const moduleFor = (path: string) => (path.startsWith("/leads") ? MODULES[1] : MODULES[0]);

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const s = useMe();

  useEffect(() => {
    if (s.status === "unauthenticated") router.replace("/login");
    if (s.status === "ready" && s.me.memberships.length === 0) router.replace("/onboarding");
  }, [s, router]);

  const session = useMemo<Session | null>(() => {
    if (s.status !== "ready" || s.me.memberships.length === 0) return null;
    const { company } = s.me.memberships[0];
    return { me: s.me, companyId: company.id, company };
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

  const active = moduleFor(path);

  return (
    <SessionProvider value={session}>
      <LeadsProvider>
      <div className="flex min-h-dvh">
        {/* Rail de modules, 80 px */}
        <nav aria-label="Modules" className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col items-center gap-2 bg-accent py-3 md:flex">
          <Link href="/" aria-label="Harvest" className="mb-2 flex size-11 items-center justify-center">
            <Image src="/logo.png" alt="" width={34} height={39} priority />
          </Link>
          {MODULES.map((m) => (
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
        <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col gap-4 border-r border-rule bg-card p-3 lg:flex">
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
                  <active.icon size={18} />
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
                <span className="hidden text-muted sm:inline">Admin</span>
                <span aria-hidden className="hidden text-muted sm:inline">›</span>
                <span className="text-muted">{active.label}</span>
                <span aria-hidden className="text-muted">›</span>
                <span className="font-medium text-ink">{active.pages[0].label}</span>
              </nav>
            </div>
            <AvatarMenu />
          </header>
          <main className="flex-1 p-6 pb-24 md:pb-6">{children}</main>
        </div>
      </div>

      {/* Navigation basse sur mobile : le gérant est en tournée */}
      <nav aria-label="Modules" className="fixed inset-x-0 bottom-0 z-20 flex h-16 justify-around bg-accent md:hidden">
        {MODULES.map((m) => (
          <Link
            key={m.key}
            href={m.href}
            aria-current={m.key === active.key ? "page" : undefined}
            className={`flex min-w-24 flex-col items-center justify-center gap-1 text-small ${
              m.key === active.key ? "bg-white font-medium text-accent-press" : "text-[#d6e8fb]"
            }`}
          >
            <m.icon />
            {m.label}
          </Link>
        ))}
      </nav>
      </LeadsProvider>
    </SessionProvider>
  );
}
