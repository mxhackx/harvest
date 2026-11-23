export const STATUS_LABEL: Record<string, string> = {
  to_visit: "À visiter",
  interested: "Intéressé",
  mockup_sent: "Maquette envoyée",
  deposit_paid: "Acompte payé",
};

export const EXPORT_COLUMNS = [
  "id",
  "name",
  "status",
  "statusLabel",
  "sector",
  "contactName",
  "phone",
  "whatsapp",
  "facebook",
  "website",
  "googleMapsUrl",
  "address",
  "city",
  "landmark",
  "lat",
  "lng",
  "locationSource",
  "estimatedValue",
  "visited",
  "visitedAt",
  "owner",
  "createdAt",
  "updatedAt",
] as const;

export type ExportRow = Record<(typeof EXPORT_COLUMNS)[number], string | number | boolean | null>;

type LeadLike = {
  id: string;
  name: string;
  status: string;
  sector: string;
  contactName: string;
  phone: string;
  whatsapp: string;
  facebook: string;
  website: string;
  googleMapsUrl: string;
  address: string;
  city: string;
  landmark: string;
  lat: number | null;
  lng: number | null;
  locationSource: string;
  estimatedValue: number | null;
  visitedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toExportRow(l: LeadLike, owner: string): ExportRow {
  return {
    id: l.id,
    name: l.name,
    status: l.status,
    statusLabel: STATUS_LABEL[l.status] ?? l.status,
    sector: l.sector,
    contactName: l.contactName,
    phone: l.phone,
    whatsapp: l.whatsapp,
    facebook: l.facebook,
    website: l.website,
    googleMapsUrl: l.googleMapsUrl,
    address: l.address,
    city: l.city,
    landmark: l.landmark,
    lat: l.lat,
    lng: l.lng,
    locationSource: l.locationSource,
    estimatedValue: l.estimatedValue,
    visited: l.visitedAt !== null,
    visitedAt: l.visitedAt?.toISOString() ?? null,
    owner,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

/**
 * Un tableur interprète « =… », « +… », « -… », « @… » comme une formule : un nom de lead malveillant
 * pourrait exécuter une commande à l'ouverture. On préfixe d'une apostrophe, sauf pour un vrai
 * numéro de téléphone (« +22997001122 »).
 */
export function neutralizeFormula(s: string): string {
  if (!/^[=+\-@\t\r]/.test(s)) return s;
  return /^[+-]?\d[\d ().-]*$/.test(s) ? s : `'${s}`;
}

function cell(v: string | number | boolean | null, delimiter: string): string {
  if (v === null) return "";
  const s = neutralizeFormula(String(v));
  return s.includes(delimiter) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV RFC 4180, avec BOM UTF-8 pour que les accents s'ouvrent correctement dans Excel. */
export function toCsv(rows: ExportRow[], delimiter: "," | ";" = ","): string {
  const lines = [EXPORT_COLUMNS.join(delimiter), ...rows.map((r) => EXPORT_COLUMNS.map((c) => cell(r[c], delimiter)).join(delimiter))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}
