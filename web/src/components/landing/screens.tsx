/* Illustrations des aperçus de l'accueil : des maquettes simplifiées avec des données d'exemple, pas des captures. */
const frame = "glass w-full max-w-[640px] rounded-card p-4 md:p-6";

export function WaveScreen() {
  const regions = [
    { name: "Cotonou Centre", done: 100, token: "--color-forest" },
    { name: "Akpakpa", done: 62, token: "--color-link" },
    { name: "Calavi", done: 8, token: "--color-muted" },
  ];
  return (
    <div className={frame} aria-hidden>
      <p className="font-mono text-caption uppercase text-muted">Vague de la semaine · exemple</p>
      <ul className="mt-4 flex flex-col gap-4">
        {regions.map((r) => (
          <li key={r.name}>
            <div className="flex justify-between text-small">
              <span>{r.name}</span>
              <span className="font-mono text-muted">{r.done} %</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-field">
              <div className="h-2 rounded-full" style={{ width: `${r.done}%`, background: `var(${r.token})` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RouteScreen() {
  const stops = [[40, 170], [140, 70], [260, 120], [380, 40], [470, 140]];
  return (
    <div className={frame} aria-hidden>
      <p className="font-mono text-caption uppercase text-muted">Tournée du jour · exemple</p>
      <svg viewBox="0 0 510 210" className="mt-3 h-40 w-full md:h-52">
        <polyline points={stops.map((s) => s.join(",")).join(" ")} fill="none" stroke="var(--color-link)" strokeWidth={3} strokeDasharray="8 7" strokeLinejoin="round" />
        {stops.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={15} fill="var(--color-accent)" />
            <text x={x} y={y + 5} textAnchor="middle" fontSize={14} fontWeight={600} fill="var(--color-ink)">{i + 1}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function PipelineScreen() {
  const columns = [
    { title: "À contacter", cards: ["Boulangerie du Port", "Pharmacie Étoile", "Garage Zinsou"] },
    { title: "Proposition", cards: ["Hôtel Lagune", "École Sainte-Rita"] },
    { title: "Gagné", cards: ["Café Jardin"] },
  ];
  return (
    <div className={frame} aria-hidden>
      <p className="font-mono text-caption uppercase text-muted">Pipeline · exemple</p>
      <div className="mt-3 grid grid-cols-3 gap-2 md:gap-3">
        {columns.map((c) => (
          <div key={c.title} className="min-w-0 rounded-control bg-field p-2">
            <p className="truncate text-small font-semibold">{c.title}</p>
            {c.cards.map((name) => (
              <p key={name} className="mt-2 truncate rounded-micro border border-border bg-card px-2 py-2 text-caption">{name}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
