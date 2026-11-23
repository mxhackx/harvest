/**
 * Adresse de retour après connexion : uniquement un chemin interne du site. `//evil.com`, `/\evil.com`
 * ou une URL absolue enverraient l'utilisateur ailleurs (redirection ouverte) : ils sont refusés.
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  return raw;
}
