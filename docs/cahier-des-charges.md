# Cahier des charges — Hivation

Nov 25, 2026 · @Name

## 1. Vision, promesse et périmètre

Hivation permet à une personne seule de lancer et de faire tourner une entreprise numérique en un jour au lieu de deux mois, pour une fraction du coût, en possédant l'acquisition et la relation client et en louant toute l'exécution.

### 1.1 La promesse, chiffrée

| Engagement | Référence actuelle | Cible Hivation | Comment on le mesure |
| --- | --- | --- | --- |
| Délai de lancement | environ 2 mois (MEDVi, selon [Forbes](https://www.forbes.com/sites/josipamajic/2026/04/02/ai-and-20000-helped-one-man-build-a-18-billion-telehealth-startup/)) | 1 jour ouvré | horodatage inscription → premier paiement encaissable |
| Coût de lancement hors publicité | 20 000 $ de capital initial de MEDVi, emploi non ventilé | à fixer après le démontage de cinq cas comparables | somme des coûts réels d'un lancement, ligne par ligne |

Deux précisions qui déterminent le reste du document.

**« Lancé » a une définition binaire.** Une entreprise est lancée quand quatre contrôles passent : le site est publié sur son domaine, le paiement est actif, le suivi d'acquisition est actif, et le premier prospect peut être capturé et attribué. Tant qu'un des quatre est en échec, le délai continue de courir.

**Les 20 000 $ ne sont pas un coût de construction connu.** Aucune source ne dit s'ils ont servi à la publicité, aux outils ou à des prestataires. Le coût cible se fixe donc sur une mesure, pas sur une analogie, et la publicité avancée reste hors du calcul puisque le produit ne la comprime pas.

### 1.2 Ce que le produit est

Une plateforme unique, avec une seule base de données et une seule authentification, qui réunit sept capacités :

1. un CRM de terrain par vagues de prospection (Hivation existant) ;
2. une publicité automatisée, alimentée par les gains réels de l'entreprise ;
3. un module d'affiliés avec suivi, commissions et versements ;
4. un CMS qui génère des sites WordPress ou Next.js ;
5. un ERP : documents commerciaux, grand livre, périodes, devises, taxes ;
6. un PLM : la spécification versionnée de ce qui est livré et ses contrôleurs ;
7. un moteur d'agents (FactorFlow) qui enchaîne des factories spécialisées.

### 1.3 Principe directeur

**Le modèle interprète, raisonne et propose ; le logiciel contrôle, exécute, vérifie et trace.** Tout ce qu'un programme peut vérifier de façon déterministe — permissions, états, doublons, plafonds de dépense, équilibre des écritures — ne dépend jamais d'une consigne donnée à un modèle.

### 1.4 Ce que le produit n'est pas

- **Pas un ERP complet.** Ni stock, ni paie, ni immobilisations, ni comptabilité générale complète, tant qu'aucun client ne paie pour cela. Le moteur comptable peut être intégré plutôt qu'écrit.
- **Pas une place de marché ouverte à des développeurs tiers au départ.** Les premières factories sont internes ; l'ouverture vient après la stabilisation du contrat entre factories.
- **Pas un éditeur de workflows générique.** n8n, Make et Zapier occupent ce terrain ; la valeur est dans la chaîne pré-intégrée par secteur.
- **Pas une promesse d'absence d'humain.** Le message est « une entreprise qui tourne pendant que tu supervises » : l'opérateur garde la main sur ce qui est irréversible, financier ou réglementé.
- **Pas un outil pour contourner une règle.** Le produit ne publie ni page ni publicité dans une catégorie réglementée sans contrôle de conformité préalable (section 17).

### 1.5 Utilisateurs visés

L'opérateur seul ou la très petite équipe qui monte une activité numérique, possède son entonnoir et sous-traite sa production. Deux terrains, un seul code : le Bénin et la zone UEMOA en francs CFA avec Mobile Money, comme terrain de validation et de références ; les marchés en dollars, payés par carte, où l'arithmétique du revenu tient.

## 2. Enseignements de MEDVi et du marché

MEDVi prouve qu'une entreprise de deux personnes peut encaisser 401 M$ en un exercice en possédant l'entonnoir et en louant tout le reste ; Hivation vise l'outillage de ce modèle, pas sa réplique.

### 2.1 Les faits retenus

| Fait | Valeur | Source |
| --- | --- | --- |
| Lancement | septembre 2024, depuis un domicile, deux mois de construction | [Forbes](https://www.forbes.com/sites/josipamajic/2026/04/02/ai-and-20000-helped-one-man-build-a-18-billion-telehealth-startup/) |
| Capital de départ | 20 000 $, aucun capital extérieur levé | Forbes |
| Recettes 2025 | 401 M$ pour 250 000 clients | Forbes |
| Résultat net 2025 | 16,2 %, soit 65 M$ | Forbes |
| Effectif | deux personnes à temps plein | Forbes |
| Trajectoire 2026 | 1,8 Md$ annoncés par la société, plus de 3 M$ par jour début 2026 | Forbes |
| Prestataires | CareValidate et OpenLoop Health : médecins, ordonnances, pharmacie, logistique, conformité | Forbes |
| Outils | ChatGPT, Claude, Grok (code) ; Midjourney, Runway (créations) ; ElevenLabs (voix) ; agents sur mesure ; agent conversationnel | Forbes |
| Tarifs | 149 à 179 $ le premier mois, 299 $ ensuite ; tirzépatide 399 $ | [glp1-us.com](https://glp1-us.com/providers/medvi/) |

Les recettes 2026 sont une prévision de la société, pas un exercice clos. Les fiches de bases de données d'entreprises (valorisation inférieure à 5 M$, 2024) sont périmées.

### 2.2 Ce que MEDVi possède et ce qu'elle loue

Elle possède l'acquisition (créations, achat média, affiliation), le site et le tunnel de paiement, la marque et le service client. Elle loue la décision clinique, la préparation, l'expédition et la conformité, facturées à l'acte. Ce partage explique à la fois le ratio d'environ 200 M$ de recettes par personne et la fragilité du modèle : les prestataires loués sont accessibles à tout concurrent.

### 2.3 Ce qu'Hivation reproduit

- **Trois couches choisies pour qu'aucune ne demande d'embauche** : acquisition tenue par l'opérateur, exécution louée à l'acte, outillage automatisé.
- **Un entonnoir, plusieurs produits branchés derrière**, ajoutés au catalogue à mesure qu'ils existent.
- **La rémunération par abonnement** : toute la marge vient des renouvellements, pas de la première vente.
- **Un affilié comme canal d'acquisition** au même titre que la publicité payée.

### 2.4 Ce qu'Hivation évite

- **Un socle réglementaire temporaire.** MEDVi vend des préparations dont la fenêtre légale s'est refermée (pénurie déclarée résolue en décembre 2024 pour le tirzépatide et en février 2025 pour le sémaglutide, avertissement de la FDA à MEDVi en février 2026). Un outil de gestion n'a pas ce risque, et Hivation ne doit pas le fabriquer pour ses utilisateurs.
- **Une marge qui n'est qu'un écart d'enchères.** Sans effet de réseau ni coût de changement, elle disparaît dès qu'un concurrent enchérit sur la même audience. Hivation doit donc être de ceux qui détiennent les données et les comptes de l'opérateur, ce qui crée un coût de changement réel.
- **Une machine à encaisser sans actif cessible.** Les journaux, l'historique comptable et la base de clients captifs sont l'actif que l'opérateur peut vendre.

### 2.5 Concurrence proche

| Acteur | Positionnement | Ce qu'il laisse de côté |
| --- | --- | --- |
| Company OS | plateforme tout-en-un avec agents par département | à vérifier : terrain, vagues, Mobile Money |
| Naïve (Y Combinator) | « autonomous company runtime », employés IA | à vérifier |
| SPIRITT | opérations de bout en bout, plus de 1 500 intégrations | à vérifier |
| Cyndra | trois modes (supervisé, semi-autonome, autonome), journal d'audit | à vérifier |
| The General Intelligence Company | 8,7 M$ levés pour une entreprise gérée par agents | à vérifier |
| Salesforce AgentExchange | place de marché d'actions et de modèles d'agents, plus de 200 partenaires à l'ouverture | fermé à l'écosystème Salesforce |
| GoHighLevel (de mémoire, à vérifier) | CRM, tunnels et automatisations en marque blanche pour agences | comptes, conformité, terrain |

La colonne de droite n'est volontairement pas remplie : elle est le résultat attendu du démontage de la section 20. Aucune de ces plateformes n'a été analysée en détail pour ce document.

## 3. Acteurs, rôles et permissions

Neuf acteurs, dont un agent IA qui a sa propre identité et ses propres droits, jamais ceux de la personne qui l'a lancé.

### 3.1 Les acteurs

| Acteur | Qui c'est | Portée par défaut |
| --- | --- | --- |
| Propriétaire | le gérant, signataire légal de la société | toute sa société |
| Manager | supervise une équipe ou une région | son équipe et sa région |
| Commercial | prospecte sur le terrain | ses leads et ceux qu'on lui assigne |
| Affilié | apporte des leads ou des ventes à la commission | ses liens, ses leads, ses relevés |
| Client final | acheteur du site ou de l'outil livré | son portail, ses documents |
| Comptable | consulte et exporte les écritures | lecture des écritures de sa société, validation des périodes |
| Prestataire | exécutant externe (médecin, pharmacie, transporteur, développeur) | les commandes qui lui sont adressées |
| Agent IA (factory) | exécute une tâche spécialisée | ce que sa définition déclare, jamais plus |
| Administrateur plateforme | exploite Hivation | métadonnées et santé du service, jamais le contenu des sociétés |

Un développeur de factory tiers s'ajoutera plus tard ; il n'existe pas dans la première version.

### 3.2 Matrice rôle × ressource

L = lire, C = créer, M = modifier, S = supprimer ou archiver, V = valider ou approuver, X = exécuter. Un tiret = aucun droit. Une étoile = sous condition de portée (section 3.3).

| Ressource | Propriétaire | Manager | Commercial | Affilié | Client final | Comptable | Agent IA |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Leads | L C M S | L C M\* | L C M\* | C\* L\* | — | — | L C M\* |
| Vagues et régions | L C M S | L M\* | L\* | — | — | — | L |
| Pipeline et étapes | L C M S | L | L | — | — | — | L |
| Sites et contenus | L C M S V | L | — | — | L\* M\* | — | L C M\* |
| Publicité : campagnes | L C M S V | L | — | — | — | — | L C M\* |
| Publicité : budgets et plafonds | L M V | L | — | — | — | L | L |
| Affiliés et plans | L C M S V | L C M\* | — | L\* | — | L | L |
| Commissions et versements | L V | L\* | — | L\* | — | L | L C\* |
| Devis et factures | L C M S V | L\* | L\* | — | L\* | L | L C\* |
| Écritures comptables | L | — | — | — | — | L V | C\* |
| Périodes comptables | L | — | — | — | — | L V | — |
| Spécifications et releases | L C M V | L | — | — | L\* | — | L C\* |
| Workflows et factories | L C M S V | L | — | — | — | — | X\* |
| Journal d'audit | L | L\* | — | — | — | L | — |
| Clés, secrets, webhooks | L C M S | — | — | — | — | — | — |

### 3.3 Conditions de portée

Un droit étoilé n'est jamais accordé seul : il l'est avec une condition évaluée à chaque requête.

- **Société** : `ressource.company_id = utilisateur.company_id`. Condition verrouillée, jamais désactivable, présente sur chaque table et chaque requête.
- **Équipe ou région** : le manager voit les ressources de ses équipes et de ses régions.
- **Propriétaire de la ressource** : le commercial modifie ses propres leads, l'affilié lit les siens.
- **Client** : le client final ne voit que les documents et sites où il est le tiers référencé.
- **Définition** : un agent IA ne peut appeler que les actions que sa définition déclare, sur les ressources qu'elle déclare.

### 3.4 Règles intangibles

1. Les permissions sont évaluées **une seule fois, dans l'API**, jamais réimplémentées dans un module.
2. Un agent IA a une identité propre ; ses droits sont l'intersection de sa définition et du rôle de la personne qui l'a lancé.
3. **Lecture, préparation et exécution sont trois droits distincts.** Un agent qui prépare un paiement ne le déclenche pas.
4. Aucune action irréversible, financière ou en masse n'est exécutée sans le niveau d'autonomie correspondant (section 12).
5. Le propriétaire ne peut pas se retirer le droit de validation sur les périodes comptables, les paiements et les plafonds publicitaires sans une écriture au journal d'audit.

## 4. Architecture d'ensemble

&#91;embedded content: architecture d'ensemble · 5 couches, 7 modules\]

Les sept modules ne communiquent jamais entre eux directement : ils lisent et écrivent dans le socle commun et réagissent à ses événements. L'exécution réelle — publicité, hébergement, paiement, livraison — est chez des prestataires que le moteur appelle et dont il suit l'état.

### 4.1 Principes d'architecture

1. **Une base, une authentification, un `company_id` partout.** Chaque table et chaque requête porte l'identifiant de société ; aucune exception, y compris dans les tables du CMS.
2. **Un seul référentiel de tiers.** Le prospect du CRM, le client de l'ERP, l'affilié et le propriétaire d'un site sont la même entité avec des rôles rattachés ; c'est la seule jointure directe entre modules.
3. **Le couplage passe par les événements, dans un seul sens.** `lead.won` ouvre un dossier PLM et un devis ERP ; l'ERP n'écrit jamais dans le CRM, le CRM ne crée jamais d'écriture.
4. **Une application multi-locataire plutôt qu'un déploiement par client.** La variation entre clients est de la donnée typée (thèmes, gabarits, blocs), jamais du code par client.
5. **Le système de référence reste Hivation.** Le moteur de fabrication est un service séparé, qui n'appelle le CRM que par l'API et les webhooks, avec sa propre base pour les exécutions et les journaux.
6. **Chaque étape automatisée a un repli manuel.** Un contrôleur binaire peut être validé par un humain, une page écrite au clavier : si une factory tombe, le système continue en mode dégradé.
7. **Les factories sont des fonctions sans état** : JSON en entrée, JSON en sortie, appelées par le moteur, jamais des processus qui tournent en permanence.

### 4.2 Autorité par module

| Module | Détient | Ne détient jamais |
| --- | --- | --- |
| CRM | leads, vagues, régions, activités, pipeline | le prix, le contenu, la définition du livrable |
| Publicité | campagnes, créations, budgets, attribution | l'argent encaissé, les comptes |
| Affiliés | liens, plans de commission, relevés | les écritures comptables |
| CMS | pages, blocs, médias, publications | la structure du livrable, qui paie |
| PLM | spécification, nomenclature, contrôleurs, releases | l'argent, le contenu publié |
| ERP | tiers, catalogue, documents, grand livre, périodes | la définition technique, le contenu |
| FactorFlow | workflows, exécutions, journaux d'exécution | les données métier qu'il manipule |

## 5. Socle de données et modèle commun

Le socle est la partie la plus difficile et la plus précieuse : un modèle commun que toutes les factories comprennent, et des règles de données qui interdisent par construction les erreurs irréversibles.

### 5.1 Entités

| Domaine | Entités | Champs structurants |
| --- | --- | --- |
| Organisation | société, utilisateur, rôle, équipe, appartenance | pays, devise de référence, fuseau, début de semaine, langue |
| Tiers | tiers (personne ou entreprise) avec rôles rattachés | nom, e-mail, téléphone, adresse, rôles (prospect, client, affilié, fournisseur) |
| Terrain | région, vague, lead, étape de pipeline, activité, tâche, modèle de message, segment | région, vague, source, `referrer_id`, position avec précision, étape, probabilité |
| Catalogue | article | libellé, unité, prix de référence, taux de taxe, compte comptable, lien vers la nomenclature PLM |
| Commerce | document, ligne de document | type, état, tiers, devise, numéro, quantité, prix unitaire, taux de taxe |
| Comptabilité | compte, écriture, période | débit, crédit, devise, taux à la date, document source, période |
| Livrable | spécification, version de spécification, release, exécution de contrôleur, site | version, nomenclature, verdict par contrôle, domaine, thème |
| Publicité | campagne, création, règle de budget, dépense, conversion | plateforme, plafond, dépense réelle, attribution |
| Affiliation | affilié, plan, lien, parrainage, commission, versement | taux, palier, état, montant dû, montant versé |
| Exécution | workflow, exécution, exécution d'étape, définition de factory, demande de validation | état, entrées, sorties, coût, niveau d'autonomie |
| Transverse | événement, journal d'audit, clé d'API, abonnement de webhook | acteur, ressource, avant, après, horodatage |

### 5.2 Règles de données

Ces règles se posent dès la première migration ; aucune ne se rattrape proprement après coup.

1. **Montants en entiers de la plus petite unité, avec code de devise.** Jamais un décimal flottant, jamais un montant sans sa devise. Le franc CFA n'ayant pas de sous-unité, une table qui mélangerait deux devises sans le dire serait irréparable.
2. **Identifiants générés côté client**, pour que le terrain puisse créer un lead sans réseau et que la synchronisation ne dépende pas d'un compteur serveur.
3. **Horodatages en UTC**, affichés dans le fuseau de l'utilisateur ; le début de semaine est un réglage de la société, sinon les bilans de vague sont faux chez la moitié des clients.
4. **Téléphones au format international**, adresses sans supposer de code postal.
5. **Attribution figée à la création.** `lead.referrer_id` et `lead.source` sont écrits à la création du lead et jamais reconstruits : un lead créé sans cette information est perdu pour le calcul des commissions.
6. **Aucune suppression physique des données comptables ou d'audit.** On archive, on annule par écriture inverse, on garde l'historique.
7. **Spécifications et releases immuables.** On crée une version, on ne modifie jamais une version publiée.
8. **Clé d'idempotence sur chaque écriture externe**, pour qu'une relance ne répète pas une action déjà exécutée.
9. **Aucun solde stocké.** Un solde est la somme d'écritures, jamais une colonne qu'on écrase.
10. **Fiabilité de la source.** Chaque donnée de la mémoire d'entreprise porte sa date, sa source et son niveau de confiance, et distingue fait confirmé, hypothèse et information obsolète.

### 5.3 Catalogue d'événements

Le nom d'un événement est un contrat : il ne change pas, on en ajoute un nouveau.

| Famille | Événements |
| --- | --- |
| Terrain | `lead.created`, `lead.qualified`, `lead.stage_changed`, `lead.won`, `lead.lost`, `task.overdue`, `wave.opened`, `wave.closed` |
| Commerce | `document.validated`, `payment.received`, `payment.failed` |
| Comptabilité | `ledger.entry_posted`, `period.closed` |
| Affiliation | `referral.attributed`, `commission.accrued`, `commission.cancelled`, `payout.requested`, `payout.approved`, `payout.sent` |
| Livrable | `spec.versioned`, `release.validated`, `site.published`, `controller.failed` |
| Publicité | `campaign.launched`, `budget.changed`, `spend.cap_reached`, `campaign.paused` |
| Exécution | `agent.action_proposed`, `agent.action_approved`, `agent.action_rejected`, `run.completed`, `run.failed`, `kill_switch.engaged` |

Chaque événement est signé, horodaté, rejouable, porte la société et l'acteur, et peut être livré à plusieurs abonnés sans que l'émetteur le sache.

## 6. Module CRM et vagues de prospection

Le CRM est le seul module déjà en production ; il devient la première factory, et sa tâche est d'être utilisable seul avant que quoi que ce soit s'y branche.

### 6.1 État déclaré de l'existant

D'après la documentation publique d'Hivation telle que rapportée dans la conversation fournie, et à vérifier contre le produit : découpage en régions et en vagues avec position sur la carte ; calendrier avec export `.ics` ; tâches avec rappels et notifications ; fiche lead ; pipeline à étapes personnalisables avec probabilités, gagné et perdu, motif de perte ; contacts multiples ; modèles de messages WhatsApp et e-mail ; segments ; gestion d'équipe avec objectifs par commercial ; rapports ; invitations par lien et changement de société ; webhooks signés ; import et export CSV et JSON ; position dérivée de coordonnées, d'un lien de carte ou d'une adresse avec indicateur de précision. La seule donnée obligatoire d'un lead est le nom de l'entreprise.

### 6.2 Exigences

Priorité : **P0** nécessaire au lancement de la plateforme, **P1** nécessaire à la promesse, **P2** ensuite.

| ID | Exigence | Priorité | Critère d'acceptation |
| --- | --- | --- | --- |
| CRM-01 | Écriture locale d'abord : créer et modifier un lead sans réseau, synchroniser ensuite | P0 | douze vagues d'affilée sans donnée perdue ; un lead créé hors ligne apparaît une seule fois après synchronisation |
| CRM-02 | Résolution des conflits de synchronisation : règle déterministe par champ, conflit visible quand deux éditions divergent | P0 | deux appareils modifient le même lead hors ligne : aucune écriture n'est perdue en silence |
| CRM-03 | Capture d'un lead en trois gestes maximum, à une main : position automatique, nom, enregistrement | P0 | mesure chronométrée sur dix captures réelles ; position présente sans saisie |
| CRM-04 | `referrer_id` et `source` écrits à la création et non modifiables ensuite sans écriture d'audit | P0 | aucun lead sans source dans la base ; toute modification tracée |
| CRM-05 | Région, vague (région × période × état avec objectif), début de semaine réglable par société | P0 | une vague se clôtûre le dimanche avec ses chiffres, sans intervention manuelle, quel que soit le début de semaine |
| CRM-06 | Carte colorée par état de vague : à visiter, en cours, épuisée ; clic sur un point pour une mini-fiche | P0 | état et couleur cohérents avec les leads visités ; mini-fiche en moins d'une seconde |
| CRM-07 | Bilan de clôture de vague : visités, convertis, à repasser, et recommandation de la région suivante | P1 | le bilan répond à « où aller la semaine prochaine » avec une région et un nombre de leads mûrs |
| CRM-08 | API complète en lecture et écriture sur lead, étape, tâche, contact, tiers, vague, région | P0 | un script externe crée un lead, le fait gagner et reçoit `lead.won` sur un webhook |
| CRM-09 | Clés d'API par société, portée restreinte, révocables immédiatement | P0 | une clé révoquée est refusée à la requête suivante |
| CRM-10 | Webhooks signés, rejouables, avec clé d'idempotence | P0 | un webhook relivré deux fois ne crée pas de doublon côté récepteur |
| CRM-11 | Matrice de permissions applicable à l'API et à l'interface | P0 | un manager régional ne voit rien hors de sa région, en API comme en interface |
| CRM-12 | Import CSV et JSON avec détection de doublons et rapport d'analyse | existant | vérifier la conformité aux règles de la section 5.2 |
| CRM-13 | Compte rendu vocal transformé en fiche mise à jour | P2 | une note vocale crée les activités et tâches proposées, validées avant écriture |
| CRM-14 | Optimisation de tournée sur la carte | P2 | ordre proposé plus court que l'ordre de saisie sur dix tournées |
| CRM-15 | Onboarding libre-service de création de société, utilisable sans assistance à toute heure | P1 | un inconnu crée sa société et son premier lead seul, mesuré à l'écran |
| CRM-16 | Interface découplée de la langue : aucune chaîne en dur, locale par utilisateur | P0 | passer la locale change toutes les chaînes sans toucher au code |

### 6.3 Agents du module

Chaque agent est une factory au sens de la section 12, avec ses données, ses événements émis et ses actions exposées.

| Agent | Rôle | Actions exposées | Niveau initial |
| --- | --- | --- | --- |
| Qualification | note les leads, repère les doublons, enrichit les fiches | `qualifier_lead`, `fusionner_doublons` | agir avec validation |
| Prospection | rédige et envoie les premiers messages, planifie les tournées | `envoyer_message`, `planifier_tournee` | suggérer |
| Relance | décide qui rappeler et quand | `planifier_relance` | agir avec validation |
| Suivi du pipeline | détecte les opportunités qui stagnent | `proposer_action` | suggérer |
| Compte rendu | transforme une note en fiche mise à jour | `mettre_a_jour_fiche` | agir avec validation |

### 6.4 Garde-fous de messagerie

- Plafond de messages par jour, par agent et par canal.
- Respect des désinscriptions, vérifié par le logiciel avant tout envoi, jamais par une consigne au modèle.
- Un contact ne peut pas être relancé deux fois dans un délai court, défini par société.
- Un envoi en masse passe par une file de validation : « l'agent veut envoyer ce message à 200 leads ».
- Canal de messagerie protégé contre le blocage : montée progressive du volume, domaine d'envoi distinct du domaine principal.
- Les e-mails de prospection ne partent jamais du domaine racine, réservé aux échanges avec les clients et aux vérifications de service.

## 7. Module publicité automatisée à partir des gains

Le module réinvestit automatiquement une part des gains réellement encaissés en publicité, dans des limites que le logiciel fait respecter et que le modèle ne peut pas modifier.

### 7.1 Principe

La publicité est l'acquisition de l'opérateur : c'est elle qui achète les clients un par un. Automatiser sa dépense ne vaut que si la source de l'argent est fiable et si la dépense est plafonnée par des règles extérieures au modèle. Le budget est donc **dérivé du grand livre** (section 10), jamais du chiffre d'affaires déclaré par une régie ou estimé par un agent.

### 7.2 Règle de réinvestissement

```text
budget_jour = min( plafond_jour , taux_reinvestissement × marge_encaissee_30j / 30 )
```

- `marge_encaissee_30j` : produits effectivement encaissés sur trente jours glissants, moins les coûts à l'acte, les commissions dues et la publicité déjà engagée ; lue dans les écritures validées.
- `taux_reinvestissement` : choisi par le propriétaire, jamais par un agent.
- `plafond_jour` : valeur absolue fixée par le propriétaire, qui prime sur tout calcul.
- Un budget ne peut qu'être réduit sans validation ; l'augmenter au-delà d'un seuil passe par la file de validation.

La publicité est dépensée avant que l'abonnement soit encaissé : le module suit donc aussi un **besoin de trésorerie** (dépenses engagées non encore couvertes par des encaissements) et suspend l'augmentation des budgets quand il dépasse une part de la trésorerie disponible.

### 7.3 Exigences

| ID | Exigence | Priorité | Critère d'acceptation |
| --- | --- | --- | --- |
| PUB-01 | Connexion aux régies publicitaires par autorisation déléguée, jeton stocké chiffré, révocable | P1 | révoquer la connexion arrête tout appel sortant immédiatement |
| PUB-02 | Budget dérivé des écritures validées, selon la règle de 7.2 | P1 | modifier une écriture change le budget calculé au cycle suivant |
| PUB-03 | Plafonds en cascade : par campagne, par jour, par semaine, par mois, global | P0 | une dépense qui dépasserait un plafond est refusée avant l'appel à la régie |
| PUB-04 | Plafonds appliqués sur le **budget réservé**, pas sur la dépense rapportée, puisque les régies publient leurs chiffres avec retard | P0 | en simulant un retard de rapport de 24 heures, le plafond tient |
| PUB-05 | Coupe-circuit global et par campagne, effet immédiat, accessible en un geste | P0 | `kill_switch.engaged` suspend toutes les campagnes et refuse tout nouvel appel |
| PUB-06 | Règles d'arrêt automatiques : coût d'acquisition au-dessus d'un seuil, volume de données insuffisant pour décider | P1 | aucune décision d'augmentation sous un échantillon minimal défini |
| PUB-07 | Attribution unique par conversion : une conversion n'est jamais comptée à la fois pour la régie et pour un affilié | P0 | la somme des conversions attribuées égale le nombre de conversions réelles |
| PUB-08 | Conversions remontées côté serveur depuis les paiements encaissés, pas seulement par balise navigateur | P1 | une conversion bloquée côté navigateur est quand même comptée |
| PUB-09 | Réconciliation quotidienne entre dépenses de la régie et écritures du grand livre, écart signalé au-delà d'un seuil | P1 | un écart artificiel est détecté et alerte le propriétaire |
| PUB-10 | Génération de créations (texte, image, vidéo, voix) avec journal de ce qui a été produit, par quel modèle, à partir de quelle consigne | P2 | chaque création publiée a un enregistrement de provenance |
| PUB-11 | Contrôle de conformité des créations avant publication : catégories réglementées, allégations de résultat, mentions obligatoires | P0 | une création hors règle est bloquée et renvoyée à l'humain |
| PUB-12 | Validation humaine obligatoire pour la première campagne, tout nouveau compte publicitaire et toute catégorie sensible | P0 | impossible de lancer sans approbation enregistrée |
| PUB-13 | Indicateurs : coût d'acquisition, retour sur dépense, délai de récupération, rétention par cohorte | P1 | affichés par campagne et par source, calculés depuis les données de la plateforme |
| PUB-14 | Aucun contournement des règles des régies : pas de multiplication de comptes pour éviter une restriction | P0 | refus explicite du module en cas de détection d'un second compte pour la même entité sanctionnée |

### 7.4 Modes de défaillance à couvrir

| Défaillance | Conséquence | Parade prévue |
| --- | --- | --- |
| Boucle de dépense : un agent relance une campagne en continu | budget épuisé en quelques heures | plafond sur budget réservé, limite de fréquence des modifications, coupe-circuit |
| Rapports de régie en retard | dépense réelle supérieure au plafond affiché | PUB-04 |
| Double comptage affilié et régie | commissions payées sur une vente déjà payée en publicité | PUB-07 |
| Augmenter un budget sur un échantillon trop petit | dépense gaspillée sur du bruit | PUB-06 |
| Création non conforme publiée | suspension du compte publicitaire, risque légal | PUB-11, PUB-12 |
| Gains surestimés : remboursement ou rejet de paiement après réinvestissement | publicité dépensée sur un revenu annulé | marge calculée sur encaissements validés, délai de réserve avant réinvestissement |
| Suspension du compte publicitaire | perte brutale du canal d'acquisition | PUB-14, diversification des canaux, affiliés comme canal de repli |

## 8. Module affiliés

Un affilié est un canal d'acquisition payé à la performance : le module doit savoir qui a apporté quoi, combien est dû, pourquoi, et rendre ce calcul lisible par celui qui est payé.

### 8.1 Cycle de vie d'une commission

| État | On y entre quand | On en sort vers |
| --- | --- | --- |
| En attente | un lead attribué à l'affilié atteint l'événement déclencheur du plan (lead qualifié ou affaire gagnée) | Approuvée, ou Annulée |
| Approuvée | le paiement du client est encaissé et validé au grand livre | Payable après le délai de réserve, ou Annulée |
| Payable | le délai de réserve (remboursement, litige) est écoulé | Payée |
| Payée | un ordre de versement est exécuté et confirmé | — |
| Annulée | l'affaire passe en perdue, le paiement est remboursé ou rejeté, ou la fraude est avérée | — |

Chaque transition produit une écriture et un événement ; une annulation est une écriture inverse, jamais une suppression. Une commission déjà payée puis annulée crée une créance sur l'affilié, compensée sur ses versements suivants.

### 8.2 Plans de rémunération

Trois formes seulement, codées en dur ; aucun langage de règles généraliste.

| Forme | Fonctionnement |
| --- | --- |
| Pourcentage sur affaire gagnée | taux appliqué au montant encaissé hors taxes |
| Montant fixe par lead qualifié | somme forfaitaire par lead atteignant l'étape définie |
| Palier | le taux ou le montant change selon le volume de la période |

Un plan est **versionné et daté** : une commission garde le plan en vigueur à la date de l'attribution, même si le plan change ensuite.

### 8.3 Exigences

| ID | Exigence | Priorité | Critère d'acceptation |
| --- | --- | --- | --- |
| AFF-01 | Inscription d'un affilié par invitation ou lien public, avec identité vérifiée avant le premier versement | P1 | aucun versement sans identité et moyen de paiement validés |
| AFF-02 | Lien de suivi unique par affilié et par campagne, avec identifiant lisible | P1 | un lien génère un parrainage rattaché au bon affilié à la création du lead |
| AFF-03 | Attribution fixée à la création du lead, selon une règle explicite et unique (dernier contact par défaut) | P0 | une même vente n'est attribuée qu'à un seul affilié |
| AFF-04 | Plans de commission versionnés, datés, trois formes | P1 | modifier un plan ne change aucune commission déjà calculée |
| AFF-05 | Calcul automatique des commissions à l'événement déclencheur, écriture au grand livre | P1 | chaque montant du relevé renvoie à une écriture datée |
| AFF-06 | Délai de réserve configurable avant qu'une commission devienne payable | P1 | un remboursement dans le délai annule la commission sans créance |
| AFF-07 | Annulation par écriture inverse et compensation sur les versements suivants | P1 | le solde de l'affilié reste la somme de ses écritures, jamais une colonne |
| AFF-08 | Relevé par affilié : chaque franc expliqué ligne par ligne (lead, événement, plan, taux, date) | P0 | un affilié comprend son paiement sans poser de question |
| AFF-09 | Ordre de versement avec seuil minimal, validation du propriétaire, exécution via un prestataire de paiement | P1 | un versement approuvé produit un ordre idempotent et son écriture |
| AFF-10 | Portail affilié : liens, leads attribués, commissions par état, relevés exportables | P1 | un affilié voit uniquement ses propres données |
| AFF-11 | Détection de fraude : auto-parrainage, leads fictifs, doublons, pics anormaux, clics sans activité | P1 | un lead créé par l'affilié pour lui-même est signalé et bloqué avant approbation |
| AFF-12 | Charte de contenu : un affilié ne promet que ce que l'opérateur autorise ; sanction et suspension journalisées | P0 | une allégation interdite détectée suspend la commission du lead concerné |
| AFF-13 | Un seul niveau d'affiliation au départ ; aucune commission sur le recrutement d'autres affiliés | P0 | aucun plan ne peut rémunérer le recrutement |
| AFF-14 | Données fiscales et justificatifs conservés par affilié selon le pays | P2 | export annuel des montants versés par affilié |

AFF-13 est une exclusion volontaire : rémunérer le recrutement ou empiler des niveaux fait basculer le modèle vers une structure à risque juridique élevé, et n'apporte rien à la promesse.

## 9. Module CMS : génération WordPress et Next.js

Le CMS produit le site livré à partir d'une spécification, sur deux cibles, avec une règle de maintenance qui décide laquelle est la cible par défaut.

### 9.1 Décision structurante : deux cibles, un seul modèle de maintenance

Un site par déploiement et par client multiplie la maintenance par le nombre de clients : mises à jour de dépendances, correctifs de sécurité, sauvegardes. C'est ce qui détruit la promesse d'automatisation au dixième ou au douzième client. La spécification tranche donc ainsi.

| Cible | Nature | Maintenance | Quand l'utiliser |
| --- | --- | --- | --- |
| Next.js multi-locataire | une application unique, routée par domaine, qui lit le contenu en base | corrigée une fois pour tous les clients | cible **par défaut** |
| WordPress, contenu seulement (sans tête) | WordPress sert d'éditeur de contenu, l'affichage reste l'application Next.js | l'instance WordPress est à maintenir par client | le client exige l'interface d'édition WordPress |
| WordPress autonome | un site WordPress complet livré à part | à la charge du client ou facturée séparément | demande explicite, hors du lot commun |

Chaque cible choisie hors du lot par défaut est **tarifée avec son propre prix de maintenance**, calculé sur le coût réel mesuré par l'observabilité (section 15). Un client qui obtient un composant sur mesure en dur sort du lot commun, explicitement et au tarif correspondant ; si le besoin est général, il entre au catalogue de blocs pour tous.

### 9.2 Catalogue de blocs

Le catalogue part des sites déjà livrés plutôt que d'une liste imaginée : un bar-restaurant, un jardin-café avec boutique de plantes, un service de codes QR.

| Bloc | Contenu | Données du client |
| --- | --- | --- |
| En-tête de page | titre, accroche, image ou courte vidéo | logo, texte, média |
| Menu ou catalogue | rubriques, articles, prix | articles du catalogue |
| Galerie filtrable | images par catégorie, fiches d'entretien ou de détail | médias, catégories |
| Actualités et événements | articles datés | contenu |
| Demande spéciale | formulaire de devis ou d'événement privé | champs, destinataire |
| Avis | liste, formulaire, modération avant publication | avis, lien vers la source |
| Horaires et contact | jours, heures, téléphone, messagerie | horaires, numéros au format international |
| Carte et accès | carte intégrée, itinéraire | adresse, coordonnées |
| Contact par messagerie | bouton et formulaire qui ouvre la conversation avec un message pré-écrit | numéro, modèle de message |
| Réservation | demande de table ou de créneau | règles de disponibilité |
| Tarifs | formules, prix, bouton de paiement | catalogue, devise |
| Page numérique liée à un QR | page à contenu modifiable derrière un code qui ne change pas | contenu, code |
| Pied de page et mentions | liens, mentions légales, réseaux | informations de la société |

### 9.3 Exigences

| ID | Exigence | Priorité | Critère d'acceptation |
| --- | --- | --- | --- |
| CMS-01 | Application Next.js unique, locataire résolu par domaine au bord, contenu lu en base | P0 | deux clients sur deux domaines tournent sur un seul déploiement avec deux apparences |
| CMS-02 | Thèmes en données : jetons (couleurs, typographie, rayons, espacements), gabarits, blocs activables | P0 | changer de thème ne nécessite aucune ligne de code |
| CMS-03 | Génération statique avec revalidation à la demande, déclenchée par la publication | P0 | une modification publiée est visible en ligne sans redéploiement |
| CMS-04 | Aperçu avant publication, version précédente restaurable en un geste | P0 | restaurer une version rétablit l'état exact précédent |
| CMS-05 | Portail client : écrire le contenu, déposer des médias, demander une modification | P0 | un client sans compte technique remplit son site seul |
| CMS-06 | Une demande du client crée une demande de changement dans le PLM | P1 | l'événement `cms.change_requested` ouvre un dossier lié à la spec |
| CMS-07 | Domaine personnalisé : instructions DNS, vérification automatique, certificat émis sans intervention | P0 | de la saisie du domaine à la page en ligne sans action manuelle de l'opérateur |
| CMS-08 | Cible WordPress contenu seulement : synchronisation de l'instance vers la base, jamais l'inverse | P2 | une modification dans WordPress est reflétée sur le site Next.js après revalidation |
| CMS-09 | Cible WordPress autonome : thème et extensions issus d'une liste fermée, mises à jour automatiques, instance durcie | P2 | aucune extension hors liste n'est installable depuis le portail |
| CMS-10 | Référencement : balises, partage social, plan du site, données structurées générés depuis la spec | P1 | chaque page a titre, description et image de partage |
| CMS-11 | Performance : images optimisées, budgets de poids et de temps de chargement par page | P1 | une page dépassant son budget est signalée avant publication |
| CMS-12 | Accessibilité : texte alternatif obligatoire sur toute image de contenu, contrastes vérifiés | P1 | une image sans texte alternatif bloque la publication |
| CMS-13 | Remontée des conversions côté serveur vers le module publicité et le suivi d'affiliation | P1 | un paiement encaissé sur le site crée une conversion attribuée |
| CMS-14 | Consentement et mentions : bandeau, politique de confidentialité, selon le pays du visiteur | P1 | aucun traceur déposé avant consentement là où il est requis |
| CMS-15 | Langues multiples par site avec locale par visiteur | P2 | une page existe en deux langues et chaque lien reste dans la langue |

### 9.4 Contrôles de publication

Le démontage de sites livrés a montré des résidus de fabrication : libellés de remplacement dans un sélecteur d'étapes, liens encore vides, élément de navigation dupliqué, vignettes en double, libellé technique visible, numéro de téléphone dans un format non adapté au pays. Une partie peut être un artefact de lecture automatisée et reste à vérifier sur les sites eux-mêmes. Chacun devient un contrôleur binaire de la section 11 :

- aucun texte de remplacement ou libellé technique dans un bloc publié ;
- aucun lien dont la cible est vide ou renvoie une erreur ;
- aucun élément de navigation en double ;
- aucune image en double dans une galerie ;
- tout numéro de téléphone au format international ;
- toute image de contenu avec texte alternatif ;
- le logo, le contact et les horaires sont présents ;
- toute section annoncée au menu a un contenu.

## 10. Module ERP : documents, grand livre, périodes

L'ERP est une interface et une logique métier autour d'un grand livre en partie double à ajout seul ; c'est lui qui rend les chiffres opposables, donc financables.

### 10.1 Périmètre et refus

Inclus : référentiel de tiers, catalogue de services, document commercial unique, grand livre, périodes et clôture, numérotation, devises et taxes, rapprochement des encaissements, commissions et versements. **Exclus tant qu'aucun client ne les demande et ne les paie** : stock, paie, immobilisations, comptabilité générale complète, consolidation.

**Décision ouverte : écrire ou intégrer le moteur comptable.** Un moteur existant sait tenir un grand livre, des périodes et une numérotation conformes ; l'ERP d'Hivation pousserait alors ses écritures vers lui. L'intégration économise la partie où il n'y a rien à gagner et tout à perdre, au prix d'une dépendance à son modèle de données. La décision se prend avant le début de l'étape ERP, sur la base de la contrainte suivante : les invariants de 10.4 doivent être vérifiables quelle que soit l'option.

### 10.2 Document commercial unique

Un seul objet pour le devis, la commande, la facture, l'avoir, la note de frais et l'ordre de versement : un type, un état, des lignes qui référencent le catalogue, un tiers, une devise, un taux de taxe par ligne.

| État | Sens |
| --- | --- |
| Brouillon | modifiable, sans numéro, sans effet comptable |
| Validé | numéroté, figé, écritures générées |
| Soldé | encaissé ou réglé en totalité |
| Annulé | corrigé par un document inverse, jamais effacé |

Un document validé ne se modifie pas : une facture se corrige par un avoir. Un devis accepté engendre une facture ; un `lead.won` crée un devis en brouillon.

### 10.3 Écritures générées par événement

| Événement | Débit | Crédit |
| --- | --- | --- |
| Facture validée | créance client | produits, taxe collectée |
| Encaissement | trésorerie (carte, Mobile Money, virement) | créance client |
| Coût d'un prestataire à l'acte | charge d'exécution | dette fournisseur |
| Publicité dépensée | charge publicitaire | trésorerie ou dette fournisseur |
| Commission approuvée | charge de commission | dette envers l'affilié |
| Commission annulée | dette envers l'affilié | charge de commission |
| Versement exécuté | dette envers l'affilié | trésorerie |
| Remboursement client | produits, taxe | trésorerie |

### 10.4 Invariants à vérifier en continu

Ces invariants ne sont pas des cas de test : ils sont recalculés sur toute la base, en continu, et leur violation déclenche une alerte et un blocage.

1. Pour chaque écriture, la somme des débits égale la somme des crédits, dans la même devise.
2. Aucun numéro de document n'est utilisé deux fois ; les séquences n'ont pas de trou.
3. Aucune écriture n'est passée dans une période close.
4. Aucun solde n'est stocké ; tout solde est la somme des écritures.
5. Tout document validé possède ses écritures, et toute écriture renvoie à un document ou à un mouvement source.
6. Aucun lead sans société, aucune écriture sans société.
7. La somme des commissions dues égale la dette à l'égard des affiliés dans le grand livre.

### 10.5 Exigences

| ID | Exigence | Priorité | Critère d'acceptation |
| --- | --- | --- | --- |
| ERP-01 | Référentiel de tiers unique avec rôles rattachés | P0 | un client devenu affilié garde une seule fiche et un seul solde |
| ERP-02 | Catalogue d'articles relié aux nomenclatures PLM, prix et taxes côté ERP | P1 | changer un tarif ne crée pas de version de produit |
| ERP-03 | Document unique avec états et transitions explicites | P0 | une facture validée refuse toute modification |
| ERP-04 | Grand livre en partie double, ajout seul | P0 | invariants 10.4 vérifiés sur un jeu de 10 000 documents |
| ERP-05 | Périodes avec clôture ; une correction passée passe par une écriture dans la période ouverte | P0 | une écriture datée dans une période close est refusée |
| ERP-06 | Numérotation sans trou, par société et par exercice, attribuée à la validation et non à la création du brouillon | P0 | cent validations simultanées ne produisent ni doublon ni trou |
| ERP-07 | Devise et taux à la date de l'écriture, taux de taxe par ligne | P0 | une facture en deux devises produit des écritures équilibrées dans chacune |
| ERP-08 | Rapprochement des encaissements : paiement de carte, Mobile Money, virement vers le document | P1 | un encaissement non rapproché reste visible dans une file jusqu'à traitement |
| ERP-09 | Relevé de compte par tiers, exportable | P1 | le relevé correspond à la somme des écritures du tiers |
| ERP-10 | Export comptable dans un format standard pour un comptable externe | P1 | un comptable reconstruit le bilan de la période à partir de l'export seul |
| ERP-11 | Encaissement en dollars sans entité à l'étranger : recours à un vendeur de référence qui collecte et reverse | P1 | un client à l'étranger paie par carte et la somme reversée est écrite au grand livre |
| ERP-12 | Validation du propriétaire pour paiements sortants, annulations de période et plafonds | P0 | un paiement sortant sans validation est refusé par l'API |

ERP-11 suppose une entité juridique constituée avec un signataire maîtrisant sa capacité à contracter (section 17). Les fournisseurs de vendeur de référence et leurs conditions sont à vérifier au moment du choix.

## 11. Module PLM : contrat de livraison et contrôleurs

Le PLM transforme une affaire gagnée en un contrat de fabrication versionné, vérifié étape par étape par des contrôleurs binaires qui ne font aucune interprétation.

### 11.1 Objets

| Objet | Rôle | Règle |
| --- | --- | --- |
| Dossier produit | ouvert sur `lead.won`, rattaché au tiers et à l'article de catalogue | un dossier par commande |
| Spécification | ce qui doit être livré, lisible par le client | chaque modification crée une version, jamais de retouche |
| Nomenclature | gabarit, blocs, options et contraintes de compatibilité | en données, jamais en code |
| Contrat de fabrication | le JSON consommé par le moteur, dérivé d'une version de spécification | immuable une fois validé |
| Contrôleur | vérifie un fait précis par oui ou par non | fonction pure : entrée JSON, verdict et raison |
| Exécution de contrôles | l'application ordonnée des contrôleurs à un contrat | journal ligne par ligne |
| Release | état figé et redéployable à l'identique | une release validée ne se modifie pas |
| Demande de changement | modification demandée après la spec validée, avec impact de prix | issue du portail ou du gérant |

### 11.2 Contrat de fabrication : structure

```json
{
  "contract_id": "ctr_01",
  "spec_version": 3,
  "company_id": "co_01",
  "party_id": "pty_01",
  "article_id": "art_site_vitrine",
  "target": "nextjs_multitenant",
  "domain": "exemple.bj",
  "theme": { "tokens": { "accent": "...", "radius": "...", "font": "..." }, "template": "tpl_restaurant" },
  "blocks": [
    { "type": "hero", "required": ["logo", "title"] },
    { "type": "menu", "required": ["items"] },
    { "type": "contact", "required": ["phone_e164", "hours"] }
  ],
  "integrations": { "payment": "enabled", "messaging": "enabled", "tracking": "server_side" },
  "budget": { "max_cost": "...", "max_duration_minutes": "..." },
  "controllers": ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08"]
}
```

Les valeurs entre guillemets points de suspension sont à fixer à l'écriture du schéma ; la structure et les champs obligatoires sont, eux, normatifs.

### 11.3 Contrôleurs

Un contrôleur répond oui, non ou sans objet, avec une raison courte. Aucun modèle ne participe à un verdict.

| ID | Vérifie | Obligatoire |
| --- | --- | --- |
| C01 | le domaine est vérifié et résout vers le déploiement | oui |
| C02 | le certificat est valide | oui |
| C03 | toutes les pages du contrat existent | oui |
| C04 | le logo est présent | oui |
| C05 | téléphone au format international, horaires et adresse présents | oui |
| C06 | aucun texte de remplacement ni libellé technique visible | oui |
| C07 | aucun lien vide ou en erreur, aucune navigation en double | oui |
| C08 | le paiement de test aboutit et crée un encaissement | oui |
| C09 | une conversion de test est remontée côté serveur | oui |
| C10 | titre, description et image de partage sur chaque page | non |
| C11 | texte alternatif sur toute image de contenu | oui |
| C12 | budget de poids et de temps de chargement respecté | non |
| C13 | pages légales et consentement présents pour le pays | oui |

### 11.4 Format du journal

```text
CONTRAT ctr_01  version 3  cible nextjs_multitenant
[OK] C01 domaine vérifié : exemple.bj
[OK] C02 certificat valide jusqu'au 2027-02-14
[OK] C03 6 pages sur 6
[KO] C04 logo absent : medias.logo = null
[--] C05 non exécuté : bloqué par C04
VERDICT : ÉCHEC  4 sur 13 contrôles exécutés, 3 réussis, 1 échec bloquant
```

Règles : un contrôle obligatoire en échec bloque la suite ; les contrôles non obligatoires remontent en avertissement ; chaque ligne porte la raison lisible d'un humain ; une dérogation humaine est possible et journalisée avec son auteur.

### 11.5 La boucle fermée

C04 échoue parce que le logo manque. L'exécution s'arrête et l'événement `controller.failed` fait apparaître un blocage en langage clair chez l'opérateur. Le portail client affiche la zone de dépôt du logo. Dès le dépôt, la chaîne reprend sans action de l'opérateur. Ce parcours est le test d'acceptation du module.

### 11.6 Exigences

| ID | Exigence | Priorité | Critère d'acceptation |
| --- | --- | --- | --- |
| PLM-01 | Dossier produit ouvert automatiquement sur `lead.won` | P0 | l'événement crée un dossier et une spécification en version 1 |
| PLM-02 | Spécification versionnée immuable, diff entre versions | P0 | deux versions comparables champ par champ |
| PLM-03 | Nomenclature avec contraintes : un bloc incompatible avec un gabarit est refusé | P1 | une nomenclature invalide est rejetée à l'enregistrement |
| PLM-04 | Contrat JSON dérivé d'une seule version de spécification, validé contre un schéma | P0 | un contrat hors schéma est refusé avant exécution |
| PLM-05 | Contrôleurs purs, journal « oui / non / sans objet » ligne par ligne | P0 | chaque verdict est reproductible à partir de l'entrée |
| PLM-06 | Un humain peut valider ou refuser chaque contrôle à la main | P0 | une dérogation écrit son auteur et sa raison au journal |
| PLM-07 | Release figée, redéployable à l'identique | P0 | redéployer une release produit un site identique octet pour octet pour le contenu statique |
| PLM-08 | Demandes de changement avec impact de prix, issues du portail ou de l'opérateur | P1 | une demande validée crée une nouvelle version et un document ERP |
| PLM-09 | Jeu de tests des contrôleurs construit sur les sites réellement livrés | P1 | chaque résidu de fabrication connu est détecté par au moins un contrôleur |
| PLM-10 | Aperçu de déploiement partageable avant mise en ligne | P1 | un lien d'aperçu rend le site tel qu'il sera publié |

## 12. Moteur d'agents et FactorFlow

Le moteur exécute des chaînes de factories spécialisées avec des garanties que le modèle ne peut pas donner seul ; FactorFlow est l'éditeur de ces chaînes et vient en dernier.

### 12.1 Pourquoi le moteur passe avant l'éditeur

Si chaque agent réussit 95 % du temps, une chaîne de dix étapes ne réussit que dans environ 60 % des cas (0,95 puissance 10). Le moteur est ce qui remonte ce chiffre : états durables, reprise au point d'échec, vérification des résultats, validation humaine des actions sensibles. Une toile de nœuds sans ce moteur est une démonstration ; avec lui, c'est un produit.

### 12.2 Factory : définition normative

Une factory est une fonction sans état : JSON en entrée, JSON en sortie, appelée par le moteur. Elle se décrit par un fichier de définition, qui est le contrat standard entre factories.

```json
{
  "factory": "crm",
  "version": "1.0.0",
  "owns": ["lead", "opportunity", "activity", "task", "template"],
  "reads": ["party", "region", "wave"],
  "emits": ["lead.created", "lead.qualified", "lead.won", "lead.lost", "task.overdue"],
  "actions": [
    { "name": "create_lead",     "risk": "low",    "autonomy_max": "autonomous" },
    { "name": "change_stage",    "risk": "low",    "autonomy_max": "autonomous" },
    { "name": "send_message",    "risk": "medium", "autonomy_max": "approved", "limits": { "per_day": "..." } },
    { "name": "bulk_send",       "risk": "high",   "autonomy_max": "approved" }
  ],
  "permissions": { "scope": "company" },
  "cost_model": { "unit": "execution" }
}
```

Les limites chiffrées sont des réglages de société ; la structure est normative.

### 12.3 Échelle d'autonomie

Chaque action franchit les niveaux un à un, et se gagne action par action, jamais pour une factory entière.

| Niveau | Comportement | Qui décide de monter |
| --- | --- | --- |
| 1. Suggérer | l'agent propose, rien ne part | propriétaire |
| 2. Agir avec validation | l'agent prépare, un humain approuve, puis l'action part | propriétaire |
| 3. Agir seul sous seuil | l'agent exécute en dessous d'un montant, d'un volume ou d'un risque, l'humain valide au-dessus | propriétaire, après une période de fiabilité mesurée |
| 4. Agir seul | l'agent exécute sans validation, avec journal et alertes | propriétaire, jamais pour paiement, suppression ou envoi en masse |

Le niveau maximal d'une action est borné par sa définition : une action à risque élevé ne dépasse jamais le niveau 2.

### 12.4 Exigences du moteur

| ID | Exigence | Priorité | Critère d'acceptation |
| --- | --- | --- | --- |
| WF-01 | Chaque workflow est une machine à états ; entrées, sorties et résultat de chaque étape enregistrés | P0 | l'état d'une exécution est reconstituable à tout instant |
| WF-02 | Préconditions et postconditions vérifiées par le logiciel à chaque étape | P0 | une étape dont la postcondition échoue n'est jamais marquée réussie |
| WF-03 | Distinction entre erreur temporaire et définitive, avec reprises bornées | P0 | une panne temporaire d'un prestataire est reprise, une erreur de validation ne l'est pas |
| WF-04 | Clé d'idempotence par action externe | P0 | rejouer une étape ne duplique ni paiement, ni message, ni commande |
| WF-05 | Reprise au point d'échec, pas au début | P0 | une chaîne tombée à l'étape 7 sur 12 reprend à 7 |
| WF-06 | Compensation : une étape annulable définit son inverse | P1 | une chaîne annulée à mi-parcours laisse un état cohérent |
| WF-07 | Étapes humaines : validation, délégation, délai, escalade | P0 | une validation sans réponse à échéance escalade selon la règle |
| WF-08 | Déclencheurs par événement, horaire ou action utilisateur | P0 | `lead.won` déclenche la chaîne de livraison |
| WF-09 | Budget, délai maximal et plafond de dépense par exécution | P0 | une exécution qui dépasse son budget s'arrête proprement |
| WF-10 | Coupe-circuit global, par factory et par exécution | P0 | tout arrêter en un geste, état conservé |
| WF-11 | Agent contrôleur : une factory qui vérifie le travail des autres et alerte l'humain en cas d'anomalie | P1 | une anomalie provoquée est signalée avant le client |
| WF-12 | Couche d'accès aux modèles avec suivi des tokens, du temps et du coût, interchangeable | P0 | changer de modèle ne change pas le contrat de la factory |
| WF-13 | Repli manuel sur chaque étape | P0 | un opérateur peut accomplir à la main toute étape d'une chaîne tombée |
| WF-14 | Versionnement des factories, test sur scénarios réels avant mise en production | P1 | aucune version n'est utilisée sans avoir passé son jeu de scénarios |
| WF-15 | Protection contre l'injection : le contenu non fiable lu par un agent ne peut ni modifier ses droits ni appeler d'action hors définition | P0 | un document piégé ne déclenche aucune action non autorisée |
| WF-16 | File de validation unique pour l'opérateur : approuver, refuser, corriger | P0 | toutes les demandes en attente visibles au même endroit |

### 12.5 FactorFlow : l'éditeur

Première version volontairement limitée :

- un éditeur de chaînes **linéaires** avec un déclencheur, des étapes, des conditions simples et des étapes de validation humaine ;
- des modèles de chaînes pré-intégrés par secteur, qui portent la promesse d'un lancement en un jour ;
- l'historique complet des exécutions avec leur coût ;
- aucune place de marché ouverte à des développeurs tiers avant que le contrat entre factories soit stable.

Une chaîne qui s'embranche, boucle ou s'exécute en parallèle vient après.

## 13. Les huit problèmes que l'IA seule ne résout pas

Chacun des huit problèmes du document de travail devient ici une exigence testable ; ceux qu'aucune section précédente ne couvrait ont leurs propres exigences en 13.2.

### 13.1 Correspondance problème, exigence, critère

| # | Problème | Exigences qui y répondent | Critère d'acceptation global |
| --- | --- | --- | --- |
| 1 | Intégration des logiciels et des données | INT-01 à INT-05, CRM-08, CRM-10, section 5 | une donnée saisie une fois n'est jamais ressaisie ; tout échec de synchronisation est visible |
| 2 | Fiabilité des agents autonomes | WF-01 à WF-06, WF-14 | une chaîne de douze étapes tombe à l'étape 7 et reprend à 7 sans doublon |
| 3 | Sécurité, permissions et contrôle des actions | section 3, section 14, WF-15 | aucun agent n'exécute une action hors de sa définition |
| 4 | Mémoire et compréhension organisationnelle | MEM-01 à MEM-05 | pour toute règle appliquée, on retrouve sa source, sa date et sa version |
| 5 | Mesure des résultats et observabilité | section 15, WF-09, WF-12 | le coût, la durée et le taux d'intervention humaine de chaque workflow sont lisibles |
| 6 | Orchestration des workflows complexes | WF-01 à WF-10, PLM-05 à PLM-07 | `lead.won` mène à un site publié sans relance manuelle |
| 7 | Conformité, traçabilité et responsabilité | section 14, section 17, ERP-04 à ERP-06 | on reconstitue qui a fait quoi, avec quelles données et quelle version, six mois après |
| 8 | Adoption par les employés | ADO-01 à ADO-04, CRM-15 | un nouvel utilisateur accomplit sa première tâche sans assistance |

### 13.2 Exigences complémentaires

| ID | Exigence | Priorité | Critère d'acceptation |
| --- | --- | --- | --- |
| INT-01 | Connecteurs par API, webhooks, import de fichiers, avec statut de chaque connexion | P1 | l'état de chaque connecteur est visible et alerte en cas d'échec |
| INT-02 | Normalisation vers le modèle commun : identifiants, formats, devises | P1 | deux sources décrivant le même tiers produisent une seule fiche |
| INT-03 | Détection et fusion de doublons avec trace de la fusion | P1 | une fusion est réversible depuis le journal |
| INT-04 | Suivi de chaque synchronisation : réussies, échouées, en attente, avec raison | P1 | une synchronisation échouée est reprise ou signalée, jamais perdue |
| INT-05 | Permissions de la source respectées à l'import : un connecteur n'expose pas ce que l'utilisateur ne pouvait pas voir | P0 | une donnée restreinte à la source reste restreinte dans Hivation |
| MEM-01 | Mémoire d'entreprise : documents et sources autorisés indexés, entités, relations, décisions | P2 | une question sur un tarif négocié retrouve la règle et son document |
| MEM-02 | Chaque fait porte date, source, niveau de confiance et version | P2 | un fait modifié conserve son historique |
| MEM-03 | Distinction fait confirmé, hypothèse, information obsolète | P2 | un agent ne présente jamais une hypothèse comme un fait |
| MEM-04 | Conflit entre sources signalé à l'humain, jamais tranché en silence | P2 | deux tarifs contradictoires produisent une alerte |
| MEM-05 | Permissions appliquées à chaque consultation de la mémoire | P0 | un agent ne lit que ce que sa définition et son rôle autorisent |
| ADO-01 | Bibliothèque de chaînes approuvées et pré-intégrées par secteur | P1 | un nouveau client lance une chaîne du catalogue sans la construire |
| ADO-02 | Interfaces adaptées au rôle : l'affilié, le commercial, le client ne voient que leur espace | P1 | aucun écran n'expose une fonction hors du rôle |
| ADO-03 | Indicateurs d'adoption et de qualité : fonctions utilisées, tâches abandonnées | P2 | tableau de bord par rôle et par société |
| ADO-04 | Aide intégrée à l'écran, documentation pour chaque fonction | P1 | chaque fonction livrée a son article de documentation le jour de sa sortie |

### 13.3 Principe d'attribution des responsabilités

**Le modèle** interprète une demande, extrait et résume, classe, propose un plan, produit du texte, du code ou des contenus, choisit parmi des outils autorisés, aide sur les cas ambigus.

**Le logiciel** garantit les permissions, l'état durable des opérations, la validation des données, l'idempotence, les transactions et contrôles métier, les reprises et compensations, les journaux d'audit, les limites de coût, les approbations humaines, la surveillance et les alertes.

Toute exigence de ce document qui porte sur la seconde liste est implémentée en code déterministe, jamais par une consigne donnée à un modèle.

## 14. Sécurité, isolation et gouvernance des agents

### 14.1 Isolation entre sociétés

| ID | Exigence | Priorité | Critère d'acceptation |
| --- | --- | --- | --- |
| SEC-01 | Toute table porte `company_id` ; toute requête le filtre, imposé par la couche d'accès et non par chaque développeur | P0 | un test tente de lire une ligne d'une autre société par chaque route de l'API : 0 résultat |
| SEC-02 | Les tests d'isolation sont écrits à partir des règles de ce document, pas générés depuis le code | P0 | la suite échoue si une requête oublie le filtre |
| SEC-03 | Les fichiers (logos, contrats, pièces) sont stockés sous un préfixe par société, accès par URL signée à durée courte | P0 | une URL expirée ou d'une autre société renvoie un refus |
| SEC-04 | Les domaines et sous-domaines sont rattachés à une seule société ; une reprise de domaine est impossible sans preuve | P0 | un domaine déjà rattaché ne peut pas être revendiqué par une autre société |
| SEC-05 | Aucun secret dans le code, les journaux ou les réponses ; secrets chiffrés, rotation documentée | P0 | un scan du dépôt et des journaux ne trouve aucune clé |

### 14.2 Accès et authentification

| ID | Exigence | Priorité | Critère d'acceptation |
| --- | --- | --- | --- |
| SEC-06 | Connexion par e-mail, GitHub ou Google ; double authentification obligatoire pour les rôles qui touchent à l'argent ou aux publicités | P0 | un administrateur sans seconde étape ne peut pas valider un paiement |
| SEC-07 | Les permissions sont évaluées une seule fois, dans l'API, selon la matrice de la section 3 | P0 | l'interface masque, l'API refuse : les deux sont testés |
| SEC-08 | Sessions révocables, appareils listés, déconnexion à distance | P1 | une session révoquée échoue à la requête suivante |
| SEC-09 | Accès du support à une société : temporaire, motivé, journalisé, visible par la société | P1 | chaque accès support apparaît dans le journal de la société |

### 14.3 Gouvernance des agents

| ID | Exigence | Priorité | Critère d'acceptation |
| --- | --- | --- | --- |
| GOV-01 | Chaque agent a une définition versionnée : outils autorisés, données lisibles, actions possibles, seuils, niveau d'autonomie | P0 | un agent appelle un outil absent de sa définition : refus et alerte |
| GOV-02 | Échelle d'autonomie : suggérer, valider, agir sous seuil, agir seul ; actions à risque élevé plafonnées au niveau 2 | P0 | un paiement, une publicité à budget élevé ou un envoi de masse ne s'exécutent jamais sans validation humaine |
| GOV-03 | Budgets par agent et par société (jetons, dépense publicitaire, messages) avec coupure automatique | P0 | le dépassement du budget stoppe l'agent et prévient |
| GOV-04 | Coupe-circuit global et par agent, actif en moins de 10 secondes | P0 | l'activation arrête toute action sortante |
| GOV-05 | Un agent contrôleur indépendant vérifie les sorties à risque avant exécution ; les verdicts de livraison restent binaires et sans modèle | P1 | un contenu non conforme est bloqué avant publication |
| GOV-06 | Protection contre l'injection : le contenu externe (e-mails, pages, fichiers) est traité comme donnée, jamais comme consigne | P0 | un message contenant « ignore tes règles » ne change aucune action |
| GOV-07 | Toute action d'agent est journalisée : entrée, décision, outil, résultat, coût, version de définition | P0 | l'historique d'une action se reconstitue en moins d'une minute |
| GOV-08 | Les données personnelles ne sont envoyées à un modèle que si la définition de l'agent l'exige, et réduites au strict nécessaire | P1 | un journal d'envoi liste les champs transmis |

### 14.4 Journal d'audit

Le journal est append-only, horodaté en UTC, lisible par rôle, conservé selon la durée de la section 17. Il couvre : connexions, changements de permission, décisions d'agents, validations humaines, écritures comptables, publications, modifications de plans d'affiliation, exports de données. Une entrée contient : qui (humain ou agent), quoi, sur quel objet, avant, après, pourquoi, version de règle appliquée.

## 15. Observabilité et économie unitaire

La promesse « 20 000 $ → beaucoup moins » n'est vraie que si le coût est mesuré. Le logiciel mesure donc ses propres coûts, par société cliente et par site livré.

### 15.1 Mesures obligatoires

| ID | Mesure | Calcul | Usage |
| --- | --- | --- | --- |
| OBS-01 | Durée de mise en ligne | de la signature (`lead.won`) à la 4e vérification de « lancé » | prouve ou réfute « 2 mois → 1 jour » |
| OBS-02 | Coût par site livré | jetons + hébergement + domaine + services tiers + temps humain valorisé | prouve ou réfute « 20 000 $ → beaucoup moins » |
| OBS-03 | Coût par exécution de chaîne | somme des coûts de chaque étape | repère les chaînes trop chères |
| OBS-04 | Taux d'intervention humaine | étapes reprises à la main / étapes totales | mesure l'autonomie réelle |
| OBS-05 | Taux d'échec et de reprise | échecs, reprises réussies, abandons | mesure la fiabilité |
| OBS-06 | Marge par société cliente | recettes encaissées moins coûts d'exécution et de publicité | alimente le budget publicitaire |
| OBS-07 | Coût d'acquisition et retour publicitaire | dépense / conversions attribuées ; marge / dépense | pilote la section 7 |
| OBS-08 | Qualité perçue | retours clients, reprises après livraison, tickets | détecte les dérives silencieuses |

### 15.2 Exigences

| ID | Exigence | Priorité | Critère d'acceptation |
| --- | --- | --- | --- |
| OBS-09 | Chaque exécution enregistre durée, coût, étapes, reprises et intervenant humain | P0 | une exécution sans coût enregistré est refusée par un contrôleur |
| OBS-10 | Tableau de bord par rôle : fondateur, société cliente, affilié | P1 | chaque rôle voit uniquement ses mesures |
| OBS-11 | Alertes sur seuil : coût par site, taux d'échec, dépense publicitaire, latence | P1 | une alerte arrive avant le dépassement et non après |
| OBS-12 | Rejeu d'une exécution à partir de son journal pour comprendre un échec | P1 | une exécution échouée se rejoue en mode simulation |
| OBS-13 | Les chiffres de la promesse commerciale sont issus de ces mesures, jamais d'estimations | P0 | aucune page de vente ne cite un chiffre absent du tableau de bord interne |

### 15.3 Modèle de coûts à renseigner

| Poste | Nature | À mesurer dès le premier site |
| --- | --- | --- |
| Modèles d'IA | variable | jetons par site, par chaîne |
| Hébergement et base de données | variable puis fixe | coût par société active |
| Domaine et e-mail | par site | prix réel d'achat et de renouvellement |
| Paiements | pourcentage | frais par transaction |
| Services tiers (e-mail, SMS, vérifications) | variable | coût par message ou par appel |
| Temps humain | variable | minutes par site, valorisées à un tarif fixé |
| Publicité | hors coût de livraison | suivie séparément, jamais mélangée au coût de mise en ligne |

Le premier client étant le fondateur pendant deux à trois mois, ces mesures servent de base de référence : aucune promesse chiffrée n'est faite avant d'avoir au moins dix sites livrés et mesurés.

## 16. Exigences non fonctionnelles

| ID | Domaine | Exigence | Critère d'acceptation |
| --- | --- | --- | --- |
| NF-01 | Hors ligne | Les opérations de terrain (CRM par vagues, saisies) fonctionnent sans réseau, avec identifiants générés côté client et synchronisation à la reconnexion | une journée de saisie hors ligne se synchronise sans doublon ni perte |
| NF-02 | Conflits | Les conflits de synchronisation suivent une règle déclarée par type de donnée, jamais un écrasement silencieux | un conflit produit une entrée visible et résolvable |
| NF-03 | Devises | Montants en entiers de la plus petite unité plus code de devise ; conversion horodatée avec le taux utilisé | aucun calcul monétaire en nombre décimal flottant |
| NF-04 | Langues | Français et anglais dès le départ ; textes hors du code | une nouvelle langue s'ajoute par fichier de traduction |
| NF-05 | Fuseaux | Horodatages stockés en UTC, affichés dans le fuseau de l'utilisateur ; fuseau de la société pour les rapports | un rapport de fin de journée est identique quel que soit le lieu de consultation |
| NF-06 | Téléphones | Format E.164, validation par pays | un numéro local et son équivalent international donnent la même fiche |
| NF-07 | Performance | Interface : premier affichage utile en moins de 2,5 s sur mobile moyen ; sites générés : Web Vitals dans le vert | un contrôleur de publication refuse un site hors seuil |
| NF-08 | Disponibilité | Objectif de 99,5 % pour l'application, 99,9 % pour les sites publiés (statiques ou régénérés) | une panne de l'application n'interrompt pas les sites déjà publiés |
| NF-09 | Sauvegardes | Sauvegarde quotidienne de la base et des fichiers, restauration testée chaque mois | une restauration complète réussit en moins de 4 heures |
| NF-10 | Reprise | Toute opération longue est reprenable après redémarrage | un redémarrage au milieu d'une chaîne n'entraîne ni doublon ni perte |
| NF-11 | Accessibilité | Interfaces et sites générés lisibles au clavier, contrastes conformes, textes alternatifs | un contrôle automatisé d'accessibilité passe avant publication |
| NF-12 | Mobile d'abord | Les écrans de terrain et d'affilié sont conçus pour téléphone | chaque parcours clé se termine sur un écran de 360 px de large |
| NF-13 | Tests | Tests de bout en bout sur les parcours critiques, règles automatisées en intégration continue | aucune fusion de code si un parcours critique échoue |
| NF-14 | Migrations | Schéma de données versionné, migrations réversibles | un retour arrière de migration restaure l'état précédent |

## 17. Cadre juridique et conformité

Cette section liste les points à faire valider par un juriste avant toute vente ; elle ne constitue pas un avis juridique.

| ID | Sujet | Exigence ou point à traiter | État |
| --- | --- | --- | --- |
| JUR-01 | Capacité du fondateur | Au Bénin, la majorité est à 18 ans : création d'entité, immatriculation, compte bancaire et Mobile Money exigent un représentant légal majeur | à traiter avant la première vente |
| JUR-02 | Entité contractante | Les contrats clients, affiliés et fournisseurs sont signés par une entité identifiée, jamais par une personne mineure | bloquant |
| JUR-03 | Encaissement en dollars | Sans entité étrangère, passer par un marchand officiel (merchant of record) qui encaisse et reverse ; conditions à vérifier par pays | à vérifier |
| JUR-04 | Données personnelles | Base légale, consentement, durée de conservation, droits d'accès et de suppression, registre des traitements ; lois locales et européennes selon l'origine des personnes | à traiter |
| JUR-05 | Prospection | Consentement et désinscription pour e-mail, SMS, WhatsApp ; respect des règles de chaque opérateur | exigence logicielle (CRM-xx) |
| JUR-06 | Publicité réglementée | Santé, finance, jeux, produits réglementés : catégories sensibles avec validation humaine obligatoire et refus par défaut | exigence logicielle (PUB-xx) |
| JUR-07 | Règles des plateformes publicitaires | Respect des politiques de chaque plateforme ; aucun contournement ni rotation de comptes pour échapper aux règles | exigence logicielle |
| JUR-08 | Affiliation | Contrats d'affiliés, mentions de partenariat dans les contenus, interdiction des allégations trompeuses, pas de rémunération par recrutement | exigence logicielle (AFF-13) |
| JUR-09 | Fiscalité | TVA, retenues, déclaration des commissions versées à des affiliés de pays différents | à faire valider |
| JUR-10 | Propriété intellectuelle | Les contenus générés, logos, images et polices ont une licence documentée ; aucune image de personnalité sans droit | exigence logicielle (CMS-xx) |
| JUR-11 | Conditions d'utilisation | CGU, politique de confidentialité, mentions légales générées par site et adaptées au pays | exigence logicielle |
| JUR-12 | Responsabilité | Le contrat clarifie qui répond du contenu publié, des promesses faites aux consommateurs et des produits vendus | à traiter |
| JUR-13 | Conservation | Pièces comptables et journaux d'audit conservés selon la durée légale la plus longue applicable | à définir |

### 17.1 Le cas MEDVi comme avertissement

L'entreprise MEDVi a bâti son volume sur des produits dont la fenêtre légale s'est fermée et a reçu un avertissement réglementaire. Hivation ne propose pas de produits réglementés sans validation et ne reproduit pas ce risque : le contrôle de conformité des créatifs et des offres (PUB-xx) est un verrou bloquant, pas une alerte.

## 18. Feuille de route et jalons

L'ordre suit les sept étapes ; chaque jalon se termine par une porte binaire : on ne passe à la suivante que si tous les critères de la porte sont verts. Les durées sont des cibles du fondateur, à recaler après la première mesure réelle (section 15).

| Jalon | Contenu | Porte de sortie (binaire) |
| --- | --- | --- |
| J1 CRM par vagues | CRM-01 à CRM-16, terrain hors ligne, messagerie encadrée | une vague complète saisie hors ligne se synchronise sans perte ; tests d'isolation verts |
| J2 Socle API, événements, tiers, portées | section 5, SEC-01 à SEC-09, catalogue d'événements | 0 lecture inter-sociétés sur toutes les routes ; un événement `lead.won` est émis et reçu |
| J3 PLM | objets, contrat de projet, contrôleurs C01 à C13, boucle fermée | un dossier va de `lead.won` à un livrable validé sans intervention hors cas prévus |
| J4 CMS | multi-sociétés par domaine, thèmes en données, blocs, publication contrôlée | un site est publié sur son domaine avec paiement et suivi actifs |
| J5 ERP socle | grand livre, devis, factures, numérotation, périodes | le grand livre est équilibré ; une facture validée est immuable |
| J6 ERP organisation, rémunérations, publicité, affiliés | sections 7 et 8, commissions, réserves | une conversion encaissée produit commission et budget publicitaire calculés depuis le grand livre |
| J7 FactorFlow | moteur d'agents, éditeur linéaire, échelle d'autonomie | une chaîne de douze étapes reprend après échec à l'étape 7 sans doublon |
| J8 Mesure et promesse | dix sites livrés et mesurés, tableau de bord OBS | durée médiane et coût médian par site calculés ; la promesse commerciale n'est rédigée qu'après |
| J9 Première vente | entité juridique, conditions, encaissement | JUR-01 à JUR-03 levés |

### 18.1 Principes de planification

- Le fondateur est son premier client pendant deux à trois mois : chaque jalon est d'abord utilisé en conditions réelles avant toute vente.
- La vérification est le goulot : chaque jalon prévoit autant de temps pour spécifier et tester que pour écrire.
- Rien ne passe en production sans tests écrits depuis les règles de ce document.
- FactorFlow reste en dernier : les chaînes ne sont automatisées qu'après avoir été faites à la main et mesurées.

## 19. Risques et parades

| # | Risque | Gravité | Parade | Exigences liées |
| --- | --- | --- | --- | --- |
| R1 | Fuite de données entre sociétés | critique | filtre imposé par la couche d'accès, tests écrits depuis les règles | SEC-01, SEC-02 |
| R2 | Agent qui dépense ou publie hors cadre | critique | niveau d'autonomie plafonné, budgets, coupe-circuit | GOV-02 à GOV-04 |
| R3 | Publicité bloquée ou compte suspendu | élevée | contrôle de conformité bloquant, pas de contournement, validation humaine des catégories sensibles | PUB-xx, JUR-06, JUR-07 |
| R4 | Fraude d'affiliés (faux leads, auto-parrainage) | élevée | détection, réserve, annulation par contre-passation | AFF-xx |
| R5 | Produit réglementé vendu sans autorisation | critique | catalogue validé, refus par défaut | JUR-06, 17.1 |
| R6 | Erreur comptable irréversible | élevée | grand livre append-only, périodes closes, contre-passation | ERP-xx |
| R7 | Fiabilité d'une longue chaîne d'agents | élevée | étapes courtes, idempotence, reprise, éditeur linéaire d'abord | WF-xx |
| R8 | Coût réel supérieur à la promesse | élevée | mesure dès le premier site, pas de chiffre avant dix sites | OBS-01 à OBS-13 |
| R9 | Capacité juridique du fondateur mineur | bloquante pour la vente | représentant légal majeur ou attente de la majorité avant toute signature | JUR-01, JUR-02 |
| R10 | Dépendance à un prestataire (IA, hébergement, paiement) | moyenne | interfaces d'abstraction, données exportables | INT-01 |
| R11 | Fatigue et charge du fondateur unique | moyenne | périmètre par jalon, portes binaires, automatisation du contrôle | section 18 |
| R12 | Hypothèse de marché non vérifiée | moyenne | démontage de comparables avant promesse | section 20 |
| R13 | Injection de consignes via contenu externe | élevée | contenu externe traité comme donnée | GOV-06 |
| R14 | Dette de maintenance de WordPress | moyenne | WordPress facturé à part, Next.js par défaut | CMS-xx |

## 20. Critères de réussite, hypothèses et questions ouvertes

### 20.1 Critères de réussite

| Critère | Seuil | Mesure |
| --- | --- | --- |
| Durée de mise en ligne | un jour ou moins, médiane sur dix sites | OBS-01 |
| Coût par site livré | nettement inférieur à la référence de 20 000 $, seuil chiffré après dix sites | OBS-02 |
| Taux d'intervention humaine | en baisse à chaque jalon | OBS-04 |
| Fuites inter-sociétés | zéro | SEC-01 |
| Grand livre | équilibré en permanence | ERP-xx |
| Contrôles de « lancé » | 4 sur 4 verts pour chaque site | section 1 |

### 20.2 Hypothèses à vérifier

1. La référence de 20 000 $ de MEDVi correspond à des coûts réellement comparables aux nôtres ; sa ventilation est inconnue.
2. Les chiffres de chiffre d'affaires de MEDVi viennent de la presse et de communiqués de l'entreprise, non d'un audit.
3. Un marché solvable existe pour des personnes seules qui possèdent l'acquisition et louent l'exécution.
4. Un marchand officiel permet d'encaisser en dollars sans entité étrangère dans les pays cibles.
5. Les plateformes publicitaires acceptent l'automatisation par API aux volumes prévus.

### 20.3 Questions ouvertes

| # | Question | Décision attendue |
| --- | --- | --- |
| Q1 | Construire ou intégrer le moteur comptable de l'ERP | avant J5 |
| Q2 | Quel marchand officiel et quels pays au départ | avant J9 |
| Q3 | Quelles catégories d'offres sont acceptées au lancement et lesquelles sont refusées par défaut | avant J6 |
| Q4 | Quel taux de réinvestissement publicitaire et quel plafond journalier par défaut | avant J6 |
| Q5 | Quel représentant légal majeur ou quelle entité pour les contrats | avant J9 |
| Q6 | Quel tarif horaire pour valoriser le temps humain dans OBS-02 | avant J8 |

### 20.4 Plan de démontage du marché

Pour chaque société comparable (au moins cinq, dont MEDVi), remplir la même grille avant de rédiger la promesse commerciale :

| Champ | Question |
| --- | --- |
| Couches possédées et louées | qui fait l'acquisition, l'offre, l'exécution, la conformité |
| Fournisseurs | outils et prestataires réellement utilisés |
| Délai avant le premier euro | du lancement à la première recette |
| Coût avant recettes, hors publicité | ce qu'il a fallu débourser |
| Ce qui a été assemblé à la main | ce que le logiciel doit automatiser |
| Risque réglementaire | exposition et sanctions connues |
| Sources | liens et dates, avec niveau de confiance |

### 20.5 Sources

- Forbes et New York Times sur MEDVi (chiffres 2025, deux employés, 401 M$) ; communiqué GlobeNewswire (trajectoire 2026, déclaration de l'entreprise) ; glp1-us.com ; décisions de la FDA et de la cour d'appel du cinquième circuit citées en section 2 et dans le document « MEDVi — démontage du modèle ».
- Documents de travail fournis par le fondateur : liste des huit problèmes, notes de produit, conversation sur la documentation Hivation.
