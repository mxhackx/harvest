/**
 * Modèle d'un site du CMS : un thème et des blocs. Brouillon d'interface : enregistré dans le navigateur
 * tant que le contrat de la factory et l'API ne sont pas définis (docs/cahier-des-charges-cms.md).
 */
export type BlockType = "hero" | "menu" | "gallery" | "contact" | "whatsapp";
export type Item = { name: string; description: string; price: string };
export type Photo = { src: string; alt: string };
export type Block = {
  id: string;
  type: BlockType;
  hidden: boolean;
  title: string;
  text: string;
  button: string;
  logo: string;
  image: Photo;
  items: Item[];
  photos: Photo[];
  phone: string;
  address: string;
  hours: string;
};
export type Font = "sans" | "display" | "serif" | "mono";
/** Thème du site du client : des données (CMS-02), pas les couleurs de Hivation. */
export type SiteTheme = { accent: string; background: string; ink: string; font: Font; radius: number };
export type Site = { id: string; name: string; theme: SiteTheme; blocks: Block[]; updatedAt: string };

export const BLOCK_LABEL: Record<BlockType, string> = { hero: "En-tête", menu: "Menu / catalogue", gallery: "Galerie", contact: "Contact et horaires", whatsapp: "Bouton WhatsApp" };
export const FONT_LABEL: Record<Font, string> = { sans: "Simple", display: "Moderne", serif: "Élégante", mono: "Machine" };
export const PRESETS: { name: string; theme: SiteTheme }[] = [
  { name: "Nuit", theme: { accent: "#e0a458", background: "#16110d", ink: "#f6efe7", font: "serif", radius: 4 } },
  { name: "Jardin", theme: { accent: "#e8671c", background: "#f4f1e8", ink: "#1f3b2a", font: "serif", radius: 20 } },
  { name: "Clair", theme: { accent: "#0868c9", background: "#ffffff", ink: "#14222e", font: "display", radius: 12 } },
  { name: "Vif", theme: { accent: "#d40f2c", background: "#fff8f6", ink: "#241014", font: "sans", radius: 8 } },
];

const empty: Omit<Block, "id" | "type"> = { hidden: false, title: "", text: "", button: "", logo: "", image: { src: "", alt: "" }, items: [], photos: [], phone: "", address: "", hours: "" };

const DEFAULTS: Record<BlockType, Partial<Block>> = {
  hero: { title: "Nom du restaurant", text: "Une phrase qui donne envie de venir.", button: "Réserver une table" },
  menu: { title: "La carte", items: [{ name: "Poisson braisé", description: "Servi avec attiéké", price: "6000" }, { name: "Poulet bicyclette", description: "Sauce maison", price: "5000" }] },
  gallery: { title: "Galerie" },
  contact: { title: "Nous trouver", address: "Cotonou, Bénin", hours: "Lundi à dimanche, 11 h – 23 h" },
  whatsapp: { title: "Une question ?", button: "Écrire sur WhatsApp", text: "Bonjour, je souhaite réserver." },
};

export const newId = () => Math.random().toString(36).slice(2, 10);
export const newBlock = (type: BlockType): Block => structuredClone({ ...empty, ...DEFAULTS[type], id: newId(), type });

/** Modèles de départ. En ajouter un ici suffit : l'écran « Nouveau site » les propose tous. */
export const TEMPLATES = {
  restaurant: { label: "Restaurant et bar", theme: PRESETS[0].theme, blocks: ["hero", "menu", "gallery", "contact", "whatsapp"] },
  boutique: { label: "Boutique", theme: PRESETS[2].theme, blocks: ["hero", "gallery", "menu", "contact", "whatsapp"] },
  vitrine: { label: "Page simple", theme: PRESETS[1].theme, blocks: ["hero", "contact", "whatsapp"] },
} satisfies Record<string, { label: string; theme: SiteTheme; blocks: BlockType[] }>;
export type TemplateId = keyof typeof TEMPLATES;

export const newSite = (name: string, template: TemplateId = "restaurant"): Site => ({
  id: newId(),
  name,
  theme: { ...TEMPLATES[template].theme },
  blocks: TEMPLATES[template].blocks.map((t) => ({ ...newBlock(t as BlockType), ...(t === "hero" ? { title: name } : {}) })),
  updatedAt: new Date().toISOString(),
});

export function moveBlock(site: Site, id: string, delta: -1 | 1): Site {
  const from = site.blocks.findIndex((b) => b.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= site.blocks.length) return site;
  const blocks = [...site.blocks];
  [blocks[from], blocks[to]] = [blocks[to], blocks[from]];
  return { ...site, blocks };
}

export type Check = { code: string; ok: boolean; text: string; blockId?: string };
const PLACEHOLDER = /lorem ipsum|titre ici|nom du restaurant|\bundefined\b|\bnull\b|une phrase qui donne envie/i;

/** Contrôles de publication, par oui ou non (cahier des charges §11.3) : aucun jugement, aucun modèle. */
export function checkSite(site: Site): Check[] {
  const shown = site.blocks.filter((b) => !b.hidden);
  const hero = shown.find((b) => b.type === "hero");
  const contact = shown.find((b) => b.type === "contact");
  const residue = shown.find((b) => [b.title, b.text, b.button, b.address, ...b.items.flatMap((i) => [i.name, i.description])].some((t) => PLACEHOLDER.test(t)));
  const phones = shown.filter((b) => b.type === "whatsapp" || b.type === "contact");
  const badPhone = phones.find((b) => !/^\+[1-9]\d{7,14}$/.test(b.phone.replace(/[\s().-]/g, "")));
  const noAlt = shown.find((b) => (b.image.src && !b.image.alt.trim()) || b.photos.some((p) => !p.alt.trim()));
  return [
    { code: "C04", ok: !!hero?.logo, text: "Logo présent", blockId: hero?.id },
    { code: "C05", ok: !!contact && !badPhone && !!contact.hours.trim() && !!contact.address.trim(), text: "Téléphone avec indicatif, horaires et adresse", blockId: badPhone?.id ?? contact?.id },
    { code: "C06", ok: !residue, text: "Aucun texte de remplacement", blockId: residue?.id },
    { code: "C11", ok: !noAlt, text: "Texte alternatif sur chaque image", blockId: noAlt?.id },
  ];
}

const key = (companyId: string) => `hivation.cms.${companyId}`;
export function loadSites(companyId: string): Site[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(companyId)) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
/** false quand le navigateur refuse (stockage plein, navigation privée). */
export function saveSites(companyId: string, sites: Site[]): boolean {
  try {
    localStorage.setItem(key(companyId), JSON.stringify(sites));
    return true;
  } catch {
    return false;
  }
}

/** Réduit une photo avant de la garder dans le navigateur. */
export async function resizeImage(file: File, max = 900): Promise<string> {
  const image = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * k);
  canvas.height = Math.round(image.height * k);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return canvas.toDataURL("image/webp", 0.8);
}
