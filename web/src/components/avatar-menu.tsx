"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";

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
        <div role="menu" className="absolute right-0 top-12 z-30 w-64 rounded-card border border-frame bg-card p-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={me.user.name} image={me.user.image} size={40} />
            <div className="min-w-0">
              <p className="truncate text-body font-semibold">{me.user.name}</p>
              <p className="truncate text-small text-muted">{me.user.email}</p>
            </div>
          </div>
          <hr className="my-2 border-rule" />
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
