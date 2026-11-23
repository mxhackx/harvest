"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, api, errorMessage, oauthStartUrl } from "@/lib/api";
import Image from "next/image";
import { GitHubIcon, GoogleIcon } from "./icons";
import { Button, Field, Notice, PasswordField } from "./ui";

type Mode = "login" | "register";

export function AuthCard() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [notice, setNotice] = useState<string | null>(params.get("error") ? errorMessage(params.get("error")) : null);
  const [loading, setLoading] = useState(false);

  const oauth = (provider: "google" | "github") => {
    window.location.href = oauthStartUrl(provider, window.location.origin);
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setNotice(null);
    try {
      await api(mode === "login" ? "/auth/login" : "/auth/register", {
        body: {
          email: f.get("email"),
          password: f.get("password"),
          remember: f.get("remember") === "on",
          ...(mode === "register" ? { name: f.get("name") } : {}),
        },
      });
      router.replace("/");
    } catch (err) {
      setNotice(errorMessage(err instanceof ApiError ? err.code : null));
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="flex w-full max-w-[400px] flex-col gap-6 rounded-card border border-frame bg-card p-8">
        <header className="flex flex-col items-center gap-2 text-center">
          <Image src="/logo.png" alt="" width={52} height={60} priority />
          <span className="font-serif text-brand font-semibold">Harvest</span>
          <h1 className="text-title font-semibold">{mode === "login" ? "Connexion" : "Créer un compte"}</h1>
        </header>

        {notice && <Notice onClose={() => setNotice(null)}>{notice}</Notice>}

        <div className="flex flex-col gap-2">
          <Button variant="secondary" type="button" onClick={() => oauth("google")}>
            <GoogleIcon />
            Continuer avec Google
          </Button>
          <Button variant="secondary" type="button" onClick={() => oauth("github")}>
            <GitHubIcon />
            Continuer avec GitHub
          </Button>
        </div>

        <div className="flex items-center gap-3 text-small text-muted">
          <span className="h-px flex-1 bg-rule" />
          ou par e-mail
          <span className="h-px flex-1 bg-rule" />
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {mode === "register" && <Field label="Nom" name="name" autoComplete="name" required maxLength={100} />}
            <Field label="E-mail" name="email" type="email" autoComplete="email" required />
            <PasswordField
              label="Mot de passe"
              name="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "register" ? 8 : undefined}
            />
          </div>
          {mode === "login" && (
            <label className="flex min-h-9 items-center gap-2 text-small">
              <input type="checkbox" name="remember" className="size-4 accent-forest" /> Rester connecté
            </label>
          )}
          <Button type="submit" loading={loading}>
            {mode === "login" ? "Se connecter" : "Créer mon compte"}
          </Button>
        </form>

        <p className="text-center text-small text-muted">
          {mode === "login" ? "Pas encore de compte ? " : "Déjà un compte ? "}
          <button
            type="button"
            className="font-medium text-link underline decoration-dotted decoration-2 underline-offset-4"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setNotice(null);
            }}
          >
            {mode === "login" ? "Créer un compte" : "Se connecter"}
          </button>
        </p>
      </div>
    </div>
  );
}
