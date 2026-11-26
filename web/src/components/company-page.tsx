"use client";

import { useState, type FormEvent } from "react";
import { api, describeError } from "@/lib/api";
import { PHONE_HINT, isInternationalPhone } from "@/lib/company";
import { useSession } from "@/lib/session";
import { LogoPicker } from "./company-logo";
import { Button, Field, Notice } from "./ui";

/** Réglages de l'entreprise : photo, coordonnées, nom, secteur et région. Les autres membres les lisent sans les changer. */
export function CompanyPage() {
  const { me, companyId } = useSession();
  const company = me.memberships[0].company;
  const editable = me.memberships[0].permissions.some((p) => p.permission === "company:update");
  const [form, setForm] = useState({ name: company.name, email: company.email, phone: company.phone, sector: company.sector, region: company.region, logo: company.logo });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = (key: keyof typeof form) => ({ value: form[key], disabled: !editable, onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value })) });
  const badPhone = form.phone.trim() !== "" && !isInternationalPhone(form.phone);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/company", { method: "PATCH", companyId, body: form });
      // rechargement : le nom et la photo sont affichés partout dans la coquille
      window.location.reload();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex max-w-[560px] flex-col gap-4">
      <div>
        <h1 className="font-display text-title font-semibold">Entreprise</h1>
        <p className="text-small text-muted">{editable ? "La photo et les coordonnées de votre entreprise." : "Seul le CEO peut modifier ces informations."}</p>
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      <div className="flex flex-col gap-4 rounded-card border border-border bg-card p-5">
        <LogoPicker name={form.name} value={form.logo} disabled={!editable} onChange={(logo) => setForm((f) => ({ ...f, logo }))} />
        <Field label="Nom de l'entreprise" required maxLength={100} {...field("name")} />
        <Field label="E-mail de l'entreprise" type="email" maxLength={200} {...field("email")} />
        <Field label="Téléphone" type="tel" maxLength={30} placeholder={PHONE_HINT} error={badPhone ? PHONE_HINT : undefined} {...field("phone")} />
        <Field label="Secteur" required maxLength={100} {...field("sector")} />
        <Field label="Région de départ" required maxLength={100} {...field("region")} />
        {editable && <Button type="submit" loading={busy} disabled={badPhone} className="w-auto self-end">Enregistrer</Button>}
      </div>
    </form>
  );
}
