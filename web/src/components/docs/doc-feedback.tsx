"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";

const CHOICES = [
  { rating: 1, emoji: "😞", label: "Pas du tout" },
  { rating: 2, emoji: "😐", label: "Moyennement" },
  { rating: 3, emoji: "😀", label: "Oui" },
] as const;

/** « Cet article vous a-t-il aidé ? » : une réponse en un clic, sans compte ni donnée personnelle. */
export function DocFeedback({ page }: { page: string }) {
  const [sent, setSent] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const send = async (rating: number) => {
    setSent(rating);
    setFailed(false);
    try {
      const res = await fetch(`${API_URL}/public/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ page, rating }) });
      if (!res.ok) throw new Error();
    } catch {
      setFailed(true);
      setSent(null);
    }
  };

  return (
    <section aria-label="Votre avis" className="mt-10 rounded-card border border-border bg-field p-5 text-center">
      {sent !== null ? (
        <p className="font-medium">Merci pour votre retour !</p>
      ) : (
        <>
          <p className="mb-3 font-medium">Cet article vous a-t-il aidé ?</p>
          <div className="flex justify-center gap-3">
            {CHOICES.map((c) => (
              <button key={c.rating} type="button" aria-label={c.label} title={c.label} onClick={() => send(c.rating)} className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-[22px] hover:border-ink">
                <span aria-hidden>{c.emoji}</span>
              </button>
            ))}
          </div>
          {failed && <p className="mt-3 text-small text-fail">Votre avis n’a pas pu être envoyé. Réessayez dans un instant.</p>}
        </>
      )}
    </section>
  );
}
