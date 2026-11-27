/** Mêmes limites que l'API (storage/files.ts), pour prévenir avant d'envoyer. */
export const MAX_BYTES = 50 * 1024 * 1024;
export const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

export type Attachment = { id: string; name: string; type: string; size: number; createdAt: string; uploadedByName: string | null };

export function refusal(file: { size: number; type: string }): string | null {
  if (!ACCEPT.includes(file.type)) return "Seules les images (JPEG, PNG, WebP, GIF) et les PDF sont acceptés.";
  if (file.size > MAX_BYTES) return "Ce fichier dépasse 50 Mo.";
  return file.size === 0 ? "Ce fichier est vide." : null;
}

export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
