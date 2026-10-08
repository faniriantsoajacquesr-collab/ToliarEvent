# Intégration Papi — parcours 1

## Étapes appliquées au code

1. **Commande avant paiement** : formulaire sans compte (catégorie, quantité, nom, téléphone, email facultatif). Le serveur lit le prix du catalogue ; aucun montant fourni par le navigateur ne fait foi. Une commande en préparation est conservée dans `papi_checkouts`, sans billet utilisable.
2. **Page de suivi** : URL personnelle `/paiement/:id#token=…`, conservée avant la redirection. Le jeton aléatoire de 256 bits reste dans le fragment d’URL ; seul son SHA-256 est stocké en base. Les appels utilisent `X-Checkout-Token`. Le site propose un raccourci vers la dernière commande sur le même appareil.
3. **Redirection Papi** : création serveur d’un lien valable une heure, sans opérateur imposé, puis ouverture dans le même onglet. MVola, Airtel Money, Orange Money et carte sont proposés selon la configuration Papi. La référence est `PAPI-<uuid commande>`.
4. **Confirmation serveur** : réception du corps brut, vérification HMAC SHA-256 et tolérance temporelle de cinq minutes, puis comparaison de la référence, du jeton de notification et du montant. Le retour du navigateur ne valide jamais une commande.
5. **Émission atomique** : une fonction SQL verrouille la commande, crée `orders`, `tickets` et `order_items`, puis marque la commande payée. Les billets sont `vendu`. Une notification répétée ne crée aucun doublon. En cas d’erreur, toute la transaction est annulée et la confirmation peut être rejouée.
6. **Reprise** : lecture serveur du statut Papi, tentative échouée reprise sur le même lien actif, nouveau lien après expiration uniquement si aucun paiement n’est en cours. Un paiement confirmé n’est jamais réémis. Une confirmation tardive peut finaliser une commande expirée.
7. **Téléchargement et administration** : téléchargement PNG des QR codes après confirmation ; les commandes payées apparaissent dans la gestion existante, avec indication Papi. Dévalidation et suppression manuelles sont bloquées. Les anciennes commandes manuelles restent consultables. L’ancienne route publique d’achat répond `410` et la route de test publique `/test-papi` est retirée.

## Activation sur l’environnement cible

Le code est intégré ; la migration distante et les paramètres ci-dessous restent à appliquer avant ouverture des ventes.

1. Dans le SQL Editor du projet Supabase utilisé par le backend, exécuter **`migrations/20261006_papi_checkout.sql`** avec le rôle propriétaire. La migration est transactionnelle et réexécutable. Elle doit suivre le schéma existant `db.sql`, pas le remplacer. Elle ajoute les fonctions, les protections d’accès et passe les numéros de billets en `integer`.
2. Dans **`Backend/.env`**, compléter :

   ```dotenv
   PAPI_BASE_URL=https://app.papi.mg/engine/api
   PAPI_API_KEY=<clé de la boutique Papi>
   PAPI_WEBHOOK_SECRET=<secret complet pwhsec_... de la même boutique>
   FRONTEND_URL=https://votre-site.example
   BACKEND_PUBLIC_URL=https://votre-api.example
   PAPI_RECONCILE_ENABLED=true
   ```

   Le projet utilise actuellement un compte marchand Papi commun, déterminé par la clé serveur. Il n’y a pas de répartition automatique vers des comptes organisateurs. Les clés et le secret ne doivent jamais être placés dans le frontend.
3. Le backend doit être joignable à **`POST /api/payments/papi/notification`** en HTTPS. En développement, utiliser un tunnel HTTPS vers le backend ; `localhost` n’est pas joignable par Papi. Les URL de retour sont fournies lors de chaque création de lien.
4. Configurer `VITE_API_URL=https://votre-api.example/api/auth` pour le frontend. L’hébergement doit servir l’application React pour `/paiement/*` et `/evenements/*`.
5. Redémarrer le backend et déployer la nouvelle version du frontend. Avec `PAPI_RECONCILE_ENABLED=true`, le backend reprend les confirmations manquées toutes les minutes (lots de 20, sans chevauchement). Ce traitement nécessite un processus Node durable ; pour un hébergement sans processus permanent, exécuter un worker planifié équivalent.
6. Effectuer la recette avec une **boutique sandbox Papi** avant les paiements réels. Ne pas assimiler `isTestMode=true` sur une boutique de production à une simulation : ce drapeau peut déplacer de l’argent réel. Aucun débit réel n’a été effectué lors du développement.

## Recette

### Erreur « Les URL de paiement doivent utiliser HTTPS »

Sur Render, configurer les origines publiques (valeurs actuelles référencées dans le projet) :

```dotenv
FRONTEND_URL=https://toliarevent.vercel.app
BACKEND_PUBLIC_URL=https://toliarevent.onrender.com
PAPI_BASE_URL=https://app.papi.mg/engine/api
```

Puis redéployer le backend. Ne pas copier `FRONTEND_URL=http://localhost:5173` dans l’environnement de production. La validation indique désormais le nom de la variable incorrecte sans afficher de secret.

Pour un backend local, `FRONTEND_URL=http://localhost:5173` est autorisé hors `NODE_ENV=production`. `BACKEND_PUBLIC_URL` doit toujours être une URL HTTPS joignable par Papi : un tunnel vers ce backend local. L’adresse Render reçoit les notifications sur Render, même si le formulaire est ouvert en local.

### Scénarios de validation

- Acheter un puis plusieurs billets : vérifier montant, opérateurs disponibles et retour au suivi.
- Confirmer le paiement : vérifier une commande validée, le bon nombre de billets, leurs QR codes et leur scan par le staff autorisé.
- Refuser/abandonner le paiement, puis réessayer sur le lien actif.
- Fermer l’onglet, revenir via le lien personnel ou le raccourci de dernière commande.
- Rejouer une notification : aucun billet supplémentaire.
- Modifier le montant ou la signature : aucune émission de billet.
- Couper temporairement les notifications : la lecture de statut ou le worker doit retrouver le paiement.
- Simuler une réponse réseau perdue à la création du lien : retrouver le lien existant.
- Vérifier qu’un paiement en attente reste en attente, même si son lien expire.
- Vérifier qu’un lien de suivi sans jeton ou avec un jeton différent ne donne accès à aucun billet.

## Vérifications automatisées

```powershell
cd Backend
npm.cmd test
cd ../Frontend
npm.cmd run build
npx.cmd eslint src/components/TicketPurchaseModal.tsx src/components/RecentCheckoutLink.tsx src/pages/PaymentStatusPage.tsx src/services/papiAPI.ts
```

Les tests SQL utilisent PostgreSQL embarqué (PGlite), sans connexion à la base réelle. Ils exécutent la migration et vérifient prix, atomicité, idempotence, reprise après échec et accès interdits. Les tests réseau utilisent des réponses simulées, pas l’API marchande réelle.

Validation locale : suite backend et tests Papi passés, build frontend réussi, lint des nouveaux écrans réussi. La recette visuelle n’a pas pu être exécutée (aucun navigateur disponible dans la session). La recette complète chez Papi reste à effectuer après configuration d’une boutique sandbox et application de la migration distante.

## Limites de cette version

- Aucun quota de places n’existe dans le schéma actuel : pas de réservation de stock ni de compteur de places restantes.
- Les sessions non payées restent dans `papi_checkouts` ; seules les commandes payées entrent dans le tableau de commandes existant.
- Le lien personnel et le téléchargement sont disponibles ; aucun envoi automatique d’email/SMS n’est ajouté.
- Les billets gratuits et totaux inférieurs à 300 Ar nécessitent un parcours distinct.
- Les remboursements et reversements aux organisateurs ne sont pas automatisés.
- Un lien personnel donne accès aux billets : le conserver privé. Le raccourci local pointe uniquement vers la dernière commande de cet appareil.

## Documentation de référence

- [Création du lien](https://docs.papi.mg/docs/api/payment-link/create-payment-link/)
- [Lecture du statut](https://docs.papi.mg/fr/docs/api/get-payment-link-status/)
- [Vérification des notifications](https://docs.papi.mg/docs/developper-guide/securing-notifications/)
- [Guide d’intégration](https://docs.papi.mg/docs/developper-guide/integration-guide/)
