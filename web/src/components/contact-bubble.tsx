"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { API_URL } from "@/lib/api";
import { Button, Field, Notice, TextArea } from "./ui";

/** Page de la documentation d'où part le message ; hors documentation (accueil), la page d'entrée de la documentation. */
export const pageFor = (path: string) => (/^\/docs(\/[a-z0-9-]+)*$/.test(path) ? path : "/docs");

/** Bulle de contact en bas à droite : un petit formulaire, le message arrive à l'équipe. Sans compte. */
export function ContactBubble() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // champ piège : invisible, jamais rempli par une personne
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setState("sending");
    setError(null);
    try {
      const res = await fetch(`${API_URL}/public/contact`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, message, page: pageFor(path), website }) });
      if (res.status === 429) throw new Error("Trop de messages envoyés : réessayez dans une heure.");
      if (!res.ok) throw new Error("Vérifiez votre adresse e-mail et écrivez au moins quelques mots.");
      setState("sent");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Le message n’a pas pu partir. Réessayez dans un instant.");
      setState("idle");
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <section aria-label="Nous écrire" className="w-[min(92vw,360px)] rounded-card border border-frame bg-card p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-title font-semibold">Une question ?</h2>
              <p className="text-small text-muted">Écrivez-nous, nous répondons par e-mail.</p>
            </div>
            <button type="button" aria-label="Fermer" onClick={() => setOpen(false)} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-ink">
              ×
            </button>
          </div>
          {state === "sent" ? (
            <p className="rounded-control bg-forest-soft p-3 text-small font-medium text-forest">Merci, votre message est bien reçu. Nous vous répondons à {email}.</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex flex-col gap-3"
            >
              {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
              <Field label="Votre e-mail" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <TextArea label="Votre message" required rows={4} minLength={5} maxLength={3000} value={message} onChange={(e) => setMessage(e.target.value)} />
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e) => setWebsite(e.target.value)} className="absolute -left-[9999px] size-0 opacity-0" />
              <Button type="submit" loading={state === "sending"}>
                Envoyer
              </Button>
            </form>
          )}
        </section>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Fermer la fenêtre de contact" : "Nous écrire"}
        onClick={() => setOpen((o) => !o)}
        className="flex size-14 items-center justify-center rounded-full border border-accent-hover bg-accent text-white hover:bg-accent-hover"
      >
        <svg aria-hidden viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
        </svg>
      </button>
    </div>
  );
}
