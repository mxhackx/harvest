"use client";

import { useState } from "react";
import { LOST_REASONS } from "@/lib/stages";
import { Button, Field, Modal } from "./ui";

/** Demande pourquoi des leads sont perdus : le motif nourrit les rapports et évite de refaire la même erreur. */
export function LostReasonModal({
  count,
  stageName,
  onConfirm,
  onClose,
}: {
  count: number;
  stageName: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      title={count > 1 ? `Passer ${count} leads en « ${stageName} »` : `Passer ce lead en « ${stageName} »`}
      description="Pourquoi est-il perdu ? Le motif est facultatif."
      onClose={onClose}
      width="max-w-[480px]"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(reason.trim());
        }}
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label="Motifs fréquents">
          {LOST_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={reason === r}
              onClick={() => setReason(r)}
              className={`h-9 rounded-control border px-3 text-small font-medium ${reason === r ? "border-accent bg-accent-soft" : "border-frame hover:bg-field"}`}
            >
              {r}
            </button>
          ))}
        </div>
        <Field label="Motif" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="Ou écrivez le vôtre" autoFocus />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="sm:w-auto">
            Annuler
          </Button>
          <Button type="submit" className="sm:w-auto">
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
