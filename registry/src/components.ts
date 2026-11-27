/**
 * Les composants maison, source unique. Après une modification : « npm run registry:build » dans web/, puis commiter
 * registry/public. Un composant ne contient que des nœuds (aucun code) et suit les variables du site : $accent, $fond, $texte.
 */
import type { Props } from "../../web/src/lib/cms/model";

type Raw = { type: string; name: string; props: Props; text?: string; href?: string; textStyle?: string; src?: string; alt?: string; children?: Raw[] };
export type Definition = { name: string; title: string; category: string; description: string; atom: string; version: number; node: Raw };

const frame = (name: string, props: Props, children: Raw[]): Raw => ({ type: "frame", name, props: { direction: "column", gap: 8, ...props }, children });
const row = (name: string, props: Props, children: Raw[]) => frame(name, { direction: "row", gap: 12, align: "center", ...props }, children);
const t = (text: string, textStyle = "body", props: Props = {}): Raw => ({ type: "text", name: "Texte", props, text, textStyle });
const solid: Props = { background: "$accent", color: "$fond", radius: 12, paddingY: 12, paddingX: 22, fontWeight: 600 };
const outline: Props = { color: "$accent", borderColor: "$accent", borderWidth: 2, radius: 12, paddingY: 10, paddingX: 20, fontWeight: 600 };
const btn = (text: string, href: string, props: Props = solid): Raw => ({ type: "button", name: "Bouton", props, text, href });
const img = (props: Props, alt = ""): Raw => ({ type: "image", name: "Image", props: { fit: "cover", radius: 12, ...props }, src: "", alt });
const card: Props = { paddingY: 20, paddingX: 20, radius: 16, borderWidth: 1, borderColor: "$accent" };

const def = (category: string, atom: string) => (name: string, title: string, description: string, node: Raw): Definition => ({ name, title, category, description, atom, version: 1, node });
const action = def("Actions", "Contact");
const label = def("Étiquettes", "Page vitrine");
const cards = def("Cartes", "Catalogue");
const info = def("Informations", "Page vitrine");
const nav = def("Navigation", "Page vitrine");
const promo = def("Mise en avant", "Page vitrine");

export const COMPONENTS: Definition[] = [
  action("bouton-whatsapp", "Bouton WhatsApp", "Ouvre une conversation WhatsApp. Complétez le numéro dans le lien.", btn("Écrire sur WhatsApp", "https://wa.me/")),
  action("bouton-whatsapp-contour", "Bouton WhatsApp (contour)", "La variante discrète du bouton WhatsApp.", btn("Écrire sur WhatsApp", "https://wa.me/", outline)),
  action("bouton-appel", "Bouton d'appel", "Appelle le commerce d'un seul geste.", btn("Appeler", "tel:")),
  action("duo-boutons", "Deux boutons", "Une action principale et une secondaire, empilées sur mobile.", row("Deux boutons", { stack: true, justify: "center" }, [btn("Réserver", "#"), btn("Voir la carte", "#", outline)])),
  label("badge", "Badge", "Une courte étiquette arrondie.", frame("Badge", { align: "flex-start" }, [t("Nouveau", "body", { background: "$accent", color: "$fond", radius: 99, paddingY: 4, paddingX: 12, fontSize: 13, fontWeight: 600 })])),
  label("etat-ouverture", "Ouvert aujourd'hui", "Indique les horaires du jour.", row("Ouverture", { gap: 8 }, [t("●", "body", { color: "$accent" }), t("Ouvert aujourd'hui jusqu'à 23 h")])),
  cards("carte-produit", "Carte produit", "Photo, nom, prix et bouton de commande.", frame("Produit", { ...card, gap: 10 }, [img({ height: 180 }), t("Nom du produit", "label"), t("5 000 F", "label", { color: "$accent" }), btn("Commander", "https://wa.me/")])),
  cards("ligne-plat", "Ligne de menu", "Un plat, sa description et son prix.", row("Plat", { justify: "space-between", paddingY: 10 }, [frame("Détail", { gap: 2 }, [t("Nom du plat", "label"), t("Ingrédients en une ligne", "body", { opacity: 0.7 })]), t("4 000 F", "label", { color: "$accent" })])),
  cards("carte-service", "Carte service", "Un service présenté en trois lignes.", frame("Service", card, [t("Nom du service", "label"), t("Ce que le client obtient, en une ou deux phrases.", "body", { opacity: 0.8 })])),
  cards("carte-avis", "Avis client", "La parole d'un client, avec son nom.", frame("Avis", { ...card, gap: 10 }, [t("★★★★★", "label", { color: "$accent" }), t("« Accueil chaleureux et service rapide. »"), t("Prénom du client", "body", { opacity: 0.7, fontSize: 14 })])),
  cards("membre-equipe", "Membre d'équipe", "Portrait, nom et rôle.", frame("Membre", { align: "center", textAlign: "center" }, [img({ height: 120, maxWidth: 120, radius: 60 }), t("Prénom Nom", "label"), t("Rôle", "body", { opacity: 0.7 })])),
  info("horaires", "Horaires", "Les jours et heures d'ouverture.", frame("Horaires", { ...card, gap: 6 }, ["Lundi – Vendredi · 9 h – 19 h", "Samedi · 10 h – 22 h", "Dimanche · fermé"].map((x) => t(x)))),
  info("adresse", "Adresse et itinéraire", "L'adresse et un lien vers l'itinéraire.", frame("Adresse", { align: "flex-start" }, [t("Nous trouver", "label"), t("Quartier, ville"), btn("Itinéraire", "https://maps.google.com/", outline)])),
  info("reseaux", "Réseaux sociaux", "Des liens vers les comptes du commerce.", row("Réseaux", { justify: "center", gap: 8 }, [btn("Facebook", "https://facebook.com/", outline), btn("Instagram", "https://instagram.com/", outline), btn("TikTok", "https://tiktok.com/", outline)])),
  nav("barre-menu", "Barre de menu", "Le nom et les liens principaux.", row("Menu", { justify: "space-between", stack: true, paddingY: 14, paddingX: 20 }, [t("Nom du commerce", "label"), row("Liens", { gap: 4 }, [btn("Accueil", "/", { paddingY: 8, paddingX: 10, color: "$texte" }), btn("La carte", "/carte", { paddingY: 8, paddingX: 10, color: "$texte" }), btn("Contact", "#contact", solid)])])),
  nav("pied-de-page", "Pied de page", "Nom, contact et mentions légales.", frame("Pied de page", { align: "center", textAlign: "center", paddingY: 32, paddingX: 20 }, [t("Nom du commerce", "label"), t("Cotonou, Bénin", "body", { opacity: 0.7 }), btn("Mentions légales", "/mentions", { color: "$texte", paddingY: 6, paddingX: 6, opacity: 0.7 }), t("© Tous droits réservés", "body", { fontSize: 13, opacity: 0.6 })])),
  promo("bandeau-promo", "Bandeau promotionnel", "Une offre mise en avant sur toute la largeur.", row("Promo", { justify: "center", stack: true, background: "$accent", color: "$fond", paddingY: 14, paddingX: 20 }, [t("Offre du moment : -10 % cette semaine", "label"), btn("J'en profite", "#", { background: "$fond", color: "$accent", radius: 10, paddingY: 8, paddingX: 16, fontWeight: 600 })])),
  promo("appel-action", "Appel à l'action", "Un titre, une phrase et un bouton, centrés.", frame("Appel à l'action", { align: "center", textAlign: "center", paddingY: 48, paddingX: 24, gap: 14 }, [t("Envie de nous rendre visite ?", "h2"), t("Réservez en quelques secondes."), btn("Réserver", "https://wa.me/")])),
  promo("chiffres-cles", "Chiffres clés", "Trois nombres qui parlent.", frame("Chiffres", { columns: 3, gap: 16, paddingY: 24, paddingX: 20, textAlign: "center" }, [["10 ans", "d'expérience"], ["500+", "clients"], ["7 j / 7", "à votre service"]].map(([n, l]) => frame("Chiffre", { gap: 2 }, [t(n, "h2", { color: "$accent" }), t(l, "body", { opacity: 0.7 })])))),
];
