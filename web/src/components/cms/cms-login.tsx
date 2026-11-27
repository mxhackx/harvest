"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { API_URL, api, describeError, oauthStartUrl } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { GitHubIcon, GoogleIcon } from "../icons";
import { Button, Field, Notice, PasswordField } from "../ui";

const shell = "grid min-h-dvh place-items-center bg-field p-6";
const box = "flex w-full max-w-[400px] flex-col gap-4 rounded-card border border-frame bg-card p-8";

function Header({ title, text }: { title: string; text: string }) {
  return (
    <header className="flex flex-col items-center gap-2 text-center">
      <Image src="/logo.svg" alt="" width={48} height={48} priority />
      <span className="font-display text-brand font-semibold">{BRAND.name} · Sites</span>
      <h1 className="text-title font-semibold">{title}</h1>
      <p className="text-small text-muted">{text}</p>
    </header>
  );
}

/** Connexion et inscription propres au CMS : aucune entreprise CRM n'est demandée. */
export function CmsLogin() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const body = { email: f.get("email"), password: f.get("password"), ...(mode === "register" ? { name: f.get("name") } : {}) };
      await api(mode === "register" ? "/auth/register" : "/auth/login", { body });
      // on s'est connecté ici pour le CMS : son espace s'ouvre avec
      await api("/cms/account", { method: "POST", body: {} });
      window.location.reload();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  return (
    <main className={shell}>
      <div className={box}>
        <Header title={mode === "login" ? "Connexion" : "Créer un compte"} text="Composez et publiez des sites. Un compte Hivation fonctionne aussi." />
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === "register" && <Field label="Nom" name="name" required maxLength={100} autoComplete="name" />}
          <Field label="E-mail" name="email" type="email" required autoComplete="email" />
          <PasswordField label="Mot de passe" name="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          <Button type="submit" loading={busy}>{mode === "login" ? "Se connecter" : "Créer mon compte"}</Button>
        </form>
        <div className="flex flex-col gap-2">
          {([["google", "Google", GoogleIcon], ["github", "GitHub", GitHubIcon]] as const).map(([provider, label, Icon]) => (
            <Button key={provider} type="button" variant="secondary" onClick={() => window.location.assign(oauthStartUrl(provider, window.location.origin, API_URL))}>
              <Icon /> Continuer avec {label}
            </Button>
          ))}
        </div>
        <button type="button" className="text-small text-link underline" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Pas encore de compte ? S’inscrire" : "J’ai déjà un compte"}
        </button>
      </div>
    </main>
  );
}

/** Déjà connecté à Hivation : on demande l'accord avant d'ouvrir l'espace Sites. */
export function ContinueWithHivation({ name, email, onContinue }: { name: string; email: string; onContinue: () => void }) {
  const logout = async () => {
    await api("/auth/logout", { method: "POST", body: {} }).catch(() => {});
    window.location.reload();
  };
  return (
    <main className={shell}>
      <div className={box}>
        <Header title="Utiliser votre compte Hivation" text="Un espace Sites sera ouvert pour ce compte, séparé du CRM." />
        <p className="rounded-control border border-border p-3 text-center text-small">
          <strong className="block">{name}</strong>
          <span className="text-muted">{email}</span>
        </p>
        <Button onClick={onContinue}>Continuer avec Hivation</Button>
        <button type="button" onClick={logout} className="text-small text-link underline">Utiliser un autre compte</button>
      </div>
    </main>
  );
}
