"use client";

import { ROUTES } from "@/lib/routes";
import { BRAND } from "@/lib/brand";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api, describeError, type Me } from "@/lib/api";
import { setActiveCompanyId } from "@/lib/active-company";
import { Button, Notice } from "./ui";

type Preview = { email: string; company: string };

/** Page ouverte depuis le lien d'invitation : qui invite, puis connexion ou acceptation. */
export function InvitationPage() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | "invalid" | null>(null);
  const [me, setMe] = useState<Me | "anonymous" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api<Preview>("/invitations/preview", { method: "POST", body: { token } })
      .then((p) => live && setPreview(p))
      .catch(() => live && setPreview("invalid"));
    api<Me>("/me")
      .then((m) => live && setMe(m))
      .catch((e) => live && (e instanceof ApiError && e.status === 401 ? setMe("anonymous") : setError(describeError(e))));
    return () => {
      live = false;
    };
  }, [token]);

  async function accept() {
    setBusy(true);
    try {
      const r = await api<{ companyId: string }>("/invitations/accept", { method: "POST", body: { token } });
      setActiveCompanyId(r.companyId);
      router.replace(ROUTES.home);
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  }

  const next = encodeURIComponent(`/invitation?token=${encodeURIComponent(token)}`);
  let body;
  if (preview === null || me === null) body = <p className="text-center text-small text-muted">Chargement…</p>;
  else if (preview === "invalid")
    body = <Notice>Cette invitation est invalide, expirée ou déjà utilisée. Demandez-en une nouvelle à la personne qui vous l’a envoyée.</Notice>;
  else {
    body = (
      <>
        <p className="text-center text-body">
          Vous êtes invité·e à rejoindre <strong>{preview.company}</strong> avec l’adresse <strong>{preview.email}</strong>.
        </p>
        {me === "anonymous" ? (
          <div className="flex flex-col gap-2">
            <Link href={`/login?next=${next}`} className="inline-flex h-10 items-center justify-center rounded-control border border-accent-press bg-accent px-4 text-body font-medium text-white hover:bg-accent-press">
              Se connecter ou créer un compte
            </Link>
            <p className="text-center text-small text-muted">Utilisez l’adresse {preview.email}.</p>
          </div>
        ) : me.user.email.toLowerCase() !== preview.email.toLowerCase() ? (
          <Notice>Vous êtes connecté·e avec {me.user.email}, mais l’invitation est pour {preview.email}. Déconnectez-vous et utilisez la bonne adresse.</Notice>
        ) : (
          <Button loading={busy} onClick={accept}>Rejoindre {preview.company}</Button>
        )}
      </>
    );
  }

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="flex w-full max-w-[420px] flex-col gap-5 rounded-card border border-frame bg-card p-8">
        <header className="flex flex-col items-center gap-2 text-center">
          <Image src="/logo.svg" alt="" width={56} height={56} priority />
          <span className="font-serif text-brand font-semibold">{BRAND.name}</span>
          <h1 className="text-title font-semibold">Invitation</h1>
        </header>
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        {body}
      </div>
    </div>
  );
}
