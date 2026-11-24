"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { money, opportunitiesLabel, type Account } from "@/lib/accounts";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@/lib/session";
import { PlusIcon } from "./icons";
import { Button, Field, Modal, Notice } from "./ui";

/** Comptes : les entreprises clientes. Chacune peut avoir plusieurs opportunités (leads). */
export function AccountsPage() {
  const { me, companyId } = useSession();
  const canCreate = me.memberships[0].permissions.some((p) => p.permission === "account:create");
  const [list, setList] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => api<Account[]>("/accounts", { companyId }).then(setList).catch((e) => setError(describeError(e))), [companyId]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-title font-semibold">Comptes</h1>
          <p className="text-small text-muted">Une entreprise cliente, avec toutes ses opportunités : un lead par affaire.</p>
        </div>
        {canCreate && (
          <Button className="h-9 w-auto" onClick={() => setCreating(true)}>
            <PlusIcon size={16} /> Nouveau compte
          </Button>
        )}
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {list === null ? (
        <p className="text-small text-muted">Chargement…</p>
      ) : list.length === 0 ? (
        <p className="rounded-card border border-border bg-card p-6 text-small text-muted">Aucun compte pour l’instant. Créez-en un, ou transformez un lead en compte depuis sa fiche.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((a) => (
            <li key={a.id}>
              <Link href={ROUTES.account(a.id)} className="flex flex-col gap-2 rounded-card border border-border bg-card p-4 hover:border-ink">
                <p className="font-semibold">{a.name}</p>
                <p className="text-small text-muted">{[a.sector, opportunitiesLabel(a.opportunities)].filter(Boolean).join(" · ")}</p>
                <dl className="grid grid-cols-2 gap-2 text-small">
                  <div className="rounded-control bg-field px-3 py-2">
                    <dt className="text-muted">En cours</dt>
                    <dd className="font-mono font-semibold">{money(a.openValue)}</dd>
                  </div>
                  <div className="rounded-control bg-field px-3 py-2">
                    <dt className="text-muted">Gagné</dt>
                    <dd className="font-mono font-semibold">{money(a.wonValue)}</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating && (
        <CreateAccount
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

function CreateAccount({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { companyId } = useSession();
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api("/accounts", { companyId, body: { name: name.trim(), sector: sector.trim() } });
      onCreated();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };
  return (
    <Modal title="Nouveau compte" onClose={onClose} width="max-w-[440px]">
      <div className="flex flex-col gap-4 p-[18px]">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        <Field label="Nom de l’entreprise" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <Field label="Secteur" value={sector} onChange={(e) => setSector(e.target.value)} maxLength={100} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="sm:w-auto" onClick={onClose}>
            Annuler
          </Button>
          <Button className="sm:w-auto" loading={busy} disabled={!name.trim()} onClick={save}>
            Créer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
