"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, describeError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { TrashIcon, PencilIcon } from "./icons";
import { Button, Field, Modal, Notice, Panel, Select } from "./ui";

type Member = { id: string; userId: string; name: string; email: string; teamId: string | null; roleIds: string[] };
type Role = { id: string; key: string; name: string };
type Team = { id: string; name: string };
type Invitation = { id: string; email: string; roleIds: string[]; teamId: string | null; expiresAt: string };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

function RolePicker({ roles, value, onChange }: { roles: Role[]; value: string[]; onChange: (ids: string[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-small font-semibold">Rôles</legend>
      {roles.map((r) => (
        <label key={r.id} className="flex min-h-8 items-center gap-2 text-body">
          <input
            type="checkbox"
            className="size-4 accent-accent"
            checked={value.includes(r.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, r.id] : value.filter((x) => x !== r.id))}
          />
          {r.name}
        </label>
      ))}
    </fieldset>
  );
}

/** Équipe : membres (rôles, équipe), invitations par lien, équipes. Chaque action n'apparaît que si l'on en a le droit. */
export function TeamPage() {
  const { me, companyId } = useSession();
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const can = (p: string) => perms.includes(p);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [roleDraft, setRoleDraft] = useState<string[]>([]);
  const [link, setLink] = useState<{ email: string; url: string; emailSent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [invite, setInvite] = useState({ email: "", roleId: "", teamId: "" });

  const load = useCallback(() => {
    const get = <T,>(path: string, set: (v: T) => void) => api<T>(path, { companyId }).then(set).catch(() => {});
    get<Member[]>("/members", setMembers);
    get<Role[]>("/roles", setRoles);
    get<Team[]>("/teams", setTeams);
    if (perms.includes("member:create")) get<Invitation[]>("/invitations", setInvites);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);
  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      setError(null);
      load();
    } catch (e) {
      setError(describeError(e));
    }
  }

  // rôle proposé par défaut : le moins privilégié, jamais « CEO » par inadvertance
  const defaultRoleId = (roles.find((r) => r.key === "prospecteur") ?? roles.find((r) => r.key === "worker") ?? roles[0])?.id ?? "";
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "—";
  const teamLabel = (id: string | null) => teams.find((t) => t.id === id)?.name ?? "Sans équipe";
  const inviteUrl = (token: string) => `${window.location.origin}/invitation?token=${encodeURIComponent(token)}`;

  async function createInvite(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ email: string; token: string; emailSent?: boolean }>("/invitations", {
        method: "POST",
        body: { email: invite.email, roleIds: [invite.roleId || defaultRoleId], teamId: invite.teamId || null },
        companyId,
      });
      setLink({ email: r.email, url: inviteUrl(r.token), emailSent: !!r.emailSent });
      setCopied(false);
      setInvite({ email: "", roleId: "", teamId: "" });
      setError(null);
      load();
    } catch (err) {
      setError(describeError(err));
    }
  }

  if (members === null) return <p className="text-small text-muted">Chargement…</p>;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-title font-semibold">Équipe</h1>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}

      <Panel title="Membres" description={`${members.length} personne${members.length > 1 ? "s" : ""} dans l'entreprise`} flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-body">
            <thead>
              <tr className="border-b border-rule text-left text-small font-medium text-muted">
                <th className="px-4 py-2">Nom</th>
                <th className="px-4 py-2">Rôles</th>
                <th className="px-4 py-2">Équipe</th>
                <th className="w-24 px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2">
                    <p className="font-medium">{m.name}{m.userId === me.user.id && <span className="ml-2 text-small text-muted">(vous)</span>}</p>
                    <p className="text-small text-muted">{m.email}</p>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {m.roleIds.map((id) => (
                        <span key={id} className="inline-flex h-[22px] items-center rounded-md bg-forest-soft px-[9px] text-small font-bold text-forest">{roleName(id)}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {can("member:update") ? (
                      <select
                        aria-label={`Équipe de ${m.name}`}
                        value={m.teamId ?? ""}
                        onChange={(e) => run(() => api(`/members/${m.id}/team`, { method: "PUT", body: { teamId: e.target.value || null }, companyId }))}
                        className="h-9 rounded-control border border-border bg-field px-2 text-small"
                      >
                        <option value="">Sans équipe</option>
                        {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                      </select>
                    ) : (
                      teamLabel(m.teamId)
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      {can("member:update") && (
                        <button type="button" aria-label={`Modifier les rôles de ${m.name}`} onClick={() => { setEditing(m); setRoleDraft(m.roleIds); }} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-ink">
                          <PencilIcon size={15} />
                        </button>
                      )}
                      {can("member:delete") && m.userId !== me.user.id && (
                        <button
                          type="button"
                          aria-label={`Retirer ${m.name}`}
                          onClick={() => window.confirm(`Retirer ${m.name} de l'entreprise ? Ses leads restent à son nom : pensez à les réattribuer.`) && run(() => api(`/members/${m.id}`, { method: "DELETE", companyId }))}
                          className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail"
                        >
                          <TrashIcon size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {can("member:create") && (
        <Panel title="Inviter quelqu'un" description="Un e-mail avec le lien part vers la personne invitée ; vous pouvez aussi copier le lien. Il ne marche que pour cette adresse, pendant 7 jours.">
          <form onSubmit={createInvite} className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <Field label="E-mail" type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
            <Select label="Rôle" value={invite.roleId || defaultRoleId} onChange={(e) => setInvite({ ...invite, roleId: e.target.value })} options={roles.map((r) => ({ value: r.id, label: r.name }))} />
            <Select label="Équipe" value={invite.teamId} onChange={(e) => setInvite({ ...invite, teamId: e.target.value })} options={[{ value: "", label: "Sans équipe" }, ...teams.map((t) => ({ value: t.id, label: t.name }))]} />
            <Button type="submit" className="w-auto" disabled={roles.length === 0}>Créer le lien</Button>
          </form>
          {link && (
            <div className="mt-4 flex flex-col gap-2 rounded-card border border-border bg-field/40 p-3">
              <p className="text-small text-muted">
                {link.emailSent ? <>Un e-mail avec le lien est parti vers {link.email}. Vous pouvez aussi le copier — affiché une seule fois :</> : <>L’e-mail n’a pas pu partir : transmettez ce lien à {link.email} vous-même — affiché une seule fois :</>}
              </p>
              <div className="flex gap-2">
                <input readOnly aria-label="Lien d'invitation" value={link.url} onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-control border border-border bg-card px-3 font-mono text-small" />
                <Button type="button" variant="secondary" className="w-auto" onClick={() => navigator.clipboard.writeText(link.url).then(() => setCopied(true)).catch(() => {})}>
                  {copied ? "Copié" : "Copier"}
                </Button>
              </div>
            </div>
          )}
          {invites.length > 0 && (
            <ul className="mt-4 divide-y divide-rule">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2 text-small">
                  <span className="min-w-0 flex-1 truncate">{i.email}</span>
                  <span className="text-muted">{i.roleIds.map(roleName).join(", ")} · expire le {fmtDate(i.expiresAt)}</span>
                  <button type="button" aria-label={`Annuler l'invitation de ${i.email}`} onClick={() => run(() => api(`/invitations/${i.id}`, { method: "DELETE", companyId }))} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail">
                    <TrashIcon size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Panel title="Équipes" description="Une équipe partage ses leads selon la portée des droits de ses membres.">
        <ul className="divide-y divide-rule">
          {teams.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate text-body">{t.name}</span>
              <span className="text-small text-muted">{members.filter((m) => m.teamId === t.id).length} membre(s)</span>
              {can("team:update") && (
                <button type="button" aria-label={`Renommer ${t.name}`} onClick={() => { const name = window.prompt("Nouveau nom de l'équipe", t.name)?.trim(); if (name) run(() => api(`/teams/${t.id}`, { method: "PATCH", body: { name }, companyId })); }} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-ink">
                  <PencilIcon size={15} />
                </button>
              )}
              {can("team:delete") && (
                <button type="button" aria-label={`Supprimer ${t.name}`} onClick={() => window.confirm(`Supprimer l'équipe « ${t.name} » ? Ses membres n'auront plus d'équipe.`) && run(() => api(`/teams/${t.id}`, { method: "DELETE", companyId }))} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail">
                  <TrashIcon size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
        {can("team:create") && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = teamName.trim();
              if (name) run(() => api("/teams", { method: "POST", body: { name }, companyId })).then(() => setTeamName(""));
            }}
          >
            <input aria-label="Nom de la nouvelle équipe" placeholder="Nouvelle équipe" value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={100} className="h-10 min-w-0 flex-1 rounded-control border border-border bg-field px-3 text-body" />
            <Button type="submit" variant="secondary" className="w-auto" disabled={!teamName.trim()}>Créer</Button>
          </form>
        )}
      </Panel>

      {editing && (
        <Modal title={`Rôles de ${editing.name}`} description="Plusieurs rôles se cumulent : la portée la plus large l'emporte." onClose={() => setEditing(null)} width="max-w-[440px]">
          <div className="flex flex-col gap-4">
            <RolePicker roles={roles} value={roleDraft} onChange={setRoleDraft} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" className="w-auto" onClick={() => setEditing(null)}>Annuler</Button>
              <Button className="w-auto" disabled={roleDraft.length === 0} onClick={() => { const m = editing; setEditing(null); run(() => api(`/members/${m.id}/roles`, { method: "PUT", body: { roleIds: roleDraft }, companyId })); }}>
                Enregistrer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
