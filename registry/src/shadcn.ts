/**
 * Versions « données » des composants de shadcn/ui (https://ui.shadcn.com, licence MIT, © 2023 shadcn) : leur allure,
 * reconstruite avec les nœuds du CMS. Ce n'est pas leur code React. La licence est publiée dans public/licenses.txt.
 * Les composants interactifs (dialogue, onglets, accordéon, menu déroulant) demandent du code : ils n'y sont pas.
 */
import type { Props } from "../../web/src/lib/cms/model";
import type { Definition } from "./components";

type Raw = Definition["node"];
const frame = (name: string, props: Props, children: Raw[]): Raw => ({ type: "frame", name, props: { direction: "column", gap: 8, ...props }, children });
const row = (name: string, props: Props, children: Raw[]) => frame(name, { direction: "row", gap: 8, align: "center", ...props }, children);
const t = (text: string, props: Props = {}, textStyle = "body"): Raw => ({ type: "text", name: "Texte", props, text, textStyle });
const muted: Props = { opacity: 0.65, fontSize: 14 };
const line = "$texte/15";

const base: Props = { radius: 8, paddingY: 9, paddingX: 16, fontSize: 14, fontWeight: 500, borderWidth: 1 };
const VARIANTS: Record<string, Props> = {
  default: { ...base, background: "$texte", color: "$fond", borderColor: "$texte" },
  secondary: { ...base, background: "$texte/10", color: "$texte", borderColor: "$texte/10" },
  outline: { ...base, color: "$texte", borderColor: line },
  ghost: { ...base, color: "$texte", borderColor: "$texte/0" },
  destructive: { ...base, background: "#dc2626", color: "#ffffff", borderColor: "#dc2626" },
  link: { ...base, color: "$accent", borderColor: "$texte/0", paddingX: 0 },
};
const btn = (text: string, variant = "default", href = "#"): Raw => ({ type: "button", name: "Bouton", props: VARIANTS[variant], text, href });
const pill: Props = { radius: 99, paddingY: 2, paddingX: 10, fontSize: 12, fontWeight: 600, borderWidth: 1 };
const badge = (text: string, props: Props): Raw => frame("Badge", { align: "flex-start" }, [t(text, { ...pill, ...props })]);
const card: Props = { radius: 12, borderWidth: 1, borderColor: line, paddingY: 24, paddingX: 24 };
const separator: Raw = frame("Séparateur", { height: 1, background: line }, []);
const avatar: Raw = { type: "image", name: "Image", props: { height: 44, maxWidth: 44, radius: 99, fit: "cover" }, src: "", alt: "" };

const def = (name: string, title: string, description: string, node: Raw): Definition => ({ name: `shadcn-${name}`, title, category: "shadcn/ui", description, atom: "Page vitrine", version: 1, node, origin: "shadcn/ui" });

export const SHADCN: Definition[] = [
  def("bouton", "Button", "Bouton principal, plein.", btn("Continuer")),
  def("bouton-secondaire", "Button · secondary", "Bouton secondaire, fond atténué.", btn("Annuler", "secondary")),
  def("bouton-contour", "Button · outline", "Bouton à contour fin.", btn("En savoir plus", "outline")),
  def("bouton-discret", "Button · ghost", "Bouton sans fond ni contour.", btn("Plus tard", "ghost")),
  def("bouton-destructif", "Button · destructive", "Bouton pour une action à risque.", btn("Annuler la réservation", "destructive")),
  def("bouton-lien", "Button · link", "Un lien présenté comme un bouton.", btn("Voir les détails →", "link")),
  def("badge", "Badge", "Étiquette pleine.", badge("Nouveau", { background: "$texte", color: "$fond", borderColor: "$texte" })),
  def("badge-contour", "Badge · outline", "Étiquette à contour.", badge("Disponible", { borderColor: line })),
  def("carte", "Card", "Titre, description, contenu et actions.", frame("Card", { ...card, gap: 16 }, [frame("En-tête", { gap: 4 }, [t("Titre de la carte", {}, "label"), t("Une courte description.", muted)]), t("Le contenu principal de la carte."), row("Pied", { justify: "flex-end" }, [btn("Annuler", "outline"), btn("Confirmer")])])),
  def("carte-statistique", "Card · statistique", "Un chiffre et son évolution.", frame("Statistique", { ...card, gap: 4 }, [t("Réservations ce mois", muted), t("128", {}, "h2"), t("+ 12 % par rapport au mois dernier", muted)])),
  def("alerte", "Alert", "Un message d'information.", frame("Alert", { ...card, paddingY: 14, paddingX: 16, gap: 4 }, [t("Bon à savoir", {}, "label"), t("Réservation conseillée le week-end.", muted)])),
  def("alerte-destructive", "Alert · destructive", "Un avertissement.", frame("Alert", { ...card, borderColor: "#dc2626", color: "#dc2626", paddingY: 14, paddingX: 16, gap: 4 }, [t("Fermeture exceptionnelle", {}, "label"), t("Le commerce sera fermé ce lundi.", { fontSize: 14 })])),
  def("avatar", "Avatar", "Portrait rond avec nom et rôle.", row("Avatar", { gap: 12 }, [avatar, frame("Identité", { gap: 0 }, [t("Prénom Nom", {}, "label"), t("Responsable", muted)])])),
  def("separateur", "Separator", "Un trait fin entre deux parties.", frame("Séparation", { paddingY: 12 }, [separator])),
  def("tableau", "Table", "Des lignes et des colonnes simples.", frame("Table", { ...card, paddingY: 8, paddingX: 16, gap: 0 }, [["Formule", "Prix"], ["Essentiel", "5 000 F"], ["Confort", "10 000 F"], ["Premium", "20 000 F"]].flatMap(([a, b], i) => [...(i ? [separator] : []), row("Ligne", { justify: "space-between", paddingY: 10 }, [t(a, i ? {} : muted), t(b, i ? { fontWeight: 600 } : muted)])]))),
  def("fil-ariane", "Breadcrumb", "Le chemin jusqu'à la page.", row("Fil d'Ariane", { gap: 4 }, [btn("Accueil", "ghost", "/"), t("›", muted), btn("La carte", "ghost", "/carte"), t("› Desserts", muted)])),
  def("etat-vide", "Empty", "Quand il n'y a rien à montrer.", frame("Vide", { ...card, align: "center", textAlign: "center", paddingY: 40, gap: 10 }, [t("Aucun événement prévu", {}, "label"), t("Revenez bientôt, ou écrivez-nous.", muted), btn("Nous écrire", "outline", "https://wa.me/")])),
  def("faq", "FAQ (cartes)", "Questions et réponses, toutes visibles.", frame("FAQ", { gap: 0, paddingY: 8, paddingX: 16 }, [["Faut-il réserver ?", "C'est conseillé le week-end."], ["Quels moyens de paiement ?", "Espèces et Mobile Money."], ["Livrez-vous ?", "Oui, dans un rayon de 5 km."]].flatMap(([q, a], i) => [...(i ? [separator] : []), frame("Question", { gap: 4, paddingY: 14 }, [t(q, {}, "label"), t(a, muted)])]))),
];
