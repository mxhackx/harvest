export type Account = { id: string; name: string; sector: string; website: string; notes: string; opportunities: number; openValue: number; wonValue: number };
export type AccountDetail = Account & { leads: { id: string; name: string; status: string; estimatedValue: number | null; city: string; service: string }[] };

/** Montant en francs, avec espaces entre les milliers ; « — » quand il n'y a rien. */
export const money = (n: number): string => (n > 0 ? n.toLocaleString("fr-FR") : "—");

export const opportunitiesLabel = (n: number): string => (n === 0 ? "Aucune opportunité" : n === 1 ? "1 opportunité" : `${n} opportunités`);
