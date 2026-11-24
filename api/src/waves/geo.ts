import { sql } from "drizzle-orm";
import { db } from "../db/index.js";

/** Distance en km entre le centre d'une région (alias r) et la position d'un lead (alias l) : formule de haversine. */
const DISTANCE = sql.raw(
  "6371 * 2 * asin(sqrt(power(sin(radians(r.lat - l.lat) / 2), 2) + cos(radians(l.lat)) * cos(radians(r.lat)) * power(sin(radians(r.lng - l.lng) / 2), 2)))",
);

/**
 * Range chaque lead dans la plus proche région qui le contient (distance au centre ≤ rayon), ou nulle part.
 * Sans `leadIds`, recalcule tous les leads de l'entreprise (après un changement de région). Un lead sans position
 * n'a pas de région. La région vient toujours de la position : on ne la saisit jamais.
 */
export async function assignRegions(companyId: string, leadIds?: string[]): Promise<void> {
  if (leadIds && leadIds.length === 0) return;
  const only = leadIds ? sql`and l.id in (${sql.join(leadIds.map((id) => sql`${id}`), sql`, `)})` : sql``;
  await db.execute(sql`
    update leads l set region_id = (
      select r.id from regions r
      where r.company_id = l.company_id and ${DISTANCE} <= r.radius_km
      order by ${DISTANCE} asc limit 1
    )
    where l.company_id = ${companyId} and l.lat is not null and l.lng is not null ${only}`);
  await db.execute(sql`
    update leads l set region_id = null
    where l.company_id = ${companyId} and (l.lat is null or l.lng is null) and l.region_id is not null ${only}`);
}
