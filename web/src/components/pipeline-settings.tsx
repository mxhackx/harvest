"use client";

import { useState } from "react";
import { ApiError, api, describeError } from "@/lib/api";
import { useLeads } from "@/lib/leads";
import { useSession } from "@/lib/session";
import { STAGE_COLORS, type Stage, type StageKind } from "@/lib/stages";
import { useStages } from "@/lib/stages-store";
import { PlusIcon } from "./icons";
import { Button, Field, Modal, Notice, Panel, Select } from "./ui";

const KIND_LABEL: Record<StageKind, string> = { open: "En cours", won: "Gagnée", lost: "Perdue" };
const KIND_OPTIONS = (Object.keys(KIND_LABEL) as StageKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }));

function Swatches({ value, onChange, disabled }: { value: string; onChange: (c: string) => void; disabled?: boolean }) {
  // une couleur hors palette (ex. le vert translucide d'origine) reste choisissable : elle s'ajoute à la liste
  const colors = STAGE_COLORS.includes(value) ? STAGE_COLORS : [value, ...STAGE_COLORS];
  return (
    <div role="group" aria-label="Couleur" className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          aria-pressed={value === c}
          aria-label={`Couleur ${c}`}
          title={c}
          onClick={() => onChange(c)}
          className={`size-6 rounded-full border ${value === c ? "ring-2 ring-ink ring-offset-1" : "border-black/15"} disabled:opacity-60`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

function StageRow({
  stage,
  index,
  total,
  leadCount,
  canEdit,
  canDelete,
  onSaved,
  onMove,
  onDelete,
  onError,
}: {
  stage: Stage;
  index: number;
  total: number;
  leadCount: number;
  canEdit: boolean;
  canDelete: boolean;
  onSaved: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onError: (message: string) => void;
}) {
  const { companyId } = useSession();
  const [draft, setDraft] = useState({ name: stage.name, color: stage.color, probability: String(stage.probability), kind: stage.kind });
  const [saving, setSaving] = useState(false);
  const dirty = draft.name !== stage.name || draft.color !== stage.color || draft.probability !== String(stage.probability) || draft.kind !== stage.kind;

  async function save() {
    const probability = Number(draft.probability);
    if (!Number.isInteger(probability) || probability < 0 || probability > 100) return onError("La probabilité est un entier entre 0 et 100.");
    setSaving(true);
    try {
      await api(`/stages/${stage.id}`, { method: "PATCH", body: { name: draft.name.trim(), color: draft.color, probability, kind: draft.kind }, companyId });
      onSaved();
    } catch (e) {
      onError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="grid gap-3 py-3 lg:grid-cols-[72px_minmax(0,1.3fr)_minmax(0,1.4fr)_96px_140px_auto] lg:items-center">
      <div className="flex gap-1">
        <button type="button" disabled={!canEdit || index === 0} onClick={() => onMove(-1)} aria-label={`Monter ${stage.name}`} className="size-8 rounded-full border border-frame hover:bg-field disabled:opacity-40">
          ↑
        </button>
        <button type="button" disabled={!canEdit || index === total - 1} onClick={() => onMove(1)} aria-label={`Descendre ${stage.name}`} className="size-8 rounded-full border border-frame hover:bg-field disabled:opacity-40">
          ↓
        </button>
      </div>
      <Field label="Nom" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} disabled={!canEdit} maxLength={40} aria-label={`Nom de l'étape ${stage.name}`} />
      <div className="flex flex-col gap-2">
        <span className="text-small font-semibold">Couleur</span>
        <Swatches value={draft.color} onChange={(color) => setDraft({ ...draft, color })} disabled={!canEdit} />
      </div>
      <Field label="Chance %" value={draft.probability} onChange={(e) => setDraft({ ...draft, probability: e.target.value })} disabled={!canEdit} inputMode="numeric" className="font-mono" aria-label={`Probabilité de l'étape ${stage.name}`} />
      <Select label="Type" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as StageKind })} disabled={!canEdit} options={KIND_OPTIONS} aria-label={`Type de l'étape ${stage.name}`} />
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <span className="font-mono text-small text-muted">{leadCount} {leadCount > 1 ? "leads" : "lead"}</span>
        {dirty && (
          <Button onClick={save} loading={saving} className="h-9 w-auto">
            Enregistrer
          </Button>
        )}
        {canDelete && (
          <button type="button" onClick={onDelete} className="text-small font-medium text-muted underline decoration-dotted decoration-2 underline-offset-4 hover:text-ink">
            Supprimer
          </button>
        )}
      </div>
    </li>
  );
}

function AddStageModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { companyId } = useSession();
  const [name, setName] = useState("");
  const [color, setColor] = useState(STAGE_COLORS[5]);
  const [probability, setProbability] = useState("50");
  const [kind, setKind] = useState<StageKind>("open");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api("/stages", { body: { name: name.trim(), color, probability: Number(probability), kind }, companyId });
      onCreated();
    } catch (e) {
      setNotice(describeError(e));
      setSaving(false);
    }
  }

  return (
    <Modal title="Nouvelle étape" description="Elle devient une colonne du board et une couleur sur la carte" onClose={onClose} width="max-w-[520px]">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {notice && <Notice onClose={() => setNotice(null)}>{notice}</Notice>}
        <Field label="Nom" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoFocus placeholder="Négociation" />
        <div className="flex flex-col gap-2">
          <span className="text-small font-semibold">Couleur</span>
          <Swatches value={color} onChange={setColor} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Chance de conclure (%)" value={probability} onChange={(e) => setProbability(e.target.value)} inputMode="numeric" className="font-mono" />
          <Select label="Type" value={kind} onChange={(e) => setKind(e.target.value as StageKind)} options={KIND_OPTIONS} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="sm:w-auto">
            Annuler
          </Button>
          <Button type="submit" loading={saving} className="sm:w-auto">
            Ajouter l&apos;étape
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteStageModal({ stage, others, leadCount, onClose, onDeleted }: { stage: Stage; others: Stage[]; leadCount: number; onClose: () => void; onDeleted: () => void }) {
  const { companyId } = useSession();
  const [moveTo, setMoveTo] = useState(others.find((s) => s.kind === stage.kind)?.key ?? others[0]?.key ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    try {
      await api(`/stages/${stage.id}${leadCount > 0 ? `?moveTo=${encodeURIComponent(moveTo)}` : ""}`, { method: "DELETE", companyId });
      onDeleted();
    } catch (e) {
      setNotice(e instanceof ApiError ? describeError(e) : "Suppression impossible.");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Supprimer « ${stage.name} » ?`}
      description={leadCount > 0 ? `${leadCount} ${leadCount > 1 ? "leads sont" : "lead est"} dans cette étape : aucun n'est supprimé, ils sont déplacés.` : "Aucun lead dans cette étape."}
      onClose={onClose}
      width="max-w-[480px]"
    >
      <div className="flex flex-col gap-4">
        {notice && <Notice onClose={() => setNotice(null)}>{notice}</Notice>}
        {leadCount > 0 && <Select label="Déplacer les leads vers" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} options={others.map((s) => ({ value: s.key, label: s.name }))} />}
        <div className="flex justify-end gap-2">
          {/* « Annuler » porte l'accent : le choix sûr est le plus accessible */}
          <Button onClick={onClose} className="sm:w-auto">
            Annuler
          </Button>
          <Button variant="secondary" onClick={confirm} loading={saving} className="sm:w-auto">
            Supprimer l&apos;étape
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function PipelineSettings() {
  const { me, companyId } = useSession();
  const { stages, reload } = useStages();
  const { leads, reload: reloadLeads } = useLeads();
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const canCreate = perms.includes("stage:create");
  const canEdit = perms.includes("stage:update");
  const canDelete = perms.includes("stage:delete");

  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Stage | null>(null);

  const countOf = (key: string) => (leads ?? []).filter((l) => l.status === key).length;

  async function move(index: number, dir: -1 | 1) {
    const ids = stages.map((s) => s.id);
    [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
    try {
      await api("/stages/reorder", { body: { ids }, companyId });
      await reload();
    } catch (e) {
      setNotice(describeError(e));
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <h1 className="font-serif text-title font-semibold">Pipeline</h1>
        <p className="text-small text-muted">Les étapes que parcourt un lead, de la première visite à la conclusion.</p>
      </div>
      {notice && <Notice onClose={() => setNotice(null)}>{notice}</Notice>}
      <Panel
        title="Étapes"
        description="Chaque étape est une colonne du board et une couleur de point sur la carte. « Gagnée » et « Perdue » closent un lead."
        action={
          canCreate ? (
            <Button onClick={() => setAdding(true)} className="h-9 w-auto">
              <PlusIcon size={16} /> Ajouter une étape
            </Button>
          ) : undefined
        }
      >
        <ul className="flex flex-col divide-y divide-rule">
          {stages.map((s, i) => (
            <StageRow
              key={`${s.id}:${s.name}:${s.color}:${s.probability}:${s.kind}`}
              stage={s}
              index={i}
              total={stages.length}
              leadCount={countOf(s.key)}
              canEdit={canEdit}
              canDelete={canDelete}
              onSaved={async () => {
                setNotice("Étape enregistrée.");
                await Promise.all([reload(), reloadLeads()]);
              }}
              onMove={(dir) => move(i, dir)}
              onDelete={() => setDeleting(s)}
              onError={setNotice}
            />
          ))}
        </ul>
        {!canEdit && <p className="mt-3 text-small text-muted">Vous pouvez consulter le pipeline, mais pas le modifier.</p>}
      </Panel>

      {adding && (
        <AddStageModal
          onClose={() => setAdding(false)}
          onCreated={async () => {
            setAdding(false);
            setNotice("Étape ajoutée.");
            await reload();
          }}
        />
      )}
      {deleting && (
        <DeleteStageModal
          stage={deleting}
          others={stages.filter((s) => s.id !== deleting.id)}
          leadCount={countOf(deleting.key)}
          onClose={() => setDeleting(null)}
          onDeleted={async () => {
            setDeleting(null);
            setNotice("Étape supprimée.");
            await Promise.all([reload(), reloadLeads()]);
          }}
        />
      )}
    </div>
  );
}
