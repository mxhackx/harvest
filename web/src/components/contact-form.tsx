"use client";

import { useState, type FormEvent } from "react";
import type { Contact } from "@/lib/activity";
import { Button, Field, Modal, Select, TextArea } from "./ui";

export type ContactValues = {
  salutation: string;
  firstName: string;
  lastName: string;
  role: string;
  reportsToId: string;
  notes: string;
  phone: string;
  whatsapp: string;
  email: string;
  country: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
};

const SALUTATIONS = ["", "M.", "Mme", "Dr", "Pr"];

const initial = (c?: Contact): ContactValues => ({
  salutation: c?.salutation ?? "",
  firstName: c?.firstName ?? "",
  // un contact créé avant les prénoms et noms n'a que « name » : il devient le nom de famille
  lastName: c ? c.lastName || (c.firstName ? "" : c.name) : "",
  role: c?.role ?? "",
  reportsToId: c?.reportsToId ?? "",
  notes: c?.notes ?? "",
  phone: c?.phone ?? "",
  whatsapp: c?.whatsapp ?? "",
  email: c?.email ?? "",
  country: c?.country ?? "",
  street: c?.street ?? "",
  city: c?.city ?? "",
  region: c?.region ?? "",
  postalCode: c?.postalCode ?? "",
});

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-4">
    <h3 className="rounded-control bg-field px-3 py-2 font-display text-body font-semibold">{title}</h3>
    {children}
  </section>
);

/**
 * Fiche d'un contact, rangée comme dans un CRM : « À propos » (civilité, prénom, nom, lead, fonction, responsable,
 * description) puis « Coordonnées » (téléphone, e-mail, adresse postale). `leads` : sur la page Contacts, on choisit le lead.
 */
export function ContactForm({
  contact,
  siblings = [],
  leads,
  onClose,
  onSubmit,
}: {
  contact?: Contact;
  /** les autres personnes du même lead : le responsable hiérarchique se choisit parmi elles */
  siblings?: { id: string; name: string }[];
  leads?: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (values: ContactValues, leadId: string) => Promise<void>;
}) {
  const [v, setV] = useState<ContactValues>(() => initial(contact));
  const [leadId, setLeadId] = useState(contact?.leadId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof ContactValues) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!v.lastName.trim()) return setError("Le nom est obligatoire.");
    if (leads && !leadId) return setError("Choisissez le lead de ce contact.");
    setBusy(true);
    try {
      await onSubmit(v, leadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
      setBusy(false);
    }
  }

  return (
    <Modal title={contact ? "Modifier le contact" : "Créer : contact"} description="* = informations requises" onClose={onClose} width="max-w-[640px]">
      <form onSubmit={submit} className="flex max-h-[75vh] flex-col gap-5 overflow-y-auto p-[18px]">
        {error && <p role="alert" className="rounded-control border border-fail px-3 py-2 text-small text-fail">{error}</p>}
        <Section title="À propos">
          <Select label="Civilité" value={v.salutation} onChange={set("salutation")} options={SALUTATIONS.map((s) => ({ value: s, label: s || "- Aucune -" }))} />
          <Field label="Prénom" value={v.firstName} onChange={set("firstName")} maxLength={60} autoComplete="given-name" />
          <Field label="Nom *" value={v.lastName} onChange={set("lastName")} maxLength={60} autoComplete="family-name" />
          {leads && <Select label="Lead (entreprise) *" value={leadId} onChange={(e) => setLeadId(e.target.value)} options={[{ value: "", label: "Rechercher dans les leads…" }, ...leads.map((l) => ({ value: l.id, label: l.name }))]} />}
          <Field label="Fonction" value={v.role} onChange={set("role")} maxLength={100} placeholder="Gérant, comptable…" />
          {contact && siblings.length > 0 && (
            <Select label="Responsable hiérarchique" value={v.reportsToId} onChange={set("reportsToId")} options={[{ value: "", label: "Aucun" }, ...siblings.filter((s) => s.id !== contact.id).map((s) => ({ value: s.id, label: s.name }))]} />
          )}
          <TextArea label="Description" value={v.notes} onChange={set("notes")} maxLength={500} />
        </Section>
        <Section title="Coordonnées">
          <Field label="Téléphone" value={v.phone} onChange={set("phone")} maxLength={40} inputMode="tel" />
          <Field label="WhatsApp" value={v.whatsapp} onChange={set("whatsapp")} maxLength={40} placeholder="+229…" inputMode="tel" />
          <Field label="Adresse e-mail" type="email" value={v.email} onChange={set("email")} maxLength={200} placeholder="nom@exemple.com" />
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-small font-semibold">Adresse postale</legend>
            <Field label="Pays" value={v.country} onChange={set("country")} maxLength={60} autoComplete="country-name" />
            <TextArea label="Rue" rows={2} value={v.street} onChange={set("street")} maxLength={200} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ville" value={v.city} onChange={set("city")} maxLength={100} />
              <Field label="Région/Province" value={v.region} onChange={set("region")} maxLength={100} />
            </div>
            <Field label="Code postal" value={v.postalCode} onChange={set("postalCode")} maxLength={20} autoComplete="postal-code" />
          </fieldset>
        </Section>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-rule bg-card pt-3">
          <Button type="button" variant="secondary" className="w-auto" onClick={onClose}>Annuler</Button>
          <Button type="submit" className="w-auto" loading={busy}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
