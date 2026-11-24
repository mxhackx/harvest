"use client";

import { BRAND } from "@/lib/brand";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { Button, Field, Notice } from "./ui";

const SECTORS = ["Restauration", "Commerce", "Services", "Artisanat", "Beauté et bien-être", "Éducation", "Agriculture"];

export function Onboarding() {
  const router = useRouter();
  const s = useMe();
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (s.status === "unauthenticated") router.replace("/login");
    if (s.status === "ready" && s.me.memberships.length > 0) router.replace("/");
  }, [s, router]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setNotice(null);
    try {
      await api("/companies", {
        body: { name: f.get("name"), sector: f.get("sector"), region: f.get("region"), teamName: f.get("teamName") },
      });
      router.replace("/");
    } catch (err) {
      setNotice(errorMessage(err instanceof ApiError ? err.code : null));
      setLoading(false);
    }
  }

  if (s.status !== "ready") return <main className="min-h-dvh" aria-busy />;

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="flex w-full max-w-[400px] flex-col gap-6 rounded-card border border-frame bg-card p-8">
        <header className="flex flex-col items-center gap-2 text-center">
          <Image src="/logo.png" alt="" width={52} height={60} priority />
          <span className="font-serif text-brand font-semibold">{BRAND.name}</span>
          <h1 className="text-title font-semibold">Créez votre entreprise</h1>
          <p className="text-small text-muted">Elle sera votre espace de travail. Vous en serez le CEO.</p>
        </header>

        {notice && <Notice onClose={() => setNotice(null)}>{notice}</Notice>}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Field label="Nom de l'entreprise" name="name" required maxLength={100} autoComplete="organization" />
            <Field label="Secteur" name="sector" list="sectors" required maxLength={100} placeholder="Choisir ou saisir" />
            <datalist id="sectors">
              {SECTORS.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
            <Field label="Région de départ" name="region" required maxLength={100} />
            <Field label="Première équipe" name="teamName" required maxLength={100} defaultValue="Équipe 1" />
          </div>
          <Button type="submit" loading={loading}>
            Créer mon espace
          </Button>
        </form>
      </div>
    </main>
  );
}
