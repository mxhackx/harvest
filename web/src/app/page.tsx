import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { appHref } from "@/lib/hosts";
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
  { title: "Prospectez par vagues", text: "Une région à la fois : la carte, la liste et le calendrier vous disent où aller et qui relancer." },
  { title: "Relancez et mesurez", text: "Rien n'est oublié, et les rapports montrent ce qui convertit." },
];

const SOON = ["Devis, factures et paiements", "Gestion de projets clients", "Agents IA pour automatiser le travail répétitif"];

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

export default function HomePage() {
  const button = "inline-flex h-11 items-center justify-center rounded-control px-5 text-body font-medium";
  return (
    <div className="min-h-dvh bg-page text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
      <header className="mx-auto flex h-16 w-full max-w-[1080px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3" aria-label={BRAND.name}>
          <Image src="/logo.svg" alt="" width={32} height={32} priority />
          <span className="font-display text-brand font-semibold">{BRAND.name}</span>
        </Link>
        <nav aria-label="Navigation principale" className="flex items-center gap-5 text-small font-medium">
          <Link href="/docs" className="hover:underline">Documentation</Link>
          <Link href={appHref("/login")} className="hover:underline">Se connecter</Link>
          <Link href={appHref(ROUTES.home)} className={`${button} hidden h-10 bg-accent text-white hover:bg-accent-press sm:inline-flex`}>Ouvrir l’application</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto flex w-full max-w-[1080px] flex-col items-start gap-6 px-6 pb-16 pt-14 md:pt-20">
          <p className="rounded-full bg-accent-soft px-3 py-1 text-small font-medium text-accent-press">Le CRM de terrain pour prospecter par vagues</p>
          <h1 className="max-w-[760px] font-display text-hero-sm font-bold leading-hero tracking-display md:text-hero">
            Prospectez une région à la fois. N’oubliez plus aucun lead.
          </h1>
          <p className="max-w-[640px] text-lead leading-relaxed text-muted">
            {BRAND.name} réunit la carte de tournée, le pipeline, les relances et les rapports. Vous savez où aller, qui rappeler et ce qui rapporte.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href={appHref("/login")} className={`${button} bg-accent text-white hover:bg-accent-press`}>Commencer</Link>
            <Link href="/docs" className={`${button} border border-frame bg-card hover:bg-field`}>Lire la documentation</Link>
          </div>
        </section>

        <section aria-labelledby="fonctions" className="border-t border-rule bg-field">
          <div className="mx-auto w-full max-w-[1080px] px-6 py-16">
            <h2 id="fonctions" className="font-display text-heading font-bold tracking-display">Tout ce qu’il faut pour suivre vos prospects</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="rounded-card border border-border bg-card p-5">
                  <h3 className="text-body font-semibold">{f.title}</h3>
                  <p className="mt-2 text-small leading-relaxed text-muted">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="methode" className="mx-auto w-full max-w-[1080px] px-6 py-16">
          <h2 id="methode" className="font-display text-heading font-bold tracking-display">Une méthode en trois temps</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-forest-soft font-mono text-body font-semibold text-forest">{i + 1}</span>
                <h3 className="text-body font-semibold">{s.title}</h3>
                <p className="text-small leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="bientot" className="border-t border-rule">
          <div className="mx-auto w-full max-w-[1080px] px-6 py-16">
            <h2 id="bientot" className="font-display text-heading font-bold tracking-display">En préparation</h2>
            <p className="mt-2 max-w-[620px] text-small text-muted">
              {BRAND.name} grandit au-delà de la prospection. Ces modules ne sont pas encore disponibles.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {SOON.map((t) => (
                <li key={t} className="rounded-full border border-frame px-4 py-2 text-small">{t}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-ink text-white">
          <div className="mx-auto flex w-full max-w-[1080px] flex-col items-start gap-4 px-6 py-14">
            <h2 className="font-display text-heading font-bold tracking-display">Prêt pour votre prochaine vague ?</h2>
            <Link href={appHref("/login")} className={`${button} bg-white text-ink hover:bg-field`}>Créer mon espace</Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-[1080px] flex-wrap items-center justify-between gap-3 px-6 py-8 text-small text-muted">
        <span>© {BRAND.name}</span>
        <nav aria-label="Pied de page" className="flex gap-5">
          <Link href="/docs" className="hover:underline">Documentation</Link>
          <Link href={appHref("/login")} className="hover:underline">Connexion</Link>
        </nav>
      </footer>
    </div>
  );
}
