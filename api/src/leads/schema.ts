import { z } from "zod";
import { facebookField, googleMapsField, websiteField, whatsappField } from "./fields.js";

export const base = z.object({
  name: z.string().trim().min(1).max(120),
  sector: z.string().trim().max(100),
  address: z.string().trim().max(200),
  city: z.string().trim().max(100),
  landmark: z.string().trim().max(200),
  whatsapp: whatsappField,
  facebook: facebookField,
  website: websiteField,
  googleMapsUrl: googleMapsField,
  contactName: z.string().trim().max(100),
  phone: z.string().trim().max(40),
  // clé d'une étape de l'entreprise : vérifiée par les routes, qui connaissent les étapes
  status: z.string().trim().min(1).max(60),
  lostReason: z.string().trim().max(200),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  estimatedValue: z.number().int().min(0).max(2_000_000_000).nullable(),
  visited: z.boolean(),
  service: z.string().trim().max(150),
  // probabilité propre au lead ; null = on retombe sur celle de l'étape
  probability: z.number().int().min(0).max(100).nullable(),
  // valeurs des champs personnalisés : { identifiant du champ: valeur } ; null efface la valeur (types vérifiés par les routes)
  custom: z.record(z.string().uuid(), z.union([z.string().max(500), z.number(), z.null()])),
  expectedCloseOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date attendue : AAAA-MM-JJ")
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), "date invalide")
    .nullable(),
});
const coordsTogether = (v: { lat?: number | null; lng?: number | null }) =>
  (v.lat === undefined) === (v.lng === undefined) && (v.lat === null) === (v.lng === null);
const coordsMsg = { message: "lat et lng vont ensemble", path: ["lat"] };

export const createBody = base
  .partial()
  .required({ name: true })
  .refine(coordsTogether, coordsMsg);
export const patchBody = base.partial().refine(coordsTogether, coordsMsg);

