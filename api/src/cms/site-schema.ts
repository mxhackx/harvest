import { z } from "zod";

/**
 * Forme d'un site du CMS (le web : lib/cms/model.ts). Vérifiée à chaque enregistrement : ce contenu sera publié, il ne
 * doit contenir que des types et des valeurs connus.
 */
export const MAX_NODES = 1500;
export const MAX_SITE_BYTES = 4_000_000;
const MAX_DEPTH = 20;

const value = z.union([z.string().max(60), z.number().finite(), z.boolean()]);
type Node = { id: string; type: string; name: string; children?: Node[]; [k: string]: unknown };
const node: z.ZodType<Node> = z.lazy(() =>
  z
    .object({
      id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
      type: z.enum(["frame", "text", "button", "image", "form"]),
      name: z.string().max(80),
      hidden: z.boolean().optional(),
      props: z.record(z.string().max(30), value),
      text: z.string().max(5000).optional(),
      href: z.string().max(500).optional(),
      src: z.string().regex(/^(data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*)?$/).optional(),
      alt: z.string().max(300).optional(),
      textStyle: z.string().max(40).optional(),
      children: z.array(node).max(200).optional(),
    })
    .strict(),
);

const count = (n: Node, depth: number): number => {
  if (depth > MAX_DEPTH) return MAX_NODES + 1;
  return 1 + (n.children ?? []).reduce((s, c) => s + count(c, depth + 1), 0);
};

export const siteData = z
  .object({
    name: z.string().trim().min(1).max(60),
    variables: z.array(z.object({ name: z.string().max(40), value: z.string().max(20) })).max(30),
    styles: z.array(z.object({ id: z.string().max(40), name: z.string().max(60), font: z.string().max(20), fontSize: z.number().finite(), fontWeight: z.number().finite(), lineHeight: z.number().finite() })).max(30),
    pages: z.array(z.object({ id: z.string().max(40), name: z.string().max(80), path: z.string().regex(/^[a-z0-9-]{0,60}$/), root: node })).min(1).max(30),
  })
  .superRefine((site, ctx) => {
    if (site.pages.reduce((s, p) => s + count(p.root, 1), 0) > MAX_NODES) ctx.addIssue({ code: "custom", message: "site trop grand", path: ["pages"] });
    if (new Set(site.pages.map((p) => p.path)).size !== site.pages.length) ctx.addIssue({ code: "custom", message: "deux pages ont la même adresse", path: ["pages"] });
  });
export type SiteData = z.infer<typeof siteData>;
