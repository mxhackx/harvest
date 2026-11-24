"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@/lib/session";
import type { Region } from "@/lib/waves";
import { LocationPicker, type Coords } from "./location-picker";
import { PencilIcon, PlusIcon, TrashIcon } from "./icons";
import { Button, Field, Modal, Notice } from "./ui";

/** Régions de prospection : un centre et un rayon. Un lead appartient à la région qui contient sa position. */
export function RegionsPage() {
  const { me, companyId } = useSession();
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const [list, setList] = useState<Region[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Region | "new" | null>(null);

  const load = useCallback(() => api<Region[]>("/regions", { companyId }).then(setList).catch((e) => setError(describeError(e))), [companyId]);
  useEffect(() => {
    load();
  }, [load]);

  const remove = async (r: Region) => {
    if (!window.confirm(`Supprimer la région « ${r.name} » ? Ses leads ne seront plus rattachés à aucune région.`)) return;
    try {
      await api(`/regions/${r.id}`, { method: "DELETE", companyId });
      await load();
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-title font-semibold">Régions</h1>
          <p className="text-small text-muted">Une région est un centre et un rayon. Un lead entre dans la région qui contient sa position, sans rien saisir.</p>
        </div>
        {perms.includes("wave:create") && (
          <Button className="h-9 w-auto" onClick={() => setForm("new")}>
            <PlusIcon size={16} /> Nouvelle région
          </Button>
        )}
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {list === null ? (
        <p className="text-small text-muted">Chargement…</p>
      ) : list.length === 0 ? (
        <p className="rounded-card border border-border bg-card p-6 text-small text-muted">Aucune région pour l’instant. Créez-en une, puis planifiez une <Link href={ROUTES.waves} className="text-link underline">vague</Link>.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-card border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.name}</p>
                <p className="text-small text-muted">
                  Rayon {r.radiusKm} km · {r.leadCount ?? 0} lead{(r.leadCount ?? 0) > 1 ? "s" : ""}
                </p>
              </div>
              {perms.includes("wave:update") && (
                <button type="button" aria-label={`Modifier ${r.name}`} onClick={() => setForm(r)} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-ink">
                  <PencilIcon size={15} />
                </button>
              )}
              {perms.includes("wave:delete") && (
                <button type="button" aria-label={`Supprimer ${r.name}`} onClick={() => remove(r)} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail">
                  <TrashIcon size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {form && (
        <RegionForm
          region={form === "new" ? null : form}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function RegionForm({ region, onClose, onSaved }: { region: Region | null; onClose: () => void; onSaved: () => void }) {
  const { companyId } = useSession();
  const [name, setName] = useState(region?.name ?? "");
  const [radius, setRadius] = useState(String(region?.radiusKm ?? 5));
  const [pos, setPos] = useState<Coords | null>(region ? { lat: region.lat, lng: region.lng } : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const radiusKm = Number(radius.replace(",", "."));
    if (!name.trim()) return setError("Donnez un nom à la région.");
    if (!pos) return setError("Cliquez sur la carte pour placer le centre.");
    if (!(radiusKm > 0 && radiusKm <= 500)) return setError("Le rayon doit être compris entre 0,1 et 500 km.");
    setBusy(true);
    try {
      const body = { name: name.trim(), lat: pos.lat, lng: pos.lng, radiusKm };
      if (region) await api(`/regions/${region.id}`, { method: "PATCH", body, companyId });
      else await api("/regions", { body, companyId });
      onSaved();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <Modal title={region ? "Modifier la région" : "Nouvelle région"} description="Le centre se place sur la carte ; le rayon dit jusqu’où la région s’étend." onClose={onClose}>
      <div className="flex flex-col gap-4 p-[18px]">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        <Field label="Nom" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Cotonou centre" />
        <Field label="Rayon (km)" inputMode="decimal" value={radius} onChange={(e) => setRadius(e.target.value)} />
        <LocationPicker value={pos} onChange={setPos} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="sm:w-auto" onClick={onClose}>
            Annuler
          </Button>
          <Button className="sm:w-auto" loading={busy} onClick={save}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
