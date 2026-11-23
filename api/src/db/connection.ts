/**
 * Options de connexion Postgres selon l'URL :
 * - SSL exigé hors base locale (Supabase, Render… refusent le clair) ;
 * - pas de requêtes préparées derrière le pooler Supabase en mode transaction (port 6543).
 */
export function connectionOptions(url: string) {
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  return {
    prepare: !/:6543\//.test(url),
    ssl: local ? (false as const) : ("require" as const),
  };
}

/** Les migrations prennent un verrou de session : impossible derrière le pooler en mode transaction. */
export const isTransactionPooler = (url: string) => /:6543\//.test(url);
