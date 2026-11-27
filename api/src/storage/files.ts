/** Règles des pièces jointes : images et PDF, 50 Mo au plus (mêmes limites côté web). */
export const MAX_BYTES = 50 * 1024 * 1024;
export const MAX_PER_LEAD = 50;
export const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf" };

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));
/** Le type réel d'après les premiers octets : le nom et le type annoncés par le navigateur ne prouvent rien. */
export function sniff(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(b, 1, 4) === "PNG") return "image/png";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp";
  if (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a") return "image/gif";
  if (ascii(b, 0, 5) === "%PDF-") return "application/pdf";
  return null;
}

/** Nom affiché et proposé au téléchargement : sans chemin ni caractères de contrôle. */
export const cleanName = (name: string) => name.replace(/[\u0000-\u001f\u007f/\\]/g, "_").trim().slice(0, 150) || "fichier";
