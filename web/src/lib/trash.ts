/** Jours restants avant l'effacement définitif d'un lead de la corbeille (0 = aujourd'hui, jamais négatif). */
export function daysLeft(purgeAt: string | Date, now = new Date()): number {
  const ms = new Date(purgeAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export const daysLeftLabel = (days: number) => (days === 0 ? "effacé aujourd'hui" : `effacé dans ${days} jour${days > 1 ? "s" : ""}`);
