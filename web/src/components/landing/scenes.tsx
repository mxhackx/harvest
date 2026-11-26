/* Mini-scènes animées des cartes de fonctions : des illustrations (aria-hidden), le sens est dans le titre et le texte. */
const stage = "relative flex h-48 items-center justify-center overflow-hidden px-5";
const chip = "rounded-control border border-border bg-field px-3 py-2 text-caption";
const delay = (s: number) => ({ animationDelay: `${s}s` });

function Map() {
  return (
    <svg viewBox="0 0 300 160" className="h-full w-full">
      <path d="M20 130 C 70 130, 60 50, 120 60 S 180 130, 215 95 S 250 30, 280 40" fill="none" stroke="var(--color-link)" strokeWidth={2.5} pathLength={100} className="dash" />
      {[[20, 130], [120, 60], [215, 95], [280, 40]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={8} fill="var(--color-accent)" className="pulse" style={delay(i * 0.6)} />
          <circle cx={x} cy={y} r={5} fill="var(--color-ink)" />
        </g>
      ))}
    </svg>
  );
}

function Pipeline() {
  return (
    <div className="w-full">
      <div className="grid grid-cols-3 gap-2 text-caption text-muted">
        {["Contacté", "Proposition", "Gagné"].map((t) => <span key={t} className="truncate">{t}</span>)}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div className="hop rounded-control border border-accent bg-accent-soft px-2 py-3 text-caption font-medium">Café Jardin</div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => <span key={i} className="h-9 rounded-control border border-border bg-field" />)}
      </div>
    </div>
  );
}

function Reminders() {
  return (
    <ul className="flex w-full flex-col gap-2">
      {["Rappeler la pharmacie · 09:00", "Envoyer le devis à l’hôtel", "Repasser à Akpakpa vendredi"].map((t, i) => (
        <li key={t} className={`pop flex items-center gap-2 ${chip}`} style={delay(i * 0.5)}>
          <span className="size-2 shrink-0 rounded-full bg-forest" />
          <span className="truncate">{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Team() {
  const people = [["CEO", 50, 12], ["MA", 18, 62], ["KO", 82, 62], ["SE", 50, 84]] as const;
  return (
    <div className="relative size-40">
      <svg viewBox="0 0 100 100" className="absolute inset-0">
        {people.slice(1).map(([id, x, y]) => <line key={id} x1={50} y1={12} x2={x} y2={y} stroke="var(--color-frame)" strokeDasharray="3 3" />)}
        <circle cx={50} cy={12} r={9} fill="var(--color-accent)" className="pulse" />
      </svg>
      {people.map(([id, x, y], i) => (
        <span key={id} className={`absolute flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-caption font-semibold ${i === 0 ? "border-accent bg-accent" : "border-frame bg-field"}`} style={{ left: `${x}%`, top: `${y}%` }}>
          {id}
        </span>
      ))}
    </div>
  );
}

function Chat() {
  return (
    <div className="flex w-full flex-col gap-2">
      <p className={`pop self-end rounded-control bg-accent px-3 py-2 text-caption`}>Bonjour Awa, je passe demain à 10 h ?</p>
      <p className={`pop self-start ${chip}`} style={delay(1.1)}>Parfait, à demain.</p>
      <p className="pop self-end text-caption text-muted" style={delay(2)}>Inscrit dans le fil du lead ✓</p>
    </div>
  );
}

function Reports() {
  return (
    <div className="flex h-32 w-full items-end gap-2">
      {[34, 52, 41, 68, 59, 82, 100].map((h, i) => (
        <span key={i} className="grow flex-1 rounded-t-micro" style={{ height: `${h}%`, background: `linear-gradient(var(--color-link), var(--color-glow-deep))`, ...delay(i * 0.12) }} />
      ))}
    </div>
  );
}

const SCENES = [Map, Pipeline, Reminders, Team, Chat, Reports];

/** Scène de la i-ième fonction de l'accueil. */
export function Scene({ index }: { index: number }) {
  const Visual = SCENES[index % SCENES.length];
  return (
    <div aria-hidden className={stage}>
      <Visual />
    </div>
  );
}
