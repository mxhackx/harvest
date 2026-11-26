/** Photo et coordonnées de l'entreprise. L'API revérifie tout (routes/companies.ts). */
export const LOGO_SIZE = 256;

/** « +229 01 97 00 00 00 » est accepté ; un numéro sans indicatif de pays ne l'est pas. */
export const isInternationalPhone = (raw: string) => /^\+[1-9]\d{7,14}$/.test(raw.replace(/[\s().-]/g, ""));
export const PHONE_HINT = "Avec l'indicatif du pays, ex. +229 01 97 00 00 00";

/** Réduit une photo choisie sur l'appareil en un carré de 256 px (recadré au centre), assez léger pour la base. */
export async function resizeLogo(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(LOGO_SIZE, side);
  canvas.getContext("2d")!.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  image.close();
  // un navigateur sans WebP rend du PNG : les deux formats sont acceptés
  return canvas.toDataURL("image/webp", 0.85);
}
