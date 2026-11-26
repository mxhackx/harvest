# Plan d'Architecture & Implémentation — Module CMS Hivation

**Date :** 26 novembre 2026  
**Objectif :** Déployer un CMS multi-locataire Next.js + Fastify permettant de générer et mettre en ligne des sites vitrines en quelques minutes lors des vagues de prospection terrain (sans maintenance WordPress).

---

## 1. Stratégie Produit & Tunnel de Vente Terrain

* **Showroom d'inspiration (WordPress) :** Utiliser des démos WordPress existantes par secteur uniquement comme catalogue visuel pour aider le prospect à choisir un style sur le terrain, sans aucun parseur PHP/Elementor à développer.
* **Squelettes internes (*Wireframes Low-Fidelity*) :** Maintenir en interne une bibliothèque restreinte de 5 à 8 squelettes React/Tailwind propres et éprouvés, accompagnés d'une librairie de composants (variantes de boutons, animations légères, polices, palettes).
* **Génération assistée par IA (Structured Output) :**
  1. Saisie du devis et des informations client sur le terrain dans Hivation CRM (nom, activité, catalogue/tarifs en FCFA, horaires, numéro WhatsApp `+229...`, photos prises sur place) -> export en JSON structuré (`spec_client`).
  2. Envoi du JSON du devis + schéma du squelette sélectionné à un LLM rapide/gratuit (**Gemini Flash**, **Groq** ou **Qwen**).
  3. L'IA remplit uniquement le **JSON de contenu et de thème** (textes vendeurs, couleurs, polices, choix des variantes), sans jamais générer de code JSX/HTML brut.
  4. Validation déterministe côté serveur (**Zod** + contrôleurs binaires) avant mise en ligne instantanée sur `client.sites.hivation.tech` pour démonstration immédiate devant le client.

---

## 2. Architecture Multi-Locataire & Bibliothèque de Blocs (P0)

### 2.1 Principe de fonctionnement
* **Application unique (CMS-01) :** Une seule instance Next.js déployée sur Vercel résout le locataire (*tenant*) à partir du domaine entrant (`*.sites.hivation.tech` ou domaine personnalisé `client.bj`) et charge les données correspondantes depuis Supabase.
* **Thèmes en données (CMS-02) :** Les jetons visuels (`accent`, `background`, `font`, `radius`, `template_id`) sont stockés en base (JSONB) et injectés via des variables CSS. Zéro code spécifique par client.

### 2.2 Les 5 Blocs Essentiels à livrer en priorité
Pour couvrir 90 % des commerces locaux (restaurants, lounges, boutiques, salons, prestataires) dès la première semaine :
1. **`hero` :** Logo, titre principal, accroche, image ou courte vidéo d'en-tête.
2. **`catalog` / `menu` :** Rubriques, articles/services, descriptions et prix en entiers (FCFA).
3. **`gallery` :** Galerie photos filtrable par catégorie.
4. **`contact_hours` :** Jours et heures d'ouverture, adresse, carte/itinéraire, téléphone au format E.164 (`+229...`).
5. **`whatsapp_cta` :** Bouton et formulaire de réservation ou de demande de devis ouvrant WhatsApp avec message prérempli.

---

## 3. Infrastructure DNS, SSL & Sous-Domaines Wildcard (`*.sites.hivation.tech`)

### 3.1 Configuration Cloudflare DNS (Point critique SSL)
* Le certificat SSL universel gratuit de Cloudflare ne couvre pas les sous-domaines de second niveau (`*.sites.hivation.tech`).
* **Configuration requise sur Cloudflare :**
  * **Type :** `CNAME`
  * **Nom :** `*.sites`
  * **Cible :** `vercel-dns.com`
  * **Statut Proxy :** **DNS Only (nuage gris)** — indispensable pour laisser Vercel émettre et renouveler automatiquement le certificat SSL wildcard Let's Encrypt sans erreur `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`.

### 3.2 Configuration Vercel & API Domaines Personnalisés
* Ajouter `*.sites.hivation.tech` dans **Project Settings > Domains** sur Vercel (avec validation TXT `_vercel` si nécessaire).
* Pour les domaines personnalisés clients (`CMS-07`, ex: `monrestaurant.bj`), automatiser l'ajout via l'API REST Vercel (`POST /v10/projects/{id}/domains`) depuis le backend Fastify.

### 3.3 Middleware Next.js (`middleware.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/((?!api/|_next/|_static/|favicon.ico).*)'],
};

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';
  const currentHost = hostname.replace(':3000', '');

  // 1. Domaines principaux Hivation
  const rootDomains = ['hivation.tech', 'www.hivation.tech', 'app.hivation.tech', 'localhost'];
  if (rootDomains.includes(currentHost)) {
    return NextResponse.next();
  }

  // 2. Sous-domaines wildcard *.sites.hivation.tech
  if (currentHost.endsWith('.sites.hivation.tech') || currentHost.endsWith('.sites.localhost')) {
    const subdomain = currentHost
      .replace('.sites.hivation.tech', '')
      .replace('.sites.localhost', '');

    url.pathname = `/_sites/${subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // 3. Domaines personnalisés clients (ex: client.bj)
  url.pathname = `/_sites/${currentHost}${url.pathname}`;
  return NextResponse.rewrite(url);
}
```

---

## 4. Contrôleurs de Publication & Garde-Fous (PLM Léger)

Conformément au principe directeur (*le modèle propose, le logiciel contrôle*), aucun site généré par IA n'est publié sans passer les vérifications binaires suivantes :

* **Validation de schéma (Zod) :** Vérification stricte de la structure JSON renvoyée par Gemini/Groq/Qwen (types, longueurs de chaînes, clés obligatoires).
* **`C01` / `C02` (Domaine & SSL) :** Vérification de la résolution DNS et de la validité du certificat.
* **`C04` (Logo présent) :** Si le logo est manquant à la signature, passage du dossier en attente avec lien d'upload direct sur le portail client (reprise automatique dès l'envoi).
* **`C05` (Coordonnées valides) :** Téléphone strictement au format international E.164 (`+229...`) et horaires renseignés.
* **`C06` (Zéro résidu de fabrication) :** Blocage automatique si un texte contient un placeholder (`Lorem ipsum`, `Titre ici`, `null`, `undefined`) ou un lien vide.
* **`C11` (Accessibilité) :** Vérification de la présence d'un texte alternatif (`alt`) sur chaque image publiée.

---

## 5. Feuille de Route : Sprint Pré-Prospection & Mesures Terrain

### Avant le départ sur le terrain
1. Configurer le `CNAME` `*.sites` (nuage gris) sur Cloudflare + domaine wildcard sur Vercel + `middleware.ts`.
2. Créer les tables multi-locataires (`sites`, `pages`, `blocks`, `releases`) dans Supabase avec filtrage strict `company_id`.
3. Coder les **5 blocs React/Tailwind P0** (testés mobile-first en `360px`) et 3 squelettes sectoriels.
4. Brancher l'endpoint Fastify `POST /sites/generate` (Gemini Flash / Groq + validation Zod + contrôleurs `C04`-`C06`).

### Pendant les vagues de prospection (Dogfooding & Observabilité)
* **Tester le mode hors-ligne (`CRM-01` / `CRM-02`) :** Couper volontairement la connexion mobile sur une demi-journée pour vérifier l'absence de doublons ou de pertes à la synchronisation.
* **Chronométrer la capture (`CRM-03`) :** Vérifier que la saisie d'un lead devant une boutique prend 3 gestes maximum à une main.
* **Mesurer les métriques réelles (`OBS-01` à `OBS-04`) :** Temps entre le devis et la mise en ligne, coût en jetons/services par site, et goulots d'étranglement côté client (photos, logo, paiement Mobile Money).
