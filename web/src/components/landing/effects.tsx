"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * Effets de la page d'accueil. Tout le texte est rendu par le serveur et reste visible sans JavaScript :
 * ces composants ne masquent un élément qu'après leur montage, et jamais si la personne préfère moins d'animations.
 */
const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fait apparaître son contenu quand il entre à l'écran. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    if (still() || el.getBoundingClientRect().top < window.innerHeight) return;
    el.setAttribute("data-hidden", "");
    const seen = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      el.removeAttribute("data-hidden");
      seen.disconnect();
    }, { threshold: 0.15 });
    seen.observe(el);
    return () => seen.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Position d'un élément pendant sa traversée de l'écran : 0 quand son haut arrive en bas, 1 quand il atteint `end`. */
function useScrollProgress(end: number, apply: (progress: number, el: HTMLElement) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(apply);
  useEffect(() => {
    latest.current = apply;
  });
  useEffect(() => {
    if (still()) return;
    const el = ref.current!;
    let frame = 0;
    const update = () => {
      frame = 0;
      const h = window.innerHeight;
      const p = (h - el.getBoundingClientRect().top) / (h * (1 - end));
      latest.current(Math.min(1, Math.max(0, p)), el);
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [end]);
  return ref;
}

/** Grande phrase qui s'allume mot après mot au fil du défilement. */
export function WordReveal({ text, className = "" }: { text: string; className?: string }) {
  const words = text.split(" ");
  const ref = useScrollProgress(0.25, (p, el) => {
    const spans = el.querySelectorAll<HTMLElement>("[data-word]");
    spans.forEach((s, i) => (s.style.opacity = String(Math.min(1, Math.max(0.16, p * (spans.length + 2) - i)))));
  });
  return (
    <div ref={ref}>
      <p className={className}>
        {words.map((w, i) => (
          <span key={i} data-word>
            {w}{" "}
          </span>
        ))}
      </p>
    </div>
  );
}

/** Grande carte penchée en 3D, qui se redresse en arrivant au centre de l'écran. */
export function Tilt({ children }: { children: ReactNode }) {
  const ref = useScrollProgress(0.2, (p, el) => {
    (el.firstElementChild as HTMLElement).style.transform = `rotateX(${(1 - p) * 16}deg) scale(${0.92 + p * 0.08})`;
  });
  return (
    <div ref={ref} style={{ perspective: "1200px" }}>
      <div style={{ transformOrigin: "50% 100%" }}>{children}</div>
    </div>
  );
}

/** Retient la position du pointeur dans l'élément (--x, --y), pour les lueurs en CSS. */
const track = (e: React.PointerEvent<HTMLElement>) => {
  const box = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--x", `${e.clientX - box.left}px`);
  e.currentTarget.style.setProperty("--y", `${e.clientY - box.top}px`);
};

/** Grand panneau éclairé par le pointeur. */
export function Lamp({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`lamp ${className}`} onPointerMove={track}>
      {children}
    </section>
  );
}

/** Carte dont le halo et le liseré suivent le pointeur. */
export function Spot({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`spot rim ${className}`} onPointerMove={track}>
      {children}
    </div>
  );
}

export type Slide = { title: string; text: string; screen: ReactNode };

/** Aperçus qui se succèdent, chacun avec sa barre de progression ; un clic en choisit un et arrête le défilement. */
export function Showcase({ slides }: { slides: Slide[] }) {
  const [at, setAt] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || still()) return;
    const t = setTimeout(() => setAt((i) => (i + 1) % slides.length), 5000);
    return () => clearTimeout(t);
  }, [at, auto, slides.length]);
  return (
    <div className="overflow-hidden bg-card">
      <div className="relative h-72 overflow-hidden md:h-96">
        <div className="aurora" aria-hidden>
          <i />
          <i />
        </div>
        <div key={at} className="rise absolute inset-0 grid place-items-center p-4 md:p-8">{slides[at].screen}</div>
      </div>
      <div className="grid border-t border-rule bg-field md:grid-cols-3">
        {slides.map((s, i) => (
          <button key={s.title} type="button" aria-pressed={i === at} onClick={() => { setAt(i); setAuto(false); }} className={`flex flex-col gap-2 p-5 text-left transition-opacity ${i === at ? "" : "opacity-45 hover:opacity-80"}`}>
            <span className="font-display text-lead font-medium">{s.title}</span>
            <span className="font-mono text-small leading-relaxed text-muted">{s.text}</span>
            <span aria-hidden className="mt-auto block h-px bg-frame">
              {i === at && <span key={`${at}-${auto}`} className={`block h-px bg-ink ${auto ? "fill-bar" : "w-full"}`} />}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
