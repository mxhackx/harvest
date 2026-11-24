"use client";

import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { TYPE_LABEL, parseOptions, type CustomField, type FieldType } from "@/lib/custom-fields";
import { useSession } from "@/lib/session";
import { PlusIcon, TrashIcon } from "./icons";
import { Button, Field, Modal, Notice, Select, TextArea } from "./ui";

/** Champs personnalisés : des informations en plus à saisir sur chaque lead (texte, nombre, date, liste de choix). */
export function FieldsPage() {
  const { me, companyId } = useSession();
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const [list, setList] = useState<CustomField[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => api<CustomField[]>("/custom-fields", { companyId }).then(setList).catch((e) => setError(describeError(e))), [companyId]);
  useEffect(() => {
    load();
  }, [load]);

  const remove = async (f: CustomField) => {
    if (!window.confirm(`Supprimer le champ « ${f.label} » ? Ses valeurs seront retirées de tous les leads.`)) return;
    try {
      await api(`/custom-fields/${f.id}`, { method: "DELETE", companyId });
      await load();
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-title font-semibold">Champs personnalisés</h1>
          <p className="text-small text-muted">Des informations en plus sur chaque lead, selon votre métier. Jusqu’à 20 champs.</p>
        </div>
        {perms.includes("field:create") && (
          <Button className="h-9 w-auto" onClick={() => setCreating(true)}>
            <PlusIcon size={16} /> Nouveau champ
          </Button>
        )}
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {list === null ? (
        <p className="text-small text-muted">Chargement…</p>
      ) : list.length === 0 ? (
        <p className="rounded-card border border-border bg-card p-6 text-small text-muted">Aucun champ pour l’instant. Exemples : « Effectif », « Prochain salon », « Taille » (petite, moyenne, grande).</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-card border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{f.label}</p>
                <p className="text-small text-muted">
                  {TYPE_LABEL[f.type]}
                  {f.type === "select" ? ` · ${f.options.join(", ")}` : ""}
                </p>
              </div>
              {perms.includes("field:delete") && (
                <button type="button" aria-label={`Supprimer ${f.label}`} onClick={() => remove(f)} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail">
                  <TrashIcon size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {creating && (
        <CreateField
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateField({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { companyId } = useSession();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [options, setOptions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api("/custom-fields", { companyId, body: { label: label.trim(), type, options: type === "select" ? parseOptions(options) : [] } });
      onCreated();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };
  return (
    <Modal title="Nouveau champ" description="Le type ne pourra pas changer ensuite." onClose={onClose} width="max-w-[460px]">
      <div className="flex flex-col gap-4 p-[18px]">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        <Field label="Nom du champ" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="Effectif" />
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value as FieldType)} options={(Object.keys(TYPE_LABEL) as FieldType[]).map((t) => ({ value: t, label: TYPE_LABEL[t] }))} />
        {type === "select" && <TextArea label="Choix (séparés par une virgule)" rows={3} value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Petite, Moyenne, Grande" />}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="sm:w-auto" onClick={onClose}>
            Annuler
          </Button>
          <Button className="sm:w-auto" loading={busy} disabled={!label.trim()} onClick={save}>
            Créer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
