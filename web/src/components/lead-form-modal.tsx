"use client";

import { useState, type FormEvent } from "react";
import { ApiError, LEAD_STATUSES, STATUS_LABEL, api, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button, Field, Modal, Notice, Select } from "./ui";

export function LeadFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { companyId } = useSession();
  const [coords, setCoords] = useState({ lat: "", lng: "" });
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  function locate() {
    if (!navigator.geolocation) return setNotice("La géolocalisation n'est pas disponible sur cet appareil.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) });
        setLocating(false);
      },
      () => {
        setNotice("Position refusée ou introuvable. Saisissez les coordonnées à la main.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const lat = coords.lat.trim() === "" ? null : Number(coords.lat);
    const lng = coords.lng.trim() === "" ? null : Number(coords.lng);
    if ((lat === null) !== (lng === null) || Number.isNaN(lat) || Number.isNaN(lng)) {
      return setNotice("Renseignez la latitude et la longitude ensemble, en chiffres.");
    }
    const rawValue = String(f.get("estimatedValue") ?? "").replace(/\s/g, "");
    const estimatedValue = rawValue === "" ? null : Number(rawValue);
    if (estimatedValue !== null && (!Number.isInteger(estimatedValue) || estimatedValue < 0)) {
      return setNotice("La valeur estimée doit être un nombre entier positif.");
    }
    setSaving(true);
    setNotice(null);
    try {
      await api("/leads", {
        companyId,
        body: {
          name: f.get("name"),
          sector: f.get("sector"),
          contactName: f.get("contactName"),
          phone: f.get("phone"),
          address: f.get("address"),
          status: f.get("status"),
          estimatedValue,
          lat,
          lng,
        },
      });
      onCreated();
    } catch (err) {
      setNotice(errorMessage(err instanceof ApiError ? err.code : null));
      setSaving(false);
    }
  }

  return (
    <Modal title="Nouveau lead" description="Il apparaît sur la carte dès qu'il a une position" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-6">
        {notice && <Notice onClose={() => setNotice(null)}>{notice}</Notice>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom de l'entreprise" name="name" required maxLength={120} autoFocus />
          <Field label="Secteur" name="sector" maxLength={100} />
          <Field label="Contact" name="contactName" maxLength={100} />
          <Field label="Téléphone" name="phone" type="tel" maxLength={40} />
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <div className="sm:col-span-3">
            <Field label="Adresse" name="address" maxLength={200} />
          </div>
          <Field
            label="Latitude"
            inputMode="decimal"
            value={coords.lat}
            onChange={(e) => setCoords((c) => ({ ...c, lat: e.target.value }))}
            className="font-mono"
          />
          <Field
            label="Longitude"
            inputMode="decimal"
            value={coords.lng}
            onChange={(e) => setCoords((c) => ({ ...c, lng: e.target.value }))}
            className="font-mono"
          />
          <Button type="button" variant="secondary" loading={locating} onClick={locate}>
            Ma position
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Étape"
            name="status"
            defaultValue="to_visit"
            options={LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
          <Field label="Valeur estimée" name="estimatedValue" inputMode="numeric" className="font-mono" />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="sm:w-auto">
            Annuler
          </Button>
          <Button type="submit" loading={saving} className="sm:w-auto">
            Ajouter le lead
          </Button>
        </div>
      </form>
    </Modal>
  );
}
