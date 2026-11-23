export type Point = { lat: number; lng: number };

/**
 * Distance approchée entre deux points, en degrés « aplatis » : la longitude est réduite par cos(latitude)
 * pour ne pas surestimer les écarts est-ouest. Suffisant pour ordonner un parcours à l'échelle d'une ville.
 */
function distance(a: Point, b: Point, k: number): number {
  return Math.hypot((a.lat - b.lat), (a.lng - b.lng) * k);
}

const pathLength = (p: Point[], k: number) => p.slice(1).reduce((sum, pt, i) => sum + distance(p[i], pt, k), 0);

/**
 * Ordre de parcours reliant tous les points : on part du point le plus à l'ouest, on enchaîne toujours
 * le plus proche, puis une passe « 2-opt » retourne les tronçons qui se croisent. Déterministe, et le
 * résultat n'est jamais plus long que l'enchaînement simple.
 */
export function orderRoute<T extends Point>(points: T[]): T[] {
  if (points.length < 3) return [...points];
  const meanLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const k = Math.cos((meanLat * Math.PI) / 180);

  const rest = [...points].sort((a, b) => a.lng - b.lng || a.lat - b.lat);
  const path = [rest.shift()!];
  while (rest.length) {
    const last = path[path.length - 1];
    let best = 0;
    for (let i = 1; i < rest.length; i++) if (distance(last, rest[i], k) < distance(last, rest[best], k)) best = i;
    path.push(rest.splice(best, 1)[0]);
  }

  // 2-opt sur un chemin ouvert : on retourne [i..j] si cela raccourcit le parcours.
  // Plafonné : au-delà de quelques centaines de points l'amélioration ne vaut pas le temps de calcul.
  if (path.length <= 400) {
    let improved = true;
    let rounds = 0;
    while (improved && rounds++ < 50) {
      improved = false;
      for (let i = 1; i < path.length - 1; i++) {
        for (let j = i + 1; j < path.length; j++) {
          const before = distance(path[i - 1], path[i], k) + (j < path.length - 1 ? distance(path[j], path[j + 1], k) : 0);
          const after = distance(path[i - 1], path[j], k) + (j < path.length - 1 ? distance(path[i], path[j + 1], k) : 0);
          if (after < before - 1e-12) {
            path.splice(i, j - i + 1, ...path.slice(i, j + 1).reverse());
            improved = true;
          }
        }
      }
    }
  }
  return path;
}

export { pathLength };

/** Coordonnées GeoJSON [lng, lat] du parcours, prêtes pour une couche « ligne ». */
export const routeLine = (points: Point[]): [number, number][] => orderRoute(points).map((p) => [p.lng, p.lat]);
