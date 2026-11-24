import { BRAND } from "@/lib/brand";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = `${BRAND.name} — prospection et suivi de leads sur le terrain`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Aperçu affiché quand le lien est partagé (réseaux sociaux, messageries). */
export default async function Image() {
  const logo = await readFile(path.join(process.cwd(), "public/logo.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#ffffff", alignItems: "center", padding: 90, gap: 70 }}>
        <img src={src} width={300} height={300} alt="" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 110, fontWeight: 700, color: "#14222e" }}>{BRAND.name}</div>
          <div style={{ fontSize: 42, color: "#5a6b78", marginTop: 12, maxWidth: 640 }}>Prospection et suivi de leads sur le terrain</div>
        </div>
      </div>
    ),
    size,
  );
}
