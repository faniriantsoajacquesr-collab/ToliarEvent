# Fiche détaillée du projet ToliarEvent

Date de l'analyse : 11 septembre 2026. Document fondé sur le code présent dans le dépôt local.

## 1. Présentation générale

ToliarEvent est une application web de gestion événementielle destinée principalement aux organisateurs de Toliara, à Madagascar. Elle regroupe la présentation publique des événements et les outils internes nécessaires à leur préparation et à leur exploitation : équipes, tâches, billets, commandes et suivi financier.

Sa proposition de valeur est de centraliser des informations qui seraient autrement dispersées entre messages, listes de participants, billets papier et tableaux financiers. Le positionnement local apparaît explicitement dans la page d'accueil ; la billetterie utilise notamment l'ariary, représenté par « Ar ».

Le produit comporte deux espaces : un site public pour découvrir les événements et commander des billets, et une application authentifiée pour les organisateurs et leur personnel.

Cette fiche décrit les fonctions et les règles visibles dans le code. Elle ne certifie pas leur bon fonctionnement en production : aucun parcours connecté, paiement réel ou déploiement n'a été testé pour cette analyse.

## 2. Utilisateurs et responsabilités

| Profil | Usage prévu |
| --- | --- |
| Visiteur / acheteur | Consulter les événements publiés, lire une page événement et passer une commande de billets sans compte organisateur. |
| Utilisateur inscrit | Confirmer son adresse électronique, compléter son profil, créer ou rejoindre une organisation. |
| Administrateur d'organisation | Gérer les événements et l'équipe, préparer les billets, administrer les commandes et publier les pages événement. |
| Staff | Participer aux événements, suivre les tâches et utiliser les outils de billetterie selon les autorisations. |
| Administrateur de plateforme | Accepter ou refuser les demandes de création d'organisation via les routes d'administration prévues. |

Le rôle d'administrateur d'organisation est distinct de celui d'administrateur de plateforme. Ce dernier est déterminé côté serveur par une liste d'adresses configurée dans `PLATFORM_ADMIN_EMAILS`.

Le modèle de données permet plusieurs organisations. L'interface et plusieurs traitements s'appuient toutefois sur une organisation courante : un véritable parcours de bascule entre plusieurs organisations pour un même utilisateur reste à vérifier.

## 3. Site public et page d'accueil

La page `Frontend/src/pages/Home.tsx` est la vitrine commerciale. Elle affiche une présentation de ToliarEvent, une illustration, des éléments animés et des sections de présentation, de fonctionnement et de contact.

Deux actions principales sont proposées :

- « Créer un événement » : ouvre l'authentification si nécessaire, ou dirige l'utilisateur connecté vers son parcours applicatif.
- « Voir les événements » : ouvre le catalogue public.

Les mentions « 5+ », « QR » et « 24/7 » de cette page sont des éléments de présentation codés dans l'interface. Elles ne constituent pas des statistiques d'utilisation calculées depuis la base.

Le site propose aussi des pages de confidentialité et de conditions d'utilisation. Leur présence ne constitue pas une validation juridique de leur contenu.

## 4. Comptes et accès aux organisations

Le code prévoit l'inscription et la connexion par adresse électronique et mot de passe, la confirmation de l'adresse, la déconnexion, le renouvellement de jeton et des routes de récupération/réinitialisation du mot de passe.

Le parcours d'intégration comprend la complétion du profil avec les informations personnelles, puis la création d'une organisation ou son rattachement au moyen d'un code. Des compétences peuvent être associées aux profils.

Les organisations disposent des états `pending`, `active` et `rejected`. Une organisation en attente ou refusée entraîne une redirection vers une page dédiée et des restrictions côté serveur. Les membres disposent également d'un indicateur de validation : validation de l'organisation et validation du membre sont deux notions différentes.

Les routes privées vérifient la connexion, le profil et l'organisation. Les commandes et la publication possèdent en plus une restriction explicite au rôle administrateur dans le routeur frontend.

## 5. Gestion des événements

Un événement est rattaché à une organisation. Les informations centrales comprennent le titre, la description, le lieu et les dates de début et de fin. Le code exploite également des catégories et les postes associés aux événements.

Les fonctions prévues sont la création, la consultation, la modification et la suppression des événements. Le tableau de bord utilise une sélection d'événement commune à plusieurs modules, afin de consulter les billets, commandes, tâches ou finances dans le même contexte.

Les membres du staff disposent d'une vue événement spécifique, différente de celle de l'administrateur.

## 6. Équipes, postes et candidatures

Le projet distingue les membres d'une organisation et les personnes affectées à un événement.

Les postes représentent les besoins opérationnels, par exemple l'accueil, la sécurité ou la billetterie. Ils sont rattachés à un événement et peuvent comporter un nombre de places nécessaires.

Le code prévoit les candidatures aux événements, leur validation, leur retrait ou leur suppression, ainsi que la possibilité de renouveler certaines demandes. L'administration des membres comprend des actions individuelles et groupées.

Les compétences sont enregistrées séparément et reliées aux profils. Elles sont également utilisées pour exprimer les besoins des tâches du planning.

## 7. Planning et tâches

Chaque tâche appartient à un événement et possède un titre, une description, une date de début, une date de fin, un statut, un responsable éventuel et des compétences requises.

Le module permet de créer, consulter, modifier et supprimer les tâches. Il présente un diagramme de Gantt et propose des filtres par texte, état et tâches personnelles. Il calcule des indicateurs comme les tâches terminées, en cours et en retard.

Ce module sert à répartir et suivre le travail. Aucun moteur avancé d'optimisation automatique des ressources ou de calcul de chemin critique n'a été établi par cette lecture.

## 8. Types de billets et production imprimable

Les types de billets sont configurables par événement : nom, prix, devise, avantages et activation. Cela permet de représenter plusieurs offres, comme un billet standard et un billet VIP.

L'éditeur de billets et badges propose une personnalisation à partir d'un visuel, avec configuration de la disposition et du QR code. Le serveur génère des PDF imprimables sur pages A4. Des utilitaires spécifiques gèrent la mise en page, les marges, les libellés et le QR.

La génération peut créer plusieurs billets avec des identifiants uniques et une numérotation. Le dépôt contient également une route de génération asynchrone et un worker séparé qui traite les demandes puis dépose les PDF dans Supabase Storage. Ce worker nécessite sa propre exécution et une table `ticket_jobs` qui n'est pas définie dans le SQL livré.

L'éditeur est accessible via une route publique, mais ses opérations liées aux événements et à la génération doivent être distinguées de la simple ouverture de l'écran.

## 9. Vente, activation et contrôle d'entrée

Le cycle de vie principal d'un billet est :

```text
Billet créé : valid
        ↓ activation / vente
Billet activé : vendu
        ↓ contrôle à l'entrée
Billet consommé : utilise
```

Le nom `valid` est trompeur si on le lit comme « autorisé à entrer » : le contrôle d'entrée exige un billet vendu/activé.

La route de scan distingue deux actions : `activate` pour enregistrer l'activation et `use` pour l'entrée. Elle vérifie l'utilisateur et son accès à l'événement, signale les billets introuvables, refuse un billet non activé et détecte un billet déjà utilisé. Elle enregistre l'identité du vendeur ou du contrôleur dans les champs correspondants.

Le frontend dispose d'outils de lecture QR par caméra et d'analyse d'image. Un mécanisme de restauration de billets imprimés à partir d'une capture utilise la lecture QR et la reconnaissance de texte avec Tesseract.js. Son exactitude dépend de la qualité de l'image et n'a pas été mesurée ici.

La gestion comprend également des modifications de statut et suppressions en lot. La présence de ces outils ne signifie pas qu'un mode hors ligne est disponible : les opérations métier observées reposent sur le serveur et la base.

## 10. Commandes et paiement Mobile Money

Le parcours public permet de sélectionner un type de billet et une quantité, de renseigner les coordonnées de l'acheteur, de choisir un moyen de paiement et de communiquer une référence de transaction.

Le paiement est réalisé séparément auprès du moyen Mobile Money indiqué. L'application enregistre la déclaration de paiement ; aucune confirmation automatique par une API d'opérateur n'a été identifiée dans ce parcours.

Le backend contrôle notamment l'existence de l'événement, l'activation du type de billet et du moyen de paiement, le montant attendu et l'unicité de la référence de transaction. Il recalcule le montant à partir du tarif enregistré. Le traitement borne la quantité entre 1 et 20, sans que cela constitue à lui seul une validation complète des valeurs numériques possibles.

La commande est créée avec le statut `pending`. Les billets et leurs relations à la commande sont enregistrés dans `tickets`, `orders` et `order_items`.

L'interface administrateur permet de consulter les commandes d'un événement et leurs indicateurs, puis de les valider, dévalider ou supprimer, individuellement ou en lot. Le projet doit donc être présenté comme une billetterie avec vérification manuelle du paiement, et non comme une intégration de paiement automatiquement rapprochée avec l'opérateur.

## 11. Suivi financier

Le module financier permet de saisir et consulter les recettes et dépenses, avec date, montant, titre, description et catégorie. Les catégories comportent un champ de référence comptable `pcg`.

L'interface présente des totaux et un journal en comptes en T. La création, la modification et la suppression de transactions sont prévues ; certaines actions sont masquées pour les utilisateurs staff.

Il s'agit d'un suivi financier événementiel. La lecture n'établit pas une comptabilité réglementaire complète, une déclaration fiscale, une facturation conforme à une réglementation particulière ou un rapprochement bancaire automatique. Le caractère exhaustif du lien entre ventes et écritures financières doit aussi être vérifié en fonctionnement.

## 12. Publication des pages événement

Un éditeur permet de composer une page publique avec titre, sous-titre, textes descriptifs, images, lieu, informations de contact, liens sociaux et offres de billets visibles.

Trois dispositions sont prévues : `default`, `compact` et `split`. Cinq thèmes sont proposés : `indigo`, `cyberpunk`, `forest`, `crimson` et `amber`. L'éditeur permet aussi de personnaliser le bouton principal et de masquer la section de présentation.

Le module comprend la sauvegarde, la prévisualisation et la gestion de publication. Les images peuvent être compressées côté navigateur avant leur envoi.

Les liens vers Facebook, Instagram, TikTok ou d'autres plateformes sont des liens configurables. Ils ne prouvent pas l'existence d'une publication automatisée sur les réseaux sociaux.

## 13. Architecture technique

| Couche | Technologie et responsabilité |
| --- | --- |
| Interface | React 19, TypeScript, React Router : pages, navigation, formulaires et état de session. |
| Construction frontend | Vite 8, TypeScript 6 et ESLint ; Tailwind CSS 3 et styles CSS pour l'apparence. |
| API | Node.js et Express 5, principalement regroupés sous `/api/auth`. |
| Authentification | Supabase Auth, jetons d'accès et de renouvellement. |
| Données | PostgreSQL via Supabase, relations métier et politiques RLS. |
| Fichiers | Supabase Storage pour des visuels et documents générés. |
| PDF et images | `pdf-lib`, `qrcode`, `sharp`. |
| Scan et OCR | `html5-qrcode`, `jsqr`, `tesseract.js`. |

Les versions indiquées proviennent des manifestes du dépôt, pas d'une vérification des versions effectivement installées.

Le flux principal est : navigateur → API Express → Supabase. Des utilitaires Supabase sont également présents côté frontend. Le serveur possède un client transmettant le jeton utilisateur pour appliquer les politiques RLS, ainsi qu'un client privilégié pour certaines opérations.

Le backend est largement concentré dans `Backend/Routes/auth.js`, qui contient plus de 5 000 lignes et couvre aussi bien l'authentification que les événements, les billets, les finances et les commandes. Des fichiers de contrôleurs et de routes supplémentaires existent, mais `Backend/index.js` monte principalement ce routeur central.

## 14. Modèle de données

| Domaine | Tables définies dans `db.sql` |
| --- | --- |
| Identité et organisations | `profiles`, `organizations`, `organization_members` |
| Événements et équipe | `events`, `posts`, `event_staff` |
| Compétences | `skills`, `profile_skills` |
| Planning | `tasks` |
| Billetterie | `tickets`, `ticket_type`, `ticket_designs` |
| Finance | `transactions`, `transactions-categories` |
| Commandes et paiement | `payment_method`, `orders`, `order_items` |

Les relations principales sont : organisation → événements ; événement → postes, tâches et billets ; profil → adhésions, compétences et affectations ; commande → lignes de commande → billets.

Le code utilise aussi `event_categories`, `event_landing_pages` et `ticket_jobs`, absentes de ce fichier SQL. Le schéma réellement déployé peut être plus complet, mais il n'a pas été consulté.

## 15. Routes principales de l'interface

| Route | Fonction |
| --- | --- |
| `/` | Accueil public |
| `/evenements` | Catalogue public |
| `/evenements/:eventId` | Page publique d'un événement |
| `/login`, `/signup`, `/auth/confirm-email` | Authentification |
| `/complete-profile` | Complétion du profil |
| `/organization-choice`, `/organization-pending` | Parcours organisation |
| `/events` | Gestion interne des événements |
| `/staff` | Équipe |
| `/tickets` | Billetterie |
| `/commandes` | Commandes, accès administrateur |
| `/planning` | Tâches et Gantt |
| `/finance` | Transactions et journal |
| `/publication` | Gestion des publications, accès administrateur |
| `/publication-builder/:eventId` | Éditeur de page publique |
| `/badge-editor` | Éditeur de billets et badges |
| `/confidentialite`, `/cgu` | Pages légales |

Les anciens chemins `/dashboard/...` sont redirigés vers les routes actuelles.

## 16. Configuration et lancement

Le frontend se lance avec `npm run dev` depuis `Frontend`. Le backend se lance avec `npm start` ou `npm run dev` depuis `Backend`. Le port serveur par défaut est 5000 ; l'API frontend utilise par défaut `http://localhost:5000/api/auth`.

Le build frontend exécute la génération du sitemap, la compilation TypeScript puis Vite. Le dépôt contient une configuration Vercel et des URL de référence vers Vercel pour le frontend et Render pour le backend. Ces éléments indiquent une configuration de déploiement prévue, sans confirmer la disponibilité actuelle des services.

Point de configuration important : `Frontend/vite.config.ts` charge les variables depuis le dossier `Backend`. Le serveur lit actuellement `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` et `VITE_SUPABASE_SERVICE_ROLE_KEY`, alors que l'exemple backend documente notamment `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`. Une simple copie des exemples ne suffit donc pas nécessairement.

## 17. État actuel et limites constatées

Le dépôt contient une application métier substantielle, avec des écrans et des traitements serveur couvrant de nombreux parcours. Son niveau de préparation à la production ne peut pas être déduit de la seule présence de ces fichiers.

Les points suivants sont directement visibles dans le code :

1. **SQL non autonome.** Outre les tables manquantes, `event_staff` référence `posts` avant sa création, une politique utilise `get_user_role_in_org` sans définition dans le fichier, et la politique `Ticket access` contient des fragments SQL incompatibles. Le script ne peut pas être considéré comme une installation reproductible fiable en l'état.
2. **Nom de variable privilégiée à corriger.** La clé de service utilise le préfixe `VITE_` dans un dossier d'environnement partagé avec le frontend. Cette convention est inadaptée pour un secret serveur. Cela ne démontre pas que la clé est effectivement présente dans un bundle : aucun bundle n'a été audité.
3. **Autorisations à examiner globalement.** Des contrôles de rôle, d'organisation et des politiques RLS existent. Plusieurs politiques SQL accordent néanmoins des opérations à tout membre validé, alors que l'interface distingue administrateur et staff. Une vérification par opération est nécessaire pour établir les permissions réelles.
4. **Concurrence du scan.** Le code lit le statut puis met à jour le billet par identifiant, sans condition atomique sur l'ancien statut dans l'update observé. Deux scans simultanés demandent donc une validation spécifique ; le refus d'un billet déjà consommé ne prouve pas la résistance à cette course.
5. **Écritures de commande successives.** L'achat crée billets, commande et lignes en plusieurs requêtes avec suppressions compensatoires en cas d'échec. Ce mécanisme n'est pas une transaction SQL atomique.
6. **Worker à fiabiliser avant multiplication des instances.** La prise d'un travail en attente n'effectue pas de verrouillage atomique visible. Plusieurs workers pourraient sélectionner le même travail.
7. **Tests et documentation incomplets.** Le script de test backend est un placeholder qui échoue volontairement. Aucun ensemble de tests applicatifs n'a été identifié dans l'inventaire examiné. Le README frontend est encore celui du modèle React/Vite.
8. **Maintenance du code.** Le routeur backend très volumineux et les conversions de composants en `any` dans le tableau de bord compliquent le contrôle des interfaces et l'évolution du projet.

Ces observations proviennent d'une lecture statique. Aucun audit de sécurité exhaustif, test de charge, build ou test métier n'a été exécuté pour rédiger cette fiche.

## 18. Exemple de parcours complet

Un organisateur crée son compte, confirme son adresse et complète son profil. Il crée son organisation et attend son activation si nécessaire. Il prépare ensuite un événement avec ses dates, son lieu, ses postes et ses offres de billets.

Il invite son équipe à rejoindre l'organisation, examine les candidatures à l'événement et répartit les tâches dans le planning. Il personnalise la page publique et les billets imprimables, puis publie l'événement.

Un visiteur sélectionne une offre, effectue le paiement Mobile Money et transmet sa référence. L'administrateur vérifie la commande et la valide. Le jour de l'événement, le personnel autorisé contrôle les billets par QR code ; un billet consommé est signalé lors d'un nouveau contrôle. L'organisateur suit parallèlement les recettes et dépenses dans le module financier.

## 19. Présentation réutilisable

**ToliarEvent est une plateforme web de gestion événementielle pensée pour les organisateurs de Toliara. Elle réunit la publication des événements, la gestion des équipes et des tâches, la création de billets QR imprimables, les commandes avec vérification manuelle des paiements Mobile Money et le suivi des recettes et dépenses. Développée avec React, TypeScript, Node.js, Express et Supabase, elle vise à centraliser la préparation d'un événement et ses opérations sur le terrain.**

## 20. Sources locales principales

- `Frontend/src/pages/Home.tsx` : positionnement et accueil.
- `Frontend/src/App.tsx` et `Frontend/src/pages/Dashboard.tsx` : routes et modules effectivement reliés.
- `Frontend/src/components/PrivateRoute.tsx` et `Frontend/src/contexts/AuthContext.tsx` : session et parcours d'accès.
- `Frontend/src/pages/PublicationBuilder.tsx` : personnalisation des pages événement.
- `Frontend/src/pages/PlanningManagement.tsx` et `Frontend/src/pages/FinanceManagement.tsx` : fonctions opérationnelles.
- `Frontend/src/components/TicketPurchaseModal.tsx` : parcours d'achat.
- `Frontend/src/pages/TicketBadgeEditor.tsx` et `Frontend/src/utils/parseTicketScreenshot.ts` : production et récupération des billets.
- `Backend/Routes/auth.js` : règles métier et API.
- `Backend/services/generateTickets.js`, `Backend/services/ticketPdfLayout.js` et `Backend/workers/process_ticket_jobs.js` : génération PDF.
- `Backend/utils/organizationAccess.js` et `Backend/utils/supabase.js` : accès et configuration.
- `db.sql` : schéma fourni et politiques de données.
- Les fichiers `package.json`, exemples d'environnement, configuration Vite et script de sitemap : outillage et déploiement prévu.
