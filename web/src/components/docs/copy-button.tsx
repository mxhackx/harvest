"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed"); // presse-papiers indisponible (page non sécurisée, permission refusée)
    }
    setTimeout(() => setState("idle"), 2000);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="h-8 rounded-control border border-frame bg-card px-3 text-small font-medium hover:bg-field"
      aria-live="polite"
    >
      {state === "done" ? "Copié" : state === "failed" ? "Copie impossible" : "Copier"}
    </button>
  );
}
