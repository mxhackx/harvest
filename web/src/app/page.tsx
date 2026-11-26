import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { appHref, docsHref } from "@/lib/hosts";
import { ContactBubble } from "@/components/contact-bubble";
import { Reveal, Showcase, Spot, Tilt, WordReveal } from "@/components/landing/effects";
import { PipelineScreen, RouteScreen, WaveScreen } from "@/components/landing/screens";
import { ROUTES } from "@/lib/routes";
import { SITE, jsonLd, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Prospection et suivi de leads sur le terrain",
  description: SITE.description,
  path: "/",
});

const FEATURES: { title: string; text: string }[] = [
  { title: "Carte de tournée", text: "Chaque lead est placé sur la carte, depuis son adresse ou un lien Google Maps. Vous visitez zone par zone, sans revenir sur vos pas." },
  { title: "Pipeline sur mesure", text: "Vos étapes, vos couleurs, vos probabilités. Glissez un lead d'une étape à l'autre, avec le motif de perte quand il est abandonné." },
  { title: "Tâches et relances", text: "Une tâche, une échéance, une priorité, une personne. Le retard se voit, et chaque lead affiche son prochain suivi." },
  { title: "Équipe et droits", text: "Invitez par e-mail, choisissez les rôles, attribuez les leads. Chacun ne voit que ce que son rôle lui permet." },
  { title: "Messages en un clic", text: "Des modèles WhatsApp et e-mail préremplis avec le nom du contact. Chaque envoi est inscrit dans le fil du lead." },
  { title: "Rapports clairs", text: "Pipeline en valeur, entonnoir par étape, activité par commercial et raisons de perte, sur la période de votre choix." },
];

const STEPS: { title: string; text: string }[] = [
  { title: "Rassemblez vos leads", text: "Saisissez-les sur le terrain ou importez un fichier CSV ou JSON. Les doublons sont repérés." },
  { title: "Prospectez par vagues", text: "Définissez vos régions, planifiez une vague par semaine avec un objectif de visites : l’outil sait quelle région est faite, laquelle reste, et ce qu’il faut repasser." },
  { title: "Relancez et mesurez", text: "Rien n'est oublié, et les rapports montrent ce qui convertit." },
];

const SOON = ["Paiements en ligne et comptabilité", "Agents IA qui exécutent vos workflows", "Affiliés et commissions"];

const CHIPS = ["Vagues de prospection", "Tournées", "Carte", "Pipeline", "Tâches", "Devis", "Factures", "Tickets", "Hors connexion", "Équipe et droits", "Rapports", "WhatsApp et e-mail"];

const SLIDES = [
  { title: "Vagues par région", text: "Une région à la fois : ce qui est fait, ce qui reste, ce qu’il faut repasser.", screen: <WaveScreen /> },
  { title: "Tournées optimisées", text: "Choisissez les visites : l’itinéraire les met dans le bon ordre.", screen: <RouteScreen /> },
  { title: "Pipeline sur mesure", text: "Vos étapes et vos probabilités, de la première visite à la signature.", screen: <PipelineScreen /> },
];

const structured = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE.name,
  description: SITE.description,
  url: SITE.url,
  inLanguage: "fr",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
};

const label = "font-mono text-caption uppercase tracking-wide text-muted";
const title = "font-display text-heading font-medium tracking-display md:text-hero-sm md:leading-hero";

export default function HomePage() {
  const button = "inline-flex h-12 items-center justify-center rounded-card px-6 text-body font-semibold transition-transform hover:-translate-y-0.5";
  const primary = `${button} bg-ink text-page`;
  const ghost = `${button} glass text-ink hover:bg-field`;
  const wrap = "mx-auto w-full max-w-[1180px] px-6";
  return (
    <div className="landing min-h-dvh overflow-x-clip">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />

      <header className="fixed inset-x-0 top-0 z-30 px-4 pt-4 md:px-10 md:pt-8">
        <div className="glass mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-3 rounded-card px-4 md:px-5">
          <Link href="/" className="flex items-center gap-3" aria-label={BRAND.name}>
            <Image src="/logo.svg" alt="" width={30} height={30} priority />
            <span className="font-display text-lead font-semibold">{BRAND.name}</span>
          </Link>
          <nav aria-label="Navigation principale" className="flex items-center gap-5 text-small font-medium md:gap-8">
            <a href="#fonctions" className="hidden text-muted hover:text-ink md:inline">Fonctions</a>
            <a href="#methode" className="hidden text-muted hover:text-ink md:inline">Méthode</a>
            <Link href={docsHref("/docs")} className="hidden text-muted hover:text-ink sm:inline">Documentation</Link>
            <Link href={appHref("/login")} className="text-muted hover:text-ink">Se connecter</Link>
            <Link href={appHref(ROUTES.home)} className="hidden h-10 items-center rounded-control bg-ink px-4 font-semibold text-page sm:inline-flex">Ouvrir l’application</Link>
          </nav>
        </div>
      </header>

      <main>
        <div className="p-2 md:p-6">
          <section className="grain relative grid min-h-[calc(100svh-3rem)] place-items-center overflow-hidden rounded-card border border-rule px-6 py-32 text-center">
            <div className="aurora" aria-hidden>
              <i />
              <i />
              <i />
            </div>
            <div className="relative z-10 flex max-w-[980px] flex-col items-center gap-7">
              <p className={label}>
                <span className="typed">{"{ le CRM de terrain }"}</span>
              </p>
              <h1 className="rise text-balance font-display text-hero-sm font-medium leading-hero tracking-display md:text-display">
                Prospectez une région à la fois. <span className="shine">N’oubliez plus aucun lead.</span>
              </h1>
              <p className="rise max-w-[620px] font-mono text-small leading-relaxed text-muted [animation-delay:150ms] md:text-body">
                {BRAND.name} réunit la carte de tournée, le pipeline, les relances et les rapports. Vous savez où aller, qui rappeler et ce qui rapporte.
              </p>
              <div className="rise flex flex-wrap justify-center gap-3 pt-4 [animation-delay:300ms]">
                <Link href={appHref("/login")} className={primary}>Commencer</Link>
                <Link href={docsHref("/docs")} className={ghost}>Lire la documentation</Link>
              </div>
            </div>
          </section>
        </div>

        <ul aria-label="Ce que contient l’application" className={`${wrap} flex flex-wrap justify-center gap-3 py-20`}>
          {CHIPS.map((c, i) => (
            <li key={c}>
              <Reveal delay={i * 45}>
                <span className="block rounded-full border border-border bg-card px-4 py-2 font-mono text-caption uppercase transition-colors hover:border-accent-press hover:text-accent-press">{c}</span>
              </Reveal>
            </li>
          ))}
        </ul>

        <section className={`${wrap} grid gap-8 py-16 md:grid-cols-[1.6fr_1fr] md:items-end`}>
          <Reveal>
            <p className={label}>{"{ terrain }"}</p>
            <h2 className={`${title} mt-4`}>Pensé pour celles et ceux qui vont voir leurs clients</h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="font-mono text-small leading-relaxed text-muted">
              Un lead se saisit devant la boutique, se place sur la carte et rejoint la vague en cours. Sans réseau, vous lisez vos fiches et marquez vos visites : tout part au retour de la connexion.
            </p>
          </Reveal>
        </section>

        <section className="relative grid min-h-[80svh] place-items-center overflow-hidden px-6 py-24 text-center">
          <div className="stars" aria-hidden />
          <WordReveal text="Savoir où aller, qui rappeler et ce qui rapporte." className="relative max-w-[1000px] font-display text-hero-sm font-medium leading-hero tracking-display md:text-display" />
        </section>

        <section aria-labelledby="apercu" className={`${wrap} py-16`}>
          <h2 id="apercu" className={`${title} mb-10 text-center`}>De la région à la signature</h2>
          <Tilt>
            <Showcase slides={SLIDES} />
          </Tilt>
        </section>

        <section aria-labelledby="fonctions" className={`${wrap} scroll-mt-28 py-16`}>
          <p className={label}>{"{ fonctions }"}</p>
          <h2 id="fonctions" className={`${title} mt-4 max-w-[720px] scroll-mt-28`}>Tout ce qu’il faut pour suivre vos prospects</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <li key={f.title}>
                <Reveal delay={(i % 3) * 100} className="h-full">
                  <Spot className="h-full min-h-52 rounded-card border border-border bg-card p-6 transition-colors hover:border-frame">
                    <div className="relative flex h-full flex-col justify-end gap-3">
                      <h3 className="font-display text-lead font-medium">{f.title}</h3>
                      <p className="font-mono text-small leading-relaxed text-muted">{f.text}</p>
                    </div>
                  </Spot>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="methode" className={`${wrap} scroll-mt-28 py-16`}>
          <p className={label}>{"{ méthode }"}</p>
          <h2 id="methode" className={`${title} mt-4 scroll-mt-28`}>Une méthode en trois temps</h2>
          <ol className="mt-10">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-t border-rule">
                <Reveal>
                  <div className="grid gap-3 py-8 md:grid-cols-[120px_1fr_1fr] md:items-baseline">
                    <span className="font-mono text-small text-accent-press">0{i + 1}</span>
                    <h3 className="font-display text-heading font-medium tracking-display">{s.title}</h3>
                    <p className="font-mono text-small leading-relaxed text-muted">{s.text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="bientot" className={`${wrap} py-16`}>
          <h2 id="bientot" className={title}>En préparation</h2>
          <p className="mt-3 max-w-[620px] font-mono text-small text-muted">{BRAND.name} grandit au-delà de la prospection. Ces modules ne sont pas encore disponibles.</p>
          <ul className="mt-6 flex flex-wrap gap-3">
            {SOON.map((t) => (
              <li key={t} className="rounded-full border border-frame px-4 py-2 text-small">{t}</li>
            ))}
          </ul>
        </section>

        <div className="p-2 md:p-6">
          <section className="grain relative overflow-hidden rounded-card border border-rule px-6 py-28 text-center">
            <div className="aurora" aria-hidden>
              <i />
              <i />
              <i />
            </div>
            <Reveal className="relative z-10 flex flex-col items-center gap-8">
              <h2 className="font-display text-hero-sm font-medium leading-hero tracking-display md:text-hero">Prêt pour votre prochaine vague ?</h2>
              <Link href={appHref("/login")} className={primary}>Créer mon espace</Link>
            </Reveal>
          </section>
        </div>
      </main>

      <footer className={`${wrap} flex flex-wrap items-center justify-between gap-3 py-10 pb-28 text-small text-muted`}>
        <span>© {BRAND.name}</span>
        <nav aria-label="Pied de page" className="flex gap-5">
          <Link href={docsHref("/docs")} className="hover:text-ink">Documentation</Link>
          <Link href={appHref("/login")} className="hover:text-ink">Connexion</Link>
        </nav>
      </footer>
      <ContactBubble />
    </div>
  );
}
