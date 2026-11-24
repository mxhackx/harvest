/**
 * Adresse de l'API : absolue en développement (http://localhost:4000), ou relative (« /api ») quand le site relaie
 * l'API sous son propre domaine (voir next.config.ts).
 */
import { queueGesture } from "./offline";
import { isQueueable } from "./offline-rules";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

/** Adresse de démarrage d'une connexion Google / GitHub, que l'API soit sur un autre domaine ou relayée par le site. */
export function oauthStartUrl(provider: "google" | "github", origin: string, apiUrl: string = API_URL): string {
  const base = /^https?:\/\//.test(apiUrl) ? apiUrl : `${origin}${apiUrl}`;
  const url = new URL(`${base}/auth/${provider}`);
  url.searchParams.set("returnTo", origin);
  return url.toString();
}

export type ApiIssue = { message: string; path: (string | number)[] };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public issues: ApiIssue[] = [],
  ) {
    super(code);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; companyId?: string } = {}): Promise<T> {
  const method = init.method ?? (init.body ? "POST" : "GET");
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.companyId ? { "x-company-id": init.companyId } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch (e) {
    // Pas de réseau : « visité », l'étape et les notes attendent le retour de la connexion au lieu d'échouer
    if (e instanceof TypeError && isQueueable({ method, path, body: init.body })) {
      await queueGesture({ method, path, body: init.body, companyId: init.companyId ?? "" });
      return { queued: true } as T;
    }
    throw e;
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "unknown", (data as { issues?: ApiIssue[] }).issues ?? []);
  return data as T;
}

export type Me = {
  user: { id: string; email: string; name: string; image: string | null; emailReminders: boolean };
  memberships: {
    company: { id: string; name: string; sector: string; region: string };
    teamId: string | null;
    team: { id: string; name: string } | null;
    roleIds: string[];
    roles: { id: string; key: string; name: string }[];
    joinedAt: string;
    permissions: { permission: string; scope: "own" | "team" | "company" }[];
  }[];
};

/** Messages affichés à l'utilisateur pour les codes d'erreur de l'API. */
export const ERROR_MESSAGES: Record<string, string> = {
  invalid_reset: "Ce lien est invalide, expiré ou déjà utilisé. Redemandez un e-mail.",
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  email_taken: "Un compte existe déjà avec cet e-mail.",
  invalid_body: "Vérifiez les champs saisis.",
  forbidden: "Vous n'avez pas le droit de faire cela.",
  stage_exists: "Une étape porte déjà ce nom.",
  quote_locked: "Ce devis est envoyé : il ne peut plus être modifié ni supprimé.",
  quote_transition: "Ce changement de statut n'est pas possible.",
  quote_empty: "Ajoutez au moins une ligne avant d'envoyer le devis.",
  account_exists: "Un compte porte déjà ce nom.",
  lead_has_account: "Ce lead est déjà rattaché à un compte.",
  field_exists: "Un champ porte déjà ce nom.",
  too_many_fields: "Vingt champs personnalisés au plus.",
  region_exists: "Une région porte déjà ce nom.",
  region_in_use: "Cette région a des vagues : elle garde leur historique et ne peut pas être supprimée.",
  mail_failed: "L’e-mail n’a pas pu partir (service d’envoi indisponible). Vous pouvez l’ouvrir dans votre messagerie.",
  email_limit: "Limite d’e-mails atteinte pour aujourd’hui (100 par personne et par jour).",
  wave_closed: "Cette vague est clôturée : elle ne peut plus être modifiée.",
  too_many_stages: "Vingt étapes au plus.",
  last_open_stage: "Il faut garder au moins une étape ouverte.",
  not_found: "Introuvable ou hors de votre périmètre.",
  template_exists: "Un modèle porte déjà ce nom.",
  too_many_templates: "Cent modèles au plus.",
  segment_exists: "Vous avez déjà un segment de ce nom.",
  too_many_segments: "Trente segments au plus.",
  already_member: "Cette personne fait déjà partie de l'entreprise.",
  invalid_invitation: "Cette invitation est invalide, expirée ou déjà utilisée.",
  invitation_other_email: "Cette invitation est destinée à une autre adresse e-mail.",
  invitation_roles_gone: "Les rôles de cette invitation n'existent plus. Demandez-en une nouvelle.",
  unknown_role: "Un des rôles n'existe pas dans cette entreprise.",
  unknown_team: "Cette équipe n'existe pas dans cette entreprise.",
  privilege_escalation: "Vous ne pouvez pas accorder des droits que vous n'avez pas vous-même.",
  last_ceo: "Il doit rester au moins un CEO.",
  user_not_found: "Aucun compte avec cet e-mail.",
  provider_not_configured: "Cette connexion n'est pas encore activée.",
  oauth_state: "La connexion a expiré, réessayez.",
  oauth_failed: "La connexion a échoué, réessayez.",
  email_not_verified: "Votre e-mail n'est pas vérifié chez ce fournisseur.",
  account_exists_use_password:
    "Un compte avec mot de passe existe déjà pour cet e-mail. Connectez-vous avec votre mot de passe.",
};
export const errorMessage = (code?: string | null) =>
  (code && ERROR_MESSAGES[code]) || "Une erreur est survenue, réessayez.";

export type Lead = {
  id: string;
  /** région où tombe sa position (déduite des coordonnées) */
  regionId: string | null;
  /** compte (entreprise cliente) dont ce lead est une opportunité */
  accountId: string | null;
  /** valeurs des champs personnalisés : { identifiant du champ: valeur } */
  custom: Record<string, string | number>;
  ownerId: string;
  teamId: string | null;
  name: string;
  sector: string;
  address: string;
  city: string;
  landmark: string;
  whatsapp: string;
  facebook: string;
  website: string;
  googleMapsUrl: string;
  /** "", "manual", "address" (approximative) ou "google_maps" */
  locationSource: string;
  contactName: string;
  phone: string;
  /** clé d'une étape du pipeline de l'entreprise (voir lib/stages.ts) */
  status: string;
  lostReason: string;
  closedAt: string | null;
  lat: number | null;
  lng: number | null;
  estimatedValue: number | null;
  /** service demandé (texte libre) */
  service: string;
  /** probabilité propre au lead, 0–100 ; null = celle de l'étape */
  probability: number | null;
  /** date de conclusion espérée, « AAAA-MM-JJ » */
  expectedCloseOn: string | null;
  /** échéance la plus proche des tâches ouvertes du lead (liste des leads seulement) */
  nextFollowUpAt?: string | null;
  visitedAt: string | null;
  createdAt: string;
};

/** Nombre à la française, chiffres tabulaires gérés par la police. Aucune devise supposée. */
export const formatValue = (n: number) => n.toLocaleString("fr-FR");
export const formatDay = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

/** N'affiche jamais un lien qui ne soit pas http(s) : un `javascript:` enregistré ne doit pas devenir cliquable. */
export function safeHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

export type LeadLink = { key: "whatsapp" | "facebook" | "website" | "maps"; label: string; href: string };

/** Les canaux renseignés d'un lead, prêts à être affichés. */
export function leadLinks(l: Pick<Lead, "whatsapp" | "facebook" | "website" | "googleMapsUrl">): LeadLink[] {
  const out: LeadLink[] = [];
  const digits = l.whatsapp.replace(/\D/g, "");
  if (digits.length >= 6) out.push({ key: "whatsapp", label: "WhatsApp", href: `https://wa.me/${digits}` });
  const fb = safeHttpUrl(l.facebook);
  if (fb) out.push({ key: "facebook", label: "Facebook", href: fb });
  const web = safeHttpUrl(l.website);
  if (web) out.push({ key: "website", label: "Site web", href: web });
  const maps = safeHttpUrl(l.googleMapsUrl);
  if (maps) out.push({ key: "maps", label: "Google Maps", href: maps });
  return out;
}

export const LOCATION_SOURCE_NOTE: Record<string, string> = {
  address: "Position approximative, déduite de l'adresse.",
  google_maps: "Position déduite du lien Google Maps.",
};

const FIELD_LABEL: Record<string, string> = {
  name: "Nom",
  sector: "Secteur",
  contactName: "Contact",
  phone: "Téléphone",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  website: "Site web",
  googleMapsUrl: "Lien Google Maps",
  address: "Adresse",
  city: "Ville",
  landmark: "Repère",
  lat: "Position",
  estimatedValue: "Valeur estimée",
};

/** Premier champ refusé par l'API, en français ; sinon le message générique du code d'erreur. */
export function describeError(e: unknown): string {
  // fichier d'import inutilisable : l'API fournit déjà une phrase précise
  if (e instanceof ApiError && e.code.startsWith("import_") && e.message !== e.code) return e.message;
  if (e instanceof ApiError && e.issues.length) {
    const i = e.issues[0];
    const field = FIELD_LABEL[String(i.path[0])];
    return field ? `${field} : ${i.message}` : errorMessage(e.code);
  }
  return errorMessage(e instanceof ApiError ? e.code : null);
}

/** Télécharge l'export des leads (CSV ou JSON) avec la session en cours. */
export async function downloadLeads(opts: {
  format: "csv" | "json";
  delimiter?: "," | ";";
  ids?: string[];
  companyId: string;
}): Promise<void> {
  const res = await fetch(`${API_URL}/leads/export`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-company-id": opts.companyId },
    body: JSON.stringify({ format: opts.format, delimiter: opts.delimiter ?? ",", ids: opts.ids }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (data as { error?: string }).error ?? "unknown");
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `leads.${opts.format}`;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Télécharge un fichier renvoyé par l'API (en-tête content-disposition) : export RGPD d'un contact, calendrier .ics… */
export async function downloadFrom(path: string, companyId: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { credentials: "include", headers: { "x-company-id": companyId } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (data as { error?: string }).error ?? "unknown");
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Message affiché après la création ou la modification d'un lead : dit clairement s'il est sur la carte. */
export function savedMessage(l: Pick<Lead, "lat" | "lng" | "locationSource">, mode: "created" | "updated"): string {
  const located = l.lat !== null && l.lng !== null;
  if (mode === "updated") return located ? "Lead mis à jour." : "Lead mis à jour. Il n'a toujours pas de position sur la carte.";
  if (!located) return "Lead ajouté, mais sans position : il n'apparaît pas encore sur la carte. Précisez l'adresse ou placez-le sur la carte.";
  if (l.locationSource === "address") return "Lead ajouté et placé sur la carte depuis son adresse (position approximative).";
  if (l.locationSource === "google_maps") return "Lead ajouté et placé sur la carte depuis son lien Google Maps.";
  return "Lead ajouté et placé sur la carte.";
}

// ---------- Calendrier ----------
export const EVENT_KINDS = ["visit", "call", "followup", "other"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export const EVENT_KIND_LABEL: Record<EventKind, string> = { visit: "Visite", call: "Appel", followup: "Relance", other: "Autre" };

export type CalEvent = {
  id: string;
  title: string;
  kind: EventKind;
  startsAt: string;
  /** null = durée non précisée */
  endsAt: string | null;
  notes: string;
  done: boolean;
  leadId: string | null;
  leadName: string | null;
  ownerId: string;
};

// ---------- Import ----------
export type ImportReport = {
  dryRun: boolean;
  format: "csv" | "json";
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  duplicateLines: { line: number; name: string }[];
  errors: { line: number; field?: string; message: string }[];
  errorsTruncated: boolean;
  ignoredColumns: string[];
  preview: { line: number; name: string; status: string; address: string; hasPosition: boolean; toLocate: boolean }[];
  imported: number;
  locating: number;
};

/** Erreur d'import lisible : l'API renvoie un `message` en français pour un fichier inutilisable. */
export async function importLeads(opts: { content: string; format?: "csv" | "json"; dryRun: boolean; companyId: string }): Promise<ImportReport> {
  const res = await fetch(`${API_URL}/leads/import`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-company-id": opts.companyId },
    body: JSON.stringify({ content: opts.content, format: opts.format, dryRun: opts.dryRun }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new ApiError(res.status, (data as { error?: string }).error ?? "unknown", (data as { issues?: ApiIssue[] }).issues ?? []);
    if (typeof (data as { message?: string }).message === "string") err.message = (data as { message: string }).message;
    throw err;
  }
  return data as ImportReport;
}
