"use client";

import { useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button, Modal, Notice, Select } from "./ui";

type Member = { userId: string; name: string };

/** Attribue des leads à un membre de l'entreprise. L'API refuse ce que les droits de l'utilisateur n'autorisent pas. */
export function AssignModal({ ids, onClose, onDone }: { ids: string[]; onClose: () => void; onDone: (affected: number) => void }) {
  const { me, companyId } = useSession();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [owner, setOwner] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Member[]>("/members", { companyId })
      .then((m) => {
        setMembers(m);
        setOwner(m.find((x) => x.userId === me.user.id)?.userId ?? m[0]?.userId ?? "");
      })
      .catch((e) => setError(describeError(e)));
  }, [companyId, me.user.id]);

  async function submit() {
    setBusy(true);
    try {
      const r = await api<{ affected: number }>("/leads/assign", { method: "POST", body: { ids, ownerId: owner }, companyId });
      onDone(r.affected);
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  }

  return (
    <Modal title={ids.length > 1 ? `Attribuer ${ids.length} leads` : "Attribuer ce lead"} description="La personne choisie en devient responsable et en est notifiée." onClose={onClose} width="max-w-[440px]">
      <div className="flex flex-col gap-4">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        {members && (
          <Select label="Attribuer à" value={owner} onChange={(e) => setOwner(e.target.value)} options={members.map((m) => ({ value: m.userId, label: m.userId === me.user.id ? `${m.name} (moi)` : m.name }))} />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="w-auto" onClick={onClose}>Annuler</Button>
          <Button className="w-auto" loading={busy} disabled={!owner} onClick={submit}>Attribuer</Button>
        </div>
      </div>
    </Modal>
  );
}
