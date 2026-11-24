export type SearchResults = {
  leads: { id: string; name: string; city: string; sector: string }[];
  contacts: { id: string; name: string; email: string; phone: string; leadId: string; leadName: string }[];
  tasks: { id: string; title: string; leadId: string | null }[];
};

export const MIN_QUERY = 2;

/** Texte à chercher, ou null s'il est trop court : on n'interroge pas l'API pour une seule lettre. */
export const cleanQuery = (raw: string): string | null => {
  const q = raw.trim();
  return q.length >= MIN_QUERY ? q : null;
};

export const isEmpty = (r: SearchResults) => r.leads.length + r.contacts.length + r.tasks.length === 0;
