const KEY = "harvest.company";

/** Entreprise choisie sur cet appareil (un compte peut appartenir à plusieurs). Sans stockage : la première. */
export function getActiveCompanyId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setActiveCompanyId(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* navigation privée : le choix ne sera simplement pas retenu */
  }
}

/** Met l'entreprise active en première position (le reste de l'application lit `memberships[0]`). Id inconnu : ordre inchangé. */
export function withActiveFirst<T extends { company: { id: string } }>(memberships: T[], activeId: string | null): T[] {
  const i = memberships.findIndex((m) => m.company.id === activeId);
  return i <= 0 ? memberships : [memberships[i], ...memberships.slice(0, i), ...memberships.slice(i + 1)];
}
