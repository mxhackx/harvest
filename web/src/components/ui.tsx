"use client";

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { XIcon } from "./icons";

const base =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-control px-4 text-body font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/** primary : bleu du logo, filet un ton plus foncé. secondary : contour encre sur blanc. */
export function Button({
  variant = "primary",
  loading,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary"; loading?: boolean }) {
  const look =
    variant === "primary"
      ? "border border-accent-press bg-accent text-white hover:bg-accent-press"
      : "border border-frame bg-card text-ink hover:bg-field";
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      // pleine largeur par défaut, sauf si l'appelant fixe lui-même une largeur (w-auto, w-32…)
      className={`${base} ${/(^|\s)w-/.test(className) ? "" : "w-full"} ${look} ${className}`}
    >
      {loading ? "…" : children}
    </button>
  );
}

export function Field({
  label,
  error,
  className = "",
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-small font-semibold">
        {label}
      </label>
      <input
        id={id}
        {...input}
        aria-invalid={!!error}
        className={`h-10 w-full min-w-0 rounded-control border border-border bg-field px-3 text-body text-ink placeholder:text-muted focus:border-ink ${className}`}
      />
      {error && <p className="text-small text-fail">{error}</p>}
    </div>
  );
}

export function PasswordField(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; error?: string }) {
  const [shown, setShown] = useState(false);
  const id = useId();
  const { label, error, ...input } = props;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-small font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          {...input}
          type={shown ? "text" : "password"}
          aria-invalid={!!error}
          className="h-10 w-full rounded-control border border-border bg-field pl-3 pr-20 text-body text-ink focus:border-ink"
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          className="absolute right-1 top-1 h-8 rounded-micro px-2 text-small text-link"
        >
          {shown ? "Masquer" : "Afficher"}
        </button>
      </div>
      {error && <p className="text-small text-fail">{error}</p>}
    </div>
  );
}

/** Bannière de message fermable, calquée sur la notification GitHub. */
export function Notice({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div
      role="alert"
      className="relative flex min-h-[52px] items-center justify-center rounded-md border border-banner-edge bg-banner py-3 pl-4 pr-12 text-center text-small text-banner-text"
    >
      <span>{children}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-on-dark-accent hover:bg-banner-hover"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="currentColor">
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </button>
      )}
    </div>
  );
}

/** Panneau du cahier : en-tête 13×18, filet structurel pleine largeur, corps 16×18. */
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
  flush = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Corps sans marge : le contenu (carte, tableau) va jusqu'aux bords du panneau. */
  flush?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-card border border-border bg-card ${className}`}>
      <header className="flex items-start justify-between gap-4 border-b border-rule px-[18px] py-[13px]">
        <div>
          <h2 className="text-title font-semibold">{title}</h2>
          {description && <p className="text-small text-muted">{description}</p>}
        </div>
        {action}
      </header>
      <div className={flush ? "" : "px-[18px] py-4"}>{children}</div>
    </section>
  );
}

export function Select({
  label,
  options,
  className = "",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-small font-semibold">
        {label}
      </label>
      <select
        id={id}
        {...rest}
        className={`h-10 w-full min-w-0 rounded-control border border-border bg-field px-3 text-body text-ink focus:border-ink ${className}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Ferme au clic extérieur et à Échap. */
function useDismiss(open: boolean, close: () => void) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open, close]);
  return root;
}

/** Menu déroulant : `trigger` reçoit l'état, `children` reçoit une fonction pour fermer. */
export function Menu({
  trigger,
  children,
  align = "left",
}: {
  trigger: (s: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const root = useDismiss(open, () => setOpen(false));
  return (
    <div ref={root} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          role="menu"
          className={`absolute top-full z-30 mt-2 min-w-56 rounded-control border border-frame bg-card p-1 ${align === "right" ? "right-0" : "left-0"}`}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ children, active, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      role="menuitem"
      type="button"
      {...rest}
      className={`flex h-9 w-full items-center gap-2 rounded-micro px-3 text-left text-small hover:bg-field ${active ? "font-semibold" : ""}`}
    >
      {children}
    </button>
  );
}

/** Fenêtre modale : Échap ou clic sur le fond pour fermer. */
export function Modal({
  title,
  description,
  onClose,
  children,
  width = "max-w-[640px]",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-ink/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className={`w-full ${width} rounded-card border border-frame bg-card`}>
        <header className="flex items-start justify-between gap-4 border-b border-rule px-[18px] py-[13px]">
          <div>
            <h2 className="text-title font-semibold">{title}</h2>
            {description && <p className="text-small text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-field"
          >
            <XIcon size={18} />
          </button>
        </header>
        <div className="px-[18px] py-4">{children}</div>
      </div>
    </div>
  );
}
