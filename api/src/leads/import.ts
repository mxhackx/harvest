import { CsvError, parseCsv } from "./csv.js";
import { DEFAULT_STAGES } from "../stages/defaults.js";
import { createBody } from "./schema.js";

export const MAX_IMPORT_ROWS = 1000;

export class ImportError extends Error {
  constructor(
    public code: "empty" | "too_many_rows" | "invalid_json" | "invalid_csv" | "unknown_format" | "no_name_column",
    message: string,
  ) {
    super(message);
  }
}

/** Champs que l'import comprend, avec les noms de colonne acceptés (accents et casse ignorés). */
export const IMPORT_FIELDS = {
  name: ["name", "nom", "entreprise", "company", "societe", "raisonsociale"],
  sector: ["sector", "secteur", "activite"],
  contactName: ["contactname", "contact", "nomducontact", "interlocuteur"],
  phone: ["phone", "telephone", "tel", "mobile"],
  whatsapp: ["whatsapp", "numerowhatsapp"],
  facebook: ["facebook", "pagefacebook", "fb"],
  website: ["website", "site", "siteweb", "siteinternet", "url"],
  googleMapsUrl: ["googlemapsurl", "googlemaps", "liengooglemaps", "maps", "lienmaps"],
  address: ["address", "adresse", "rue"],
  city: ["city", "ville", "commune"],
  landmark: ["landmark", "repere", "reperes", "precisions"],
  lat: ["lat", "latitude"],
  lng: ["lng", "lon", "long", "longitude"],
  estimatedValue: ["estimatedvalue", "valeur", "valeurestimee", "montant"],
  status: ["status", "statut", "etape", "stage"],
  visited: ["visited", "visite", "dejavisite"],
  visitedAt: ["visitedat", "datevisite", "datedevisite", "visitele"],
} as const;

export type ImportField = keyof typeof IMPORT_FIELDS;

/** Colonnes présentes dans un export Hivation : reconnues mais volontairement non réimportées. */
export const EXPORT_ONLY = ["id", "statuslabel", "locationsource", "owner", "createdat", "updatedat", "lostreason", "closedat"];

export const normalizeHeader = (h: string) =>
  h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const HEADER_TO_FIELD = new Map<string, ImportField>();
for (const [field, names] of Object.entries(IMPORT_FIELDS)) for (const n of names) HEADER_TO_FIELD.set(n, field as ImportField);

/** Anciens noms et abréviations acceptés, valables si l'étape visée existe dans l'entreprise. */
const LEGACY_STATUS: Record<string, string> = {
  tovisit: "to_visit",
  avisiter: "to_visit",
  interested: "interested",
  interesse: "interested",
  mockupsent: "mockup_sent",
  maquetteenvoyee: "mockup_sent",
  maquette: "mockup_sent",
  depositpaid: "deposit_paid",
  acomptepaye: "deposit_paid",
  paye: "deposit_paid",
};

export type StatusResolver = { resolve: (raw: string) => string | undefined; names: string[] };

/** Reconnaît une étape par sa clé ou son nom (accents et casse ignorés) parmi celles de l'entreprise. */
export function makeStatusResolver(stages: { key: string; name: string }[]): StatusResolver {
  const byName = new Map<string, string>();
  for (const s of stages) {
    byName.set(normalizeHeader(s.key), s.key);
    byName.set(normalizeHeader(s.name), s.key);
  }
  const keys = new Set(stages.map((s) => s.key));
  return {
    names: stages.map((s) => s.name),
    resolve: (raw) => {
      const n = normalizeHeader(raw);
      return byName.get(n) ?? (LEGACY_STATUS[n] && keys.has(LEGACY_STATUS[n]) ? LEGACY_STATUS[n] : undefined);
    },
  };
}

export const defaultStatusResolver = makeStatusResolver(DEFAULT_STAGES);

export type RawRecord = { line: number; data: Record<string, unknown> };
export type Parsed = { records: RawRecord[]; ignoredColumns: string[]; format: "csv" | "json" };

export function detectFormat(content: string): "csv" | "json" {
  return /^[\s﻿]*[[{]/.test(content) ? "json" : "csv";
}

/** Associe les en-têtes aux champs ; renvoie aussi les colonnes ignorées. */
function mapHeaders(headers: string[]) {
  const ignored: string[] = [];
  const mapped = headers.map((h) => {
    const key = normalizeHeader(h);
    const field = HEADER_TO_FIELD.get(key);
    if (!field && key) ignored.push(h.trim());
    return field ?? null;
  });
  return { mapped, ignored };
}

export function parseImport(content: string, format?: "csv" | "json"): Parsed {
  if (!content.trim()) throw new ImportError("empty", "Le fichier est vide.");
  const fmt = format ?? detectFormat(content);

  if (fmt === "json") {
    let json: unknown;
    try {
      json = JSON.parse(content.replace(/^﻿/, ""));
    } catch (e) {
      throw new ImportError("invalid_json", `JSON invalide : ${(e as Error).message}`);
    }
    const items = Array.isArray(json) ? json : (json as { leads?: unknown })?.leads;
    if (!Array.isArray(items)) {
      throw new ImportError("invalid_json", "Le JSON doit être un tableau de leads, ou un objet { \"leads\": [ … ] }.");
    }
    if (items.length === 0) throw new ImportError("empty", "Le fichier ne contient aucun lead.");
    if (items.length > MAX_IMPORT_ROWS) throw new ImportError("too_many_rows", `${items.length} leads : la limite est de ${MAX_IMPORT_ROWS} par import.`);
    const ignored = new Set<string>();
    const records = items.map((item, i): RawRecord => {
      if (item === null || typeof item !== "object" || Array.isArray(item)) return { line: i + 1, data: { __invalid: true } };
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(item)) {
        const key = normalizeHeader(k);
        const field = HEADER_TO_FIELD.get(key);
        if (field) data[field] = v;
        else if (key && !EXPORT_ONLY.includes(key)) ignored.add(k);
      }
      return { line: i + 1, data };
    });
    return { records, ignoredColumns: [...ignored], format: "json" };
  }

  let rows;
  try {
    rows = parseCsv(content);
  } catch (e) {
    if (e instanceof CsvError) throw new ImportError("invalid_csv", `CSV invalide : ${e.message}`);
    throw e;
  }
  if (rows.length < 2) throw new ImportError("empty", "Le CSV doit contenir une ligne d'en-tête puis au moins un lead.");
  const { mapped, ignored } = mapHeaders(rows[0].fields);
  if (!mapped.includes("name")) {
    throw new ImportError("no_name_column", "Aucune colonne « name » (ou « nom ») dans l'en-tête : impossible d'identifier les leads.");
  }
  const body = rows.slice(1);
  if (body.length > MAX_IMPORT_ROWS) throw new ImportError("too_many_rows", `${body.length} lignes : la limite est de ${MAX_IMPORT_ROWS} par import.`);
  const records = body.map(({ fields, line }): RawRecord => {
    const data: Record<string, unknown> = {};
    mapped.forEach((field, i) => {
      if (field && fields[i] !== undefined) data[field] = fields[i];
    });
    return { line, data };
  });
  return { records, ignoredColumns: ignored.filter((c) => !EXPORT_ONLY.includes(normalizeHeader(c))), format: "csv" };
}

export type RowIssue = { line: number; field?: string; message: string };

const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
const text = (v: unknown) => (blank(v) ? "" : String(v).trim());

function toBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1 ? true : v === 0 ? false : undefined;
  const s = normalizeHeader(String(v));
  if (["true", "1", "oui", "yes", "vrai", "o", "y", "x"].includes(s)) return true;
  if (["false", "0", "non", "no", "faux", "n"].includes(s)) return false;
  return undefined;
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const n = Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export type CleanRow = {
  line: number;
  data: ReturnType<typeof createBody.parse>;
  visitedAt: Date | null;
};

type ZodIssueLike = { code: string; message: string; path: PropertyKey[]; maximum?: unknown; minimum?: unknown };

/** Les messages de nos propres validateurs sont déjà en français ; on traduit ceux de Zod. */
function frenchIssue(i: ZodIssueLike): string {
  const field = String(i.path[0] ?? "");
  if (i.code === "invalid_type") return "champ obligatoire";
  if (i.code === "too_small" && i.minimum === 1) return "champ obligatoire";
  if (field === "lat" || field === "lng") return field === "lat" ? "latitude hors limites (−90 à 90)" : "longitude hors limites (−180 à 180)";
  if (i.code === "too_big") return `trop long (${i.maximum} caractères au plus)`;
  return i.message;
}

/** Convertit une ligne brute (texte) en lead valide, ou la liste de ses problèmes. */
export function cleanRow(rec: RawRecord, statuses: StatusResolver = defaultStatusResolver): { row?: CleanRow; issues: RowIssue[] } {
  const issues: RowIssue[] = [];
  const add = (field: string, message: string) => issues.push({ line: rec.line, field, message });
  if (rec.data.__invalid) return { issues: [{ line: rec.line, message: "cette entrée n'est pas un objet JSON" }] };
  const d = rec.data;
  const candidate: Record<string, unknown> = {};

  for (const f of ["name", "sector", "contactName", "phone", "whatsapp", "facebook", "website", "googleMapsUrl", "address", "city", "landmark"] as const) {
    if (!blank(d[f])) candidate[f] = text(d[f]);
  }

  if (!blank(d.status)) {
    const key = statuses.resolve(String(d.status));
    if (key) candidate.status = key;
    else add("status", `étape inconnue « ${text(d.status)} » (attendu : ${statuses.names.join(", ")})`);
  }

  const latBlank = blank(d.lat);
  const lngBlank = blank(d.lng);
  if (latBlank !== lngBlank) add("lat", "latitude et longitude vont ensemble");
  else if (!latBlank) {
    const lat = toNumber(d.lat);
    const lng = toNumber(d.lng);
    if (lat === undefined) add("lat", `latitude invalide « ${text(d.lat)} »`);
    else candidate.lat = lat;
    if (lng === undefined) add("lng", `longitude invalide « ${text(d.lng)} »`);
    else candidate.lng = lng;
  }

  if (!blank(d.estimatedValue)) {
    const raw = typeof d.estimatedValue === "number" ? String(d.estimatedValue) : text(d.estimatedValue).replace(/[\s _]/g, "");
    if (/^\d+([.,]0+)?$/.test(raw)) candidate.estimatedValue = Math.round(Number(raw.replace(",", ".")));
    else add("estimatedValue", `valeur invalide « ${text(d.estimatedValue)} » (nombre entier positif attendu)`);
  }

  let visitedAt: Date | null = null;
  if (!blank(d.visitedAt)) {
    const t = Date.parse(text(d.visitedAt));
    if (Number.isNaN(t)) add("visitedAt", `date de visite invalide « ${text(d.visitedAt)} » (format AAAA-MM-JJ attendu)`);
    else visitedAt = new Date(t);
  }
  if (!blank(d.visited)) {
    const b = toBool(d.visited);
    if (b === undefined) add("visited", `valeur « ${text(d.visited)} » incompréhensible (oui/non, true/false)`);
    else if (!b) visitedAt = null;
    else candidate.visited = true;
  }

  if (issues.length) return { issues };
  const parsed = createBody.safeParse(candidate);
  if (!parsed.success) {
    for (const i of parsed.error.issues) add(String(i.path[0] ?? "name"), frenchIssue(i));
    return { issues };
  }
  return { row: { line: rec.line, data: parsed.data, visitedAt }, issues };
}

/**
 * Clé de doublon : même nom, même téléphone, même adresse (casse et espaces ignorés). Le numéro « (n) » ajouté
 * aux noms identiques est ignoré, sinon réimporter un fichier recréerait les leads déjà renumérotés.
 */
export const duplicateKey = (l: { name: string; phone?: string; address?: string }) =>
  [l.name.replace(/\s*\(\d+\)\s*$/, "") || l.name, (l.phone ?? "").replace(/\D/g, ""), l.address ?? ""]
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
