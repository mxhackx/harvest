"use client";

import { ROUTES } from "@/lib/routes";
import { BRAND } from "@/lib/brand";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, describeError } from "@/lib/api";
import { PHONE_HINT, isInternationalPhone } from "@/lib/company";
import { useMe } from "@/lib/use-me";
import { CompanyLogo, LogoPicker } from "./company-logo";
import { Button, Field, Notice } from "./ui";

const SECTORS = ["Restauration", "Commerce", "Services", "Artisanat", "Beauté et bien-être", "Éducation", "Agriculture"];

const STEPS = [
  { title: "Comment s’appelle votre entreprise ?", why: "Ce nom et cette photo identifient votre espace de travail." },
  { title: "Comment la joindre ?", why: "L’e-mail et le téléphone de l’entreprise, modifiables à tout moment." },
  { title: "Que fait-elle ?", why: "Choisissez le secteur le plus proche, ou écrivez le vôtre." },
  { title: "Où commencez-vous ?", why: "La région de vos premières visites, et le nom de votre première équipe." },
];

/** Création de l'entreprise en quelques écrans (une question à la fois), avec un aperçu de l'espace qui se remplit. */
export function Onboarding() {
  const router = useRouter();
  const s = useMe();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", logo: "", email: null as string | null, phone: "", sector: "", region: "", teamName: "Équipe 1" });
  const [notice, setNotice] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (s.status === "unauthenticated") router.replace("/login");
    if (s.status === "ready" && s.me.memberships.length > 0) router.replace(ROUTES.home);
  }, [s, router]);

  if (s.status !== "ready") return <main className="min-h-dvh" aria-busy />;

  // tant qu'on ne l'a pas modifié, l'e-mail proposé est celui du compte
  const email = form.email ?? s.me.user.email;
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const input = (key: "name" | "sector" | "region" | "teamName" | "phone") => ({ value: form[key], onChange: (e: { target: { value: string } }) => set(key, e.target.value) });
  const last = step === STEPS.length - 1;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (step === 1) {
      if (!isInternationalPhone(form.phone)) return setPhoneError(PHONE_HINT);
      setPhoneError(undefined);
    }
    if (!last) return setStep(step + 1);
    setLoading(true);
    setNotice(null);
    try {
      await api("/companies", { body: { ...form, email } });
      router.replace(ROUTES.home);
    } catch (err) {
      setNotice(describeError(err));
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <div role="progressbar" aria-label="Progression" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} className="h-1.5 bg-field">
        <div className="h-full bg-accent transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <header className="flex items-center justify-between px-6 py-4">
        <span className="flex items-center gap-2">
          <Image src="/logo.svg" alt="" width={32} height={32} priority />
          <span className="font-display text-brand font-semibold">{BRAND.name}</span>
        </span>
        <span className="text-small text-muted">Étape {step + 1} sur {STEPS.length}</span>
      </header>

      <div className="grid flex-1 lg:grid-cols-2">
        <section className="flex justify-center px-6 py-8 lg:items-center">
          <form onSubmit={submit} className="flex w-full max-w-[460px] flex-col gap-5">
            <div>
              <h1 className="font-display text-heading font-semibold leading-tight">{STEPS[step].title}</h1>
              <p className="mt-2 text-body text-muted">{STEPS[step].why}</p>
            </div>
            {notice && <Notice onClose={() => setNotice(null)}>{notice}</Notice>}

            {step === 0 && (
              <>
                <Field key="name" label="Nom de l'entreprise" required autoFocus maxLength={100} autoComplete="organization" {...input("name")} />
                <LogoPicker name={form.name} value={form.logo} onChange={(logo) => set("logo", logo)} />
              </>
            )}
            {step === 1 && (
              <>
                <Field key="email" label="E-mail de l'entreprise" type="email" required autoFocus maxLength={200} autoComplete="email" value={email} onChange={(e) => set("email", e.target.value)} />
                <Field key="phone" label="Téléphone" type="tel" required maxLength={30} autoComplete="tel" placeholder="+229 01 97 00 00 00" error={phoneError} {...input("phone")} />
              </>
            )}
            {step === 2 && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {SECTORS.map((x) => (
                    <button key={x} type="button" aria-pressed={form.sector === x} onClick={() => set("sector", x)} className={`min-h-12 rounded-control border px-3 text-left text-body font-medium ${form.sector === x ? "border-accent bg-accent-soft text-accent-press" : "border-frame bg-card hover:bg-field"}`}>
                      {x}
                    </button>
                  ))}
                </div>
                <Field key="sector" label="Secteur" required maxLength={100} placeholder="Choisir ou saisir" {...input("sector")} />
              </>
            )}
            {step === 3 && (
              <>
                <Field key="region" label="Région de départ" required autoFocus maxLength={100} {...input("region")} />
                <Field key="team" label="Première équipe" required maxLength={100} {...input("teamName")} />
              </>
            )}

            <div className="mt-2 flex justify-between gap-3">
              {step > 0 ? <Button type="button" variant="secondary" className="w-auto" onClick={() => setStep(step - 1)}>Retour</Button> : <span />}
              <Button type="submit" className="w-auto" loading={loading}>{last ? "Créer mon espace" : "Suivant"}</Button>
            </div>
            <p className="text-small text-muted">Vous serez le CEO de cet espace.</p>
          </form>
        </section>

        {/* Aperçu : ce que l'on remplit apparaît dans l'espace de travail */}
        <aside aria-hidden className="hidden items-center justify-center bg-field p-10 lg:flex">
          <div className="flex w-full max-w-[460px] overflow-hidden rounded-card border border-frame bg-card">
            <div className="flex w-16 flex-col items-center gap-3 border-r border-rule bg-field py-3">
              <Image src="/logo.svg" alt="" width={28} height={28} />
              {[0, 1, 2, 3].map((i) => <span key={i} className="size-8 rounded-control bg-card" />)}
              <span className="mt-6">
                <CompanyLogo name={form.name} logo={form.logo} size={36} />
              </span>
            </div>
            <div className="min-w-0 flex-1 p-4">
              <p className="truncate font-display text-lead font-semibold">{form.name || "Votre entreprise"}</p>
              <p className="truncate text-small text-muted">{[form.sector, form.region].filter(Boolean).join(" · ") || "Secteur · Région"}</p>
              <dl className="mt-4 flex flex-col gap-2 text-small">
                {[["E-mail", email], ["Téléphone", form.phone], ["Équipe", form.teamName]].map(([label, value]) => (
                  <div key={label} className="rounded-control border border-rule px-3 py-2">
                    <dt className="text-muted">{label}</dt>
                    <dd className="truncate font-medium">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
