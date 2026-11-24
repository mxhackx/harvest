"use client";

import { BRAND } from "@/lib/brand";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { api, describeError } from "@/lib/api";
import { Button, Field, Notice, PasswordField } from "./ui";

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="flex w-full max-w-[400px] flex-col gap-6 rounded-card border border-frame bg-card p-8">
        <header className="flex flex-col items-center gap-2 text-center">
          <Image src="/logo.svg" alt="" width={56} height={56} priority />
          <span className="font-display text-brand font-semibold">{BRAND.name}</span>
          <h1 className="text-title font-semibold">{title}</h1>
        </header>
        {children}
        <p className="text-center text-small">
          <Link href="/login" className="font-medium text-link underline decoration-dotted decoration-2 underline-offset-4">Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}

/** Demande du lien de réinitialisation. La réponse est la même que l'adresse existe ou non. */
export function ForgotPasswordPage() {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setBusy(true);
    setError(null);
    try {
      await api("/auth/forgot", { body: { email } });
      setSent(email);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Mot de passe oublié">
      {sent ? (
        <p className="text-center text-body">
          Si un compte existe pour <strong>{sent}</strong>, un e-mail avec un lien valable une heure vient de partir. Pensez à vérifier vos courriers indésirables.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-small text-muted">Indiquez l’adresse de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe.</p>
          {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
          <Field label="E-mail" name="email" type="email" autoComplete="email" required autoFocus />
          <Button type="submit" loading={busy}>Envoyer le lien</Button>
        </form>
      )}
    </Shell>
  );
}

/** Page ouverte depuis le lien reçu par e-mail : choisir le nouveau mot de passe. */
export function ResetPasswordPage() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) return setError("Les deux mots de passe ne sont pas identiques.");
    setBusy(true);
    setError(null);
    try {
      await api("/auth/reset", { body: { token, password: f.get("password") } });
      setDone(true);
      setTimeout(() => router.replace("/login"), 1800);
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  return (
    <Shell title="Nouveau mot de passe">
      {done ? (
        <p className="text-center text-body">Mot de passe modifié. Vous pouvez vous connecter.</p>
      ) : !token ? (
        <Notice>Ce lien est incomplet. Redemandez un e-mail depuis « Mot de passe oublié ».</Notice>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
          <PasswordField label="Nouveau mot de passe" name="password" autoComplete="new-password" required minLength={8} />
          <PasswordField label="Confirmer" name="confirm" autoComplete="new-password" required minLength={8} />
          <p className="text-small text-muted">8 caractères au moins. Vous serez déconnecté de tous vos appareils.</p>
          <Button type="submit" loading={busy}>Enregistrer</Button>
        </form>
      )}
    </Shell>
  );
}
