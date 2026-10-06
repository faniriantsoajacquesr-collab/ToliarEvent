# Backend ToliarEvent

## Paiement Papi

Le parcours d’achat public utilise le paiement hébergé Papi. Les étapes d’intégration, la migration SQL, la configuration et la recette sont décrites dans [le guide d’intégration](../docs/INTEGRATION_PAPI.md).

## Organisation

`index.js` configure Express et monte `Routes/index.js` sous `/api/auth`.
Ce préfixe historique reste identique pour conserver la compatibilité avec le frontend.

- `Routes/` : déclaration des méthodes HTTP et des chemins, puis délégation aux contrôleurs.
- `Controllers/` : handlers HTTP par domaine, validation des entrées, autorisations et réponses.
- `services/` : génération des billets et fonctions métier réutilisables, dont `ticketHelpers.js` et `orderHelpers.js`.
- `utils/` : client Supabase, contrôle d'accès des organisations, helpers et blocage de l'inscription publique.

Chaque fichier de routes possède son contrôleur correspondant :

| Module | Responsabilité |
| --- | --- |
| `auth` | Connexion, session, récupération de mot de passe, utilisateur |
| `profiles` | Profils et compétences des profils |
| `skills` | Catalogue des compétences |
| `organizations` | Création, adhésion et organisation courante |
| `organizationMembers` | Membres, rôles et actions groupées |
| `events` | Événements et catégories |
| `publications` | Pages publiques, publication et images |
| `eventStaff` | Équipes événementielles et candidatures |
| `tickets` | Génération, registre, scan et actions groupées |
| `ticketTypes` | Types de billets et activation |
| `finances` | Transactions et catégories financières |
| `tasks` | Planning et tâches |
| `orders` | Achat, moyens de paiement et gestion des commandes |
| `administration` | Validation des organisations par la plateforme |
| `diagnostics` | Routes de diagnostic existantes |

## Ajouter une route

1. Ajouter et exporter le handler dans le contrôleur du domaine.
2. Déclarer la route dans son fichier `Routes/`, avec le chemin complet **sans** `/api/auth`.
3. Pour un nouveau domaine, monter son routeur dans `Routes/index.js`.
4. Ajouter la route au contrat `tests/fixtures/api-routes.json` et tester son comportement.

Le middleware `organizationAccessMiddleware` s'exécute une seule fois, avant tous les routeurs.
Les modules sont montés sans sous-préfixe pour qu'il continue de recevoir les chemins complets.
Les routes spécifiques de `publications` doivent rester avant `/events/:id` du module `events`.
Dans chaque module, déclarer les chemins statiques avant les paramètres dynamiques susceptibles de les intercepter.

L'inscription publique reste suspendue : `POST /api/auth/signup` utilise `utils/registrationClosed.js`.

## Vérifications

Depuis `Backend/` :

```sh
npm test
```

Les tests utilisent le runner natif de Node et un serveur HTTP local éphémère.
Supabase est remplacé en mémoire : aucune clé, connexion distante ou modification de données réelles n'est nécessaire.
Ils couvrent le contrat des 80 routes, leur dispatch, les contrôles d'accès, la connexion,
le blocage des inscriptions et des régressions ciblées.
