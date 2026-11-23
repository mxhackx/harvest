"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, describeError } from "@/lib/api";
import { sanitizeSegment, type Segment, type SegmentConfig } from "@/lib/segments";
import { useSession } from "@/lib/session";
import { PlusIcon, TrashIcon } from "./icons";
import { Button, Field, Menu, MenuItem, Modal, Notice } from "./ui";

/** Vues enregistrées de la page Leads : recherche, filtres et tri sauvegardés sous un nom, personnelles. */
export function SegmentsMenu({ current, onApply, onError }: { current: SegmentConfig; onApply: (c: SegmentConfig) => void; onError: (m: string) => void }) {
  const { companyId } = useSession();
  const [list, setList] = useState<Segment[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () => api<Segment[]>("/segments", { companyId }).then(setList).catch(() => {}),
    [companyId],
  );
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Menu
        trigger={({ toggle, open }) => (
          <button type="button" onClick={toggle} aria-expanded={open} className="inline-flex h-9 items-center gap-2 rounded-full border border-frame px-3 text-small font-medium hover:bg-field">
            Segments{list.length > 0 && <span className="font-mono">{list.length}</span>}
          </button>
        )}
      >
        {(close) => (
          <div className="min-w-[240px]">
            {list.length === 0 && <p className="px-3 py-2 text-small text-muted">Aucun segment enregistré.</p>}
            {list.map((s) => (
              <div key={s.id} className="flex items-center">
                <MenuItem onClick={() => { close(); onApply(sanitizeSegment(s.config)); }}>{s.name}</MenuItem>
                <button
                  type="button"
                  aria-label={`Supprimer le segment ${s.name}`}
                  onClick={() => api(`/segments/${s.id}`, { method: "DELETE", companyId }).then(load).catch((e) => onError(describeError(e)))}
                  className="mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            ))}
            <hr className="my-1 border-rule" />
            <MenuItem onClick={() => { close(); setSaving(true); }}>
              <PlusIcon size={14} /> Enregistrer la vue actuelle
            </MenuItem>
          </div>
        )}
      </Menu>
      {saving && <SaveSegment config={current} onClose={() => setSaving(false)} onSaved={() => { setSaving(false); load(); }} />}
    </>
  );
}

function SaveSegment({ config, onClose, onSaved }: { config: SegmentConfig; onClose: () => void; onSaved: () => void }) {
  const { companyId } = useSession();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/segments", { method: "POST", body: { name: name.trim(), config }, companyId });
      onSaved();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }
  return (
    <Modal title="Enregistrer la vue" description="Recherche, filtres et tri actuels. Cette vue n’est visible que par vous." onClose={onClose} width="max-w-[440px]">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        <Field label="Nom de la vue" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="À visiter à Cotonou" autoFocus />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" className="w-auto" onClick={onClose}>Annuler</Button>
          <Button type="submit" className="w-auto" loading={busy} disabled={!name.trim()}>Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
