"use client";

import { useRef, useState, type FormEvent } from "react";
import { LOCATION_SOURCE_NOTE, api, describeError, type Lead } from "@/lib/api";
import { LOST_REASONS, stageOf } from "@/lib/stages";
import { useStages } from "@/lib/stages-store";
import { useSession } from "@/lib/session";
import { LeadLinks } from "./lead-links";
import { LocationPicker, type Coords } from "./location-picker";
import { Button, Field, Modal, Notice, Select } from "./ui";

type Located = { found: boolean; lat?: number; lng?: number; source?: string; reason?: string };

const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
const fmt = (n: number) => n.toFixed(6);

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-small font-semibold uppercase tracking-wide text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Fiche d'un lead : création (sans `lead`) ou modification. */
export function LeadModal({
  lead,
  onClose,
  onSaved,
  onDeleted,
}: {
  lead?: Lead;
  onClose: () => void;
  onSaved: (lead: Lead, mode: "created" | "updated") => void;
  onDeleted?: (lead: Lead) => void;
}) {
  const { me, companyId } = useSession();
  const { stages } = useStages();
  // étape choisie : elle décide si l'on demande un motif de perte
  const [stageKey, setStageKey] = useState(lead?.status ?? stages.find((st) => st.kind === "open")?.key ?? "to_visit");
  const isLost = stageOf(stages, stageKey).kind === "lost";
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  // création : le bouton n'est proposé qu'à ceux qui ont le droit ; modification : droit de modifier requis
  const readOnly = !!lead && !perms.includes("lead:update");
  const canDelete = !!lead && perms.includes("lead:delete");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [coords, setCoords] = useState({
    lat: lead?.lat != null ? fmt(lead.lat) : "",
    lng: lead?.lng != null ? fmt(lead.lng) : "",
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<"gps" | "locate" | null>(null);

  const lat = num(coords.lat);
  const lng = num(coords.lng);
  const position: Coords | null =
    lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng }
      : null;
  const setPosition = (c: Coords) => {
    if (readOnly) return;
    setCoords({ lat: fmt(c.lat), lng: fmt(c.lng) });
    setInfo(null);
  };
  const value = (name: string) => String(new FormData(form.current!).get(name) ?? "");

  function useMyPosition() {
    if (!navigator.geolocation) return setNotice("La géolocalisation n'est pas disponible sur cet appareil.");
    setBusy("gps");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setBusy(null);
      },
      () => {
        setNotice("Position refusée ou introuvable. Cliquez sur la carte ou saisissez les coordonnées.");
        setBusy(null);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function locateFromText() {
    const googleMapsUrl = value("googleMapsUrl").trim();
    const address = value("address").trim();
    if (!googleMapsUrl && !address) return setNotice("Renseignez un lien Google Maps ou une adresse à localiser.");
    setBusy("locate");
    setNotice(null);
    try {
      const r = await api<Located>("/locate", {
        companyId,
        body: { ...(googleMapsUrl ? { googleMapsUrl } : {}), ...(address ? { address } : {}), city: value("city").trim() || undefined },
      });
      if (r.found && r.lat !== undefined && r.lng !== undefined) {
        setPosition({ lat: r.lat, lng: r.lng });
        setInfo(r.source === "google_maps" ? "Position trouvée depuis le lien Google Maps." : "Position trouvée depuis l'adresse — vérifiez-la sur la carte.");
      } else {
        setNotice(
          r.reason === "geocoding_disabled"
            ? "La recherche d'adresse est désactivée. Collez un lien Google Maps ou placez le lead sur la carte."
            : "Aucune position trouvée. Précisez l'adresse, collez un lien Google Maps ou cliquez sur la carte.",
        );
      }
    } catch (e) {
      setNotice(describeError(e));
    } finally {
      setBusy(null);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();

    if ((coords.lat.trim() === "") !== (coords.lng.trim() === "") || (coords.lat.trim() !== "" && !position)) {
      return setNotice("Latitude et longitude doivent être renseignées ensemble, en chiffres (lat −90 à 90, lng −180 à 180).");
    }
    const rawValue = text("estimatedValue").replace(/\s/g, "");
    const estimatedValue = rawValue === "" ? null : Number(rawValue);
    if (estimatedValue !== null && (!Number.isInteger(estimatedValue) || estimatedValue < 0)) {
      return setNotice("La valeur estimée doit être un nombre entier positif.");
    }

    // Création : sans position, l'API localise depuis le lien ou l'adresse. Modification : on n'efface la
    // position que si l'utilisateur l'a vidée.
    const positionPart = position
      ? { lat: position.lat, lng: position.lng }
      : lead && lead.lat !== null
        ? { lat: null, lng: null }
        : {};

    setSaving(true);
    setNotice(null);
    try {
      const body = {
        name: text("name"),
        sector: text("sector"),
        contactName: text("contactName"),
        phone: text("phone"),
        whatsapp: text("whatsapp"),
        facebook: text("facebook"),
        website: text("website"),
        googleMapsUrl: text("googleMapsUrl"),
        address: text("address"),
        city: text("city"),
        landmark: text("landmark"),
        status: stageKey,
        ...(isLost ? { lostReason: text("lostReason") } : {}),
        visited: f.get("visited") === "on",
        estimatedValue,
        ...positionPart,
      };
      const saved = lead
        ? await api<Lead>(`/leads/${lead.id}`, { method: "PATCH", body, companyId })
        : await api<Lead>("/leads", { body, companyId });
      onSaved(saved, lead ? "updated" : "created");
    } catch (err) {
      setNotice(describeError(err));
      setSaving(false);
    }
  }

  async function remove() {
    if (!lead) return;
    setDeleting(true);
    try {
      await api(`/leads/${lead.id}`, { method: "DELETE", companyId });
      onDeleted?.(lead);
    } catch (err) {
      setNotice(describeError(err));
      setConfirmDelete(false);
      setDeleting(false);
    }
  }

  const sourceNote = lead && LOCATION_SOURCE_NOTE[lead.locationSource];

  return (
    <Modal
      title={lead ? lead.name : "Nouveau lead"}
      description={lead ? (readOnly ? "Fiche du lead — lecture seule" : "Fiche du lead") : "Il apparaît sur la carte dès qu'il a une position"}
      onClose={onClose}
      width="max-w-[760px]"
    >
      <form ref={form} onSubmit={submit} className="flex flex-col gap-6">
        {lead && <LeadLinks lead={lead} />}
        {notice && <Notice onClose={() => setNotice(null)}>{notice}</Notice>}
        {readOnly && <p className="text-small text-muted">Vous n&apos;avez pas le droit de modifier ce lead.</p>}

        {/* un fieldset désactivé verrouille d'un coup tous les champs qu'il contient */}
        <fieldset disabled={readOnly} className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0">

        <Group title="Entreprise">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom de l'entreprise" name="name" required maxLength={120} autoFocus={!lead} defaultValue={lead?.name} />
            <Field label="Secteur" name="sector" maxLength={100} defaultValue={lead?.sector} />
            <Field label="Contact" name="contactName" maxLength={100} defaultValue={lead?.contactName} />
            <Field label="Téléphone" name="phone" type="tel" maxLength={40} defaultValue={lead?.phone} className="font-mono" />
          </div>
        </Group>

        <Group title="Contacts en ligne">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="WhatsApp" name="whatsapp" type="tel" maxLength={40} placeholder="+229 97 00 11 22" defaultValue={lead?.whatsapp} className="font-mono" />
            <Field label="Facebook" name="facebook" maxLength={300} placeholder="@page ou lien" defaultValue={lead?.facebook} />
            <Field label="Site web" name="website" maxLength={300} placeholder="monsite.com" defaultValue={lead?.website} />
            <Field label="Lien Google Maps" name="googleMapsUrl" maxLength={500} placeholder="https://maps.app.goo.gl/…" defaultValue={lead?.googleMapsUrl} />
          </div>
        </Group>

        <Group title="Adresse">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <Field label="Adresse" name="address" maxLength={200} defaultValue={lead?.address} />
            <Field label="Ville" name="city" maxLength={100} defaultValue={lead?.city} />
            <div className="sm:col-span-2">
              <Field label="Repère" name="landmark" maxLength={200} placeholder="En face de la pharmacie, 2e étage…" defaultValue={lead?.landmark} />
            </div>
          </div>
        </Group>

        <Group title="Position précise">
          <LocationPicker value={position} onChange={setPosition} />
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-end">
            <Field label="Latitude" inputMode="decimal" value={coords.lat} onChange={(e) => setCoords((c) => ({ ...c, lat: e.target.value }))} className="font-mono" />
            <Field label="Longitude" inputMode="decimal" value={coords.lng} onChange={(e) => setCoords((c) => ({ ...c, lng: e.target.value }))} className="font-mono" />
            <Button type="button" variant="secondary" loading={busy === "gps"} onClick={useMyPosition}>
              Ma position
            </Button>
            <Button type="button" variant="secondary" loading={busy === "locate"} onClick={locateFromText}>
              Depuis l&apos;adresse ou le lien
            </Button>
          </div>
          {(info || sourceNote) && <p className="text-small text-muted">{info ?? sourceNote}</p>}
        </Group>

        <Group title="Suivi">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Étape"
              name="status"
              value={stageKey}
              onChange={(e) => setStageKey(e.target.value)}
              options={stages.map((st) => ({ value: st.key, label: st.name }))}
            />
            <Field
              label="Valeur estimée"
              name="estimatedValue"
              inputMode="numeric"
              defaultValue={lead?.estimatedValue ?? ""}
              className="font-mono"
            />
            {isLost && (
              <div className="sm:col-span-2">
                <Field label="Motif de perte" name="lostReason" list="lost-reasons" maxLength={200} defaultValue={lead?.lostReason} placeholder="Pourquoi a-t-on perdu ce lead ?" />
                <datalist id="lost-reasons">
                  {LOST_REASONS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>
            )}
            <label className="flex min-h-10 items-center gap-2 text-body sm:col-span-2">
              <input type="checkbox" name="visited" defaultChecked={!!lead?.visitedAt} className="size-4 accent-accent" />
              Déjà visité
              {lead?.visitedAt && <span className="text-small text-muted">le {new Date(lead.visitedAt).toLocaleDateString("fr-FR")}</span>}
            </label>
          </div>
        </Group>
        </fieldset>

        {confirmDelete ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-field p-3">
            <p className="text-small font-medium">Supprimer définitivement « {lead?.name} » et ses rendez-vous ?</p>
            <div className="flex gap-2">
              {/* « Annuler » porte l'accent : le choix sûr est le plus accessible */}
              <Button type="button" onClick={() => setConfirmDelete(false)} className="h-9 w-auto">
                Annuler
              </Button>
              <Button type="button" variant="secondary" loading={deleting} onClick={remove} className="h-9 w-auto">
                Supprimer
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* l'action destructive reste à l'écart des actions fréquentes */}
            {canDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-small font-medium text-muted underline decoration-dotted decoration-2 underline-offset-4 hover:text-ink"
              >
                Supprimer ce lead
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={onClose} className="sm:w-auto">
                {readOnly ? "Fermer" : "Annuler"}
              </Button>
              {!readOnly && (
                <Button type="submit" loading={saving} className="sm:w-auto">
                  {lead ? "Enregistrer" : "Ajouter le lead"}
                </Button>
              )}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
