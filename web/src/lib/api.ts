export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; companyId?: string } = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.companyId ? { "x-company-id": init.companyId } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "unknown");
  return data as T;
}

export type Me = {
  user: { id: string; email: string; name: string; image: string | null };
  memberships: {
    company: { id: string; name: string; sector: string; region: string };
    teamId: string | null;
    roleIds: string[];
    permissions: { permission: string; scope: "own" | "team" | "company" }[];
  }[];
};

/** Messages affichés à l'utilisateur pour les codes d'erreur de l'API. */
export const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  email_taken: "Un compte existe déjà avec cet e-mail.",
  invalid_body: "Vérifiez les champs saisis.",
  forbidden: "Vous n'avez pas le droit de faire cela.",
  not_found: "Introuvable ou hors de votre périmètre.",
  provider_not_configured: "Cette connexion n'est pas encore activée.",
  oauth_state: "La connexion a expiré, réessayez.",
  oauth_failed: "La connexion a échoué, réessayez.",
  email_not_verified: "Votre e-mail n'est pas vérifié chez ce fournisseur.",
  account_exists_use_password:
    "Un compte avec mot de passe existe déjà pour cet e-mail. Connectez-vous avec votre mot de passe.",
};
export const errorMessage = (code?: string | null) =>
  (code && ERROR_MESSAGES[code]) || "Une erreur est survenue, réessayez.";

export const LEAD_STATUSES = ["to_visit", "interested", "mockup_sent", "deposit_paid"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  to_visit: "À visiter",
  interested: "Intéressé",
  mockup_sent: "Maquette envoyée",
  deposit_paid: "Acompte payé",
};

export type Lead = {
  id: string;
  ownerId: string;
  teamId: string | null;
  name: string;
  sector: string;
  address: string;
  contactName: string;
  phone: string;
  status: LeadStatus;
  lat: number | null;
  lng: number | null;
  estimatedValue: number | null;
  visitedAt: string | null;
  createdAt: string;
};

/** Nombre à la française, chiffres tabulaires gérés par la police. Aucune devise supposée. */
export const formatValue = (n: number) => n.toLocaleString("fr-FR");
export const formatDay = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
