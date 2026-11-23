"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { setActiveCompanyId } from "@/lib/active-company";
import { BookIcon } from "./icons";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

export function Avatar({ name, image, size = 36 }: { name: string; image: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (image && !broken) {
    return (
      // Photo hébergée par Google / GitHub : <img> simple, sans optimisation Next ni référent envoyé.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" style={style} className="rounded-full object-cover" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
    );
  }
  return (
    <span
      aria-hidden
      style={style}
      className="flex items-center justify-center rounded-full bg-forest-soft text-small font-semibold text-link"
    >
      {initials(name)}
    </span>
  );
}

/** Photo de l'utilisateur en haut à droite, avec son menu. */
export function AvatarMenu() {
  const router = useRouter();
  const { me } = useSession();
  const membership = me.memberships[0];
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    await api("/auth/logout", { method: "POST", body: {} }).catch(() => {});
    router.replace("/login");
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu du compte"
        className="flex size-10 items-center justify-center rounded-full border border-transparent hover:border-frame"
      >
        <Avatar name={me.user.name} image={me.user.image} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-30 w-80 rounded-card border border-frame bg-card p-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={me.user.name} image={me.user.image} size={40} />
            <div className="min-w-0">
              <p className="truncate text-body font-semibold">{me.user.name}</p>
              <p className="truncate text-small text-muted">{me.user.email}</p>
            </div>
          </div>
          <hr className="my-2 border-rule" />
          <dl className="grid grid-cols-[112px_1fr] gap-x-3 gap-y-2 px-2 py-1 text-small">
            <dt className="text-muted">Entreprise</dt>
            <dd className="min-w-0">
              <p className="truncate font-medium">{membership.company.name}</p>
              <p className="truncate text-muted">{[membership.company.sector, membership.company.region].filter(Boolean).join(" · ")}</p>
            </dd>
            <dt className="text-muted">Rôle</dt>
            <dd className="flex flex-wrap gap-1">
              {membership.roles.length === 0 ? (
                "—"
              ) : (
                membership.roles.map((r) => (
                  <span key={r.id} className="inline-flex h-[22px] items-center rounded-md bg-forest-soft px-[9px] font-bold text-forest">
                    {r.name}
                  </span>
                ))
              )}
            </dd>
            <dt className="text-muted">Équipe</dt>
            <dd>{membership.team?.name ?? "—"}</dd>
            <dt className="text-muted">Membre depuis</dt>
            <dd>{new Date(membership.joinedAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</dd>
          </dl>
          {me.memberships.length > 1 && (
            <>
              <hr className="my-2 border-rule" />
              <p className="px-2 py-1 text-small text-muted">Changer d’entreprise</p>
              {me.memberships.slice(1).map((m) => (
                <button
                  key={m.company.id}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setActiveCompanyId(m.company.id);
                    // rechargement complet : plus aucune donnée de l'ancienne entreprise ne peut rester affichée
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    window.location.assign("/");
                  }}
                  className="flex h-10 w-full items-center rounded-control px-2 text-left text-body hover:bg-field"
                >
                  <span className="truncate">{m.company.name}</span>
                </button>
              ))}
            </>
          )}
          <hr className="my-2 border-rule" />
          <Link
            role="menuitem"
            href="/docs"
            onClick={() => setOpen(false)}
            className="flex h-10 w-full items-center gap-2 rounded-control px-2 text-body hover:bg-field"
          >
            <BookIcon size={16} /> Documentation
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={logout}
            className="flex h-10 w-full items-center rounded-control px-2 text-body hover:bg-field"
          >
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
