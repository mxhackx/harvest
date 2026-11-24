"use client";

import { useCallback, useEffect, useState } from "react";
import { api, describeError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { parseTags, type KbArticle } from "@/lib/support";
import { PencilIcon, PlusIcon, TrashIcon } from "./icons";
import { Button, Field, Modal, Notice, TextArea } from "./ui";

/** Base de connaissances : les réponses fréquentes de l'équipe, qu'on cherche par mot ou par mot-clé. */
export function KbPage() {
  const { me, companyId } = useSession();
  const perms = me.memberships[0].permissions.map((p) => p.permission);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [list, setList] = useState<KbArticle[] | null>(null);
  const [open, setOpen] = useState<KbArticle | null>(null);
  const [editing, setEditing] = useState<KbArticle | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 250);
    return () => clearTimeout(t);
  }, [input]);
  const load = useCallback(() => api<KbArticle[]>(`/kb?q=${encodeURIComponent(q)}`, { companyId }).then(setList).catch((e) => setError(describeError(e))), [companyId, q]);
  useEffect(() => {
    load();
  }, [load]);

  const show = async (a: KbArticle) => setOpen(await api<KbArticle>(`/kb/${a.id}`, { companyId }).catch((e) => (setError(describeError(e)), null)));
  const remove = async (a: KbArticle) => {
    if (!window.confirm(`Supprimer l’article « ${a.title} » ?`)) return;
    await api(`/kb/${a.id}`, { method: "DELETE", companyId }).catch((e) => setError(describeError(e)));
    setOpen(null);
    await load();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-title font-semibold">Base de connaissances</h1>
          <p className="text-small text-muted">Les réponses fréquentes de l’équipe, pour répondre plus vite aux clients.</p>
        </div>
        {perms.includes("kb:create") && (
          <Button className="h-9 w-auto" onClick={() => setEditing("new")}>
            <PlusIcon size={16} /> Nouvel article
          </Button>
        )}
      </div>
      <input type="search" aria-label="Rechercher dans la base de connaissances" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Rechercher un mot, un mot-clé…" className="h-10 w-full max-w-[520px] rounded-full border border-border bg-field px-4 text-body" />
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <ul className="flex flex-col gap-2">
          {list === null ? (
            <li className="text-small text-muted">Chargement…</li>
          ) : list.length === 0 ? (
            <li className="rounded-card border border-border bg-card p-6 text-small text-muted">{q ? "Aucun article ne correspond." : "Aucun article pour l’instant."}</li>
          ) : (
            list.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => show(a)} aria-current={open?.id === a.id} className={`w-full rounded-card border bg-card p-3 text-left hover:border-ink ${open?.id === a.id ? "border-accent" : "border-border"}`}>
                  <span className="font-medium">{a.title}</span>
                  {a.excerpt && <span className="mt-1 line-clamp-2 block text-small text-muted">{a.excerpt}</span>}
                  {a.tags.length > 0 && <span className="mt-2 flex flex-wrap gap-1">{a.tags.map((t) => <span key={t} className="rounded-md bg-field px-2 text-small text-muted">{t}</span>)}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
        <section aria-label="Article" className="min-h-[200px] rounded-card border border-border bg-card p-4">
          {open ? (
            <>
              <div className="flex items-start gap-2">
                <h2 className="flex-1 font-display text-title font-semibold">{open.title}</h2>
                {perms.includes("kb:update") && <button type="button" aria-label="Modifier l’article" onClick={() => setEditing(open)} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-ink"><PencilIcon size={15} /></button>}
                {perms.includes("kb:delete") && <button type="button" aria-label="Supprimer l’article" onClick={() => remove(open)} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-field hover:text-fail"><TrashIcon size={15} /></button>}
              </div>
              <p className="text-small text-muted">Mis à jour le {new Date(open.updatedAt).toLocaleDateString("fr-FR")}</p>
              <div className="mt-3 whitespace-pre-wrap leading-relaxed">{open.body}</div>
            </>
          ) : (
            <p className="text-small text-muted">Choisissez un article à gauche.</p>
          )}
        </section>
      </div>
      {editing && <EditArticle article={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={async (a) => { setEditing(null); setOpen(a); await load(); }} />}
    </div>
  );
}

function EditArticle({ article, onClose, onSaved }: { article: KbArticle | null; onClose: () => void; onSaved: (a: KbArticle) => void }) {
  const { companyId } = useSession();
  const [title, setTitle] = useState(article?.title ?? "");
  const [body, setBody] = useState(article?.body ?? "");
  const [tags, setTags] = useState((article?.tags ?? []).join(", "));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const payload = { title: title.trim(), body: body.trim(), tags: parseTags(tags) };
      onSaved(article ? await api<KbArticle>(`/kb/${article.id}`, { method: "PATCH", companyId, body: payload }) : await api<KbArticle>("/kb", { companyId, body: payload }));
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };
  return (
    <Modal title={article ? "Modifier l’article" : "Nouvel article"} onClose={onClose} width="max-w-[640px]">
      <div className="flex flex-col gap-4 p-[18px]">
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        <Field label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
        <TextArea label="Contenu" rows={10} value={body} onChange={(e) => setBody(e.target.value)} maxLength={20000} />
        <Field label="Mots-clés (séparés par une virgule)" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="facture, connexion, remboursement" />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="sm:w-auto" onClick={onClose}>Annuler</Button>
          <Button className="sm:w-auto" loading={busy} disabled={!title.trim() || !body.trim()} onClick={save}>Enregistrer</Button>
        </div>
      </div>
    </Modal>
  );
}
