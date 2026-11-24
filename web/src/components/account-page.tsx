"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { money, opportunitiesLabel, type AccountDetail } from "@/lib/accounts";
import { ROUTES } from "@/lib/routes";
import { useCrumb } from "@/lib/crumb";
import { useSession } from "@/lib/session";
import { stageOf } from "@/lib/stages";
import { useStages } from "@/lib/stages-store";
import { PlusIcon, TrashIcon } from "./icons";
import { Button, Field, Modal, Notice } from "./ui";

/** Fiche d'un compte : ses chiffres et ses opportunités (les leads qu'on peut lire), dont on peut ouvrir une nouvelle. */
export function AccountPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me, companyId } = useSession();
  const { stages } = useStages();
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  useCrumb(account?.name);

  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  useEffect(() => {
    api<AccountDetail>(`/accounts/${id}`, { companyId })
      .then(setAccount)
      .catch((e) => setError(describeError(e)));
  }, [id, companyId, version]);

  const remove = async () => {
    if (!account || !window.confirm(`Supprimer le compte « ${account.name} » ? Ses opportunités restent des leads, sans compte.`)) return;
    try {
      await api(`/accounts/${account.id}`, { method: "DELETE", companyId });
      router.replace(ROUTES.accounts);
    } catch (e) {
      setError(describeError(e));
    }
  };

  if (!account) return error ? <Notice onClose={() => setError(null)}>{error}</Notice> : <p className="text-small text-muted">Chargement…</p>;
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Fil d'Ariane" className="text-small text-muted">
        <Link href={ROUTES.accounts} className="hover:underline">Comptes</Link> › <span className="font-medium text-ink">{account.name}</span>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-title font-semibold">{account.name}</h1>
          <p className="text-small text-muted">{[account.sector, account.website].filter(Boolean).join(" · ") || "Entreprise cliente"}</p>
        </div>
        <div className="flex gap-2">
          {perms.includes("lead:create") && (
            <Button className="h-9 w-auto" onClick={() => setAdding(true)}>
              <PlusIcon size={16} /> Nouvelle opportunité
            </Button>
          )}
          {perms.includes("account:delete") && (
            <button type="button" aria-label="Supprimer le compte" onClick={remove} className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail">
              <TrashIcon size={16} />
            </button>
          )}
        </div>
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      <dl className="grid grid-cols-3 gap-3">
        {[
          ["Opportunités", String(account.opportunities)],
          ["En cours", money(account.openValue)],
          ["Gagné", money(account.wonValue)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card border border-border bg-card p-4">
            <dt className="text-small text-muted">{label}</dt>
            <dd className="font-mono text-stat font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <section aria-label="Opportunités" className="flex flex-col gap-2">
        <h2 className="text-small font-semibold uppercase tracking-wide text-muted">{opportunitiesLabel(account.opportunities)}</h2>
        {account.leads.length === 0 ? (
          <p className="rounded-card border border-border bg-card p-6 text-small text-muted">Aucune opportunité visible pour vous sur ce compte.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {account.leads.map((l) => {
              const stage = stageOf(stages, l.status);
              return (
                <li key={l.id}>
                  <Link href={ROUTES.lead(l.id)} className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-card p-4 hover:border-ink">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{l.name}</span>
                      <span className="block text-small text-muted">{[l.service, l.city].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="inline-flex h-[22px] items-center gap-1.5 rounded-md border border-border px-2 text-small font-medium">
                      <span aria-hidden className="size-2 rounded-full" style={{ background: stage.color }} />
                      {stage.name}
                    </span>
                    <span className="w-28 text-right font-mono text-small">{money(l.estimatedValue ?? 0)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {adding && (
        <NewOpportunity
          accountId={account.id}
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function NewOpportunity({ accountId, onClose, onCreated }: { accountId: string; onClose: () => void; onCreated: () => void }) {
  const { companyId } = useSession();
  const [name, setName] = useState("");
  const [service, setService] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const estimatedValue = value.trim() ? Math.max(0, Math.floor(Number(value.replace(/\s/g, "")) || 0)) : null;
      await api("/leads", { companyId, body: { name: name.trim(), service: service.trim(), estimatedValue, accountId } });
      onCreated();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };
  return (
    <Modal title="Nouvelle opportunité" description="Une nouvelle affaire avec cette entreprise." onClose={onClose} width="max-w-[440px]">
      <div className="flex flex-col gap-4 p-[18px]">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        <Field label="Nom de l’opportunité" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Acme — site vitrine" />
        <Field label="Service demandé" value={service} onChange={(e) => setService(e.target.value)} maxLength={150} />
        <Field label="Valeur estimée" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} className="font-mono" />
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
