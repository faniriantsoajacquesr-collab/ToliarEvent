export default function PrivacyPolicyPage() {
  return (
    <article className="px-gutter py-xl max-w-3xl mx-auto text-on-background">
      <header className="mb-xl">
        <p className="text-sm text-on-surface-variant mb-sm">Légal</p>
        <h1 className="font-display-lg text-display-lg text-on-background mb-sm">
          Politique de confidentialité
        </h1>
        <p className="text-on-surface-variant">Dernière mise à jour : 03 juillet 2026</p>
      </header>

      <div className="space-y-lg font-body-md text-on-surface-variant leading-relaxed">
        <p>
          La présente Politique de Confidentialité décrit la manière dont vos informations sont
          collectées, utilisées, stockées et partagées lorsque vous utilisez l&apos;application
          ToliarEvent (site web et services associés).
        </p>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-background mb-md">
            1. Données collectées
          </h2>
          <p className="mb-md">
            Nous collectons uniquement les informations nécessaires au fonctionnement de la
            plateforme et à la gestion des événements.
          </p>

          <h3 className="font-bold text-on-background mb-sm">Compte et profil utilisateur</h3>
          <ul className="list-disc pl-md space-y-xs mb-md">
            <li>Identifiant unique (UUID), adresse e-mail et mot de passe (gérés par Supabase Auth)</li>
            <li>Prénom, nom et numéro de téléphone (optionnel)</li>
          </ul>

          <h3 className="font-bold text-on-background mb-sm">Organisations et membres</h3>
          <ul className="list-disc pl-md space-y-xs mb-md">
            <li>Nom de l&apos;organisation, code d&apos;invitation et statut (en attente, actif, refusé)</li>
            <li>Rôle au sein de l&apos;organisation : administrateur ou staff</li>
            <li>Statut de validation du membre par l&apos;organisation</li>
          </ul>

          <h3 className="font-bold text-on-background mb-sm">Événements, staff et planification</h3>
          <ul className="list-disc pl-md space-y-xs mb-md">
            <li>Informations sur les événements (titre, lieu, dates, description, catégorie)</li>
            <li>Candidatures au staff, postes visés et statut de validation</li>
            <li>Tâches assignées, statuts d&apos;avancement et compétences associées</li>
            <li>Compétences déclarées sur le profil</li>
          </ul>

          <h3 className="font-bold text-on-background mb-sm">Billetterie et contrôle d&apos;accès</h3>
          <ul className="list-disc pl-md space-y-xs mb-md">
            <li>Types de billets, prix, statut et nom du détenteur</li>
            <li>Historique de vente et de scan des billets (identifiant du staff concerné)</li>
            <li>
              Pour les achats publics sans compte : nom, téléphone, e-mail et adresse
              (facultatifs), référence de transaction Mobile Money, montant et moyen de paiement
              choisi
            </li>
            <li>Contenus de pages de publication (textes, images, contacts, liens sociaux)</li>
          </ul>

          <h3 className="font-bold text-on-background mb-sm">Finances organisationnelles</h3>
          <ul className="list-disc pl-md space-y-xs mb-md">
            <li>Transactions (revenus et dépenses), montants, catégories et auteur de la saisie</li>
          </ul>

          <h3 className="font-bold text-on-background mb-sm">Données techniques</h3>
          <ul className="list-disc pl-md space-y-xs">
            <li>
              Jetons d&apos;authentification (access token et refresh token) émis par Supabase,
              conservés localement dans votre navigateur pour maintenir votre session
            </li>
            <li>
              Brouillons de pages de publication enregistrés temporairement dans le stockage local
              du navigateur
            </li>
            <li>
              Accès à la caméra de votre appareil lors du scan de codes QR (uniquement pour lire
              l&apos;identifiant du billet ; aucune image ou vidéo n&apos;est enregistrée)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-background mb-md">
            2. Utilisation des données
          </h2>
          <p className="mb-md">Vos données sont exploitées uniquement pour :</p>
          <ul className="list-disc pl-md space-y-xs">
            <li>Créer et sécuriser votre compte, gérer la réinitialisation de mot de passe</li>
            <li>Permettre la création, l&apos;approbation et la gestion des organisations</li>
            <li>Planifier les événements, assigner les tâches et gérer les candidatures staff</li>
            <li>Gérer la billetterie, valider les paiements et contrôler l&apos;accès aux événements</li>
            <li>Publier les pages publiques d&apos;événements et afficher les informations associées</li>
            <li>Suivre les finances internes des organisations</li>
          </ul>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-background mb-md">
            3. Hébergement, stockage et sécurité
          </h2>
          <p className="mb-md">
            Vos données sont hébergées via Supabase (authentification, base de données PostgreSQL
            et stockage de fichiers). L&apos;accès aux données est encadré par des politiques de
            sécurité au niveau des lignes (RLS), garantissant que seuls les utilisateurs et
            administrateurs autorisés peuvent lire ou modifier les informations auxquelles ils ont
            droit.
          </p>
          <p>
            Les jetons de session sont stockés dans le stockage local de votre navigateur. Nous vous
            recommandons de ne pas partager votre appareil connecté et de vous déconnecter sur les
            postes partagés.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-background mb-md">
            4. Services tiers
          </h2>
          <p className="mb-md">
            Pour fournir le service, nous nous appuyons sur des prestataires techniques, notamment :
          </p>
          <ul className="list-disc pl-md space-y-xs">
            <li>
              <strong className="text-on-background">Supabase</strong> — authentification, base de
              données et hébergement de fichiers
            </li>
            <li>
              <strong className="text-on-background">Google Fonts</strong> — affichage des
              typographies
            </li>
            <li>
              Services d&apos;images externes utilisés comme ressources par défaut sur certaines pages
              (par exemple Unsplash)
            </li>
          </ul>
          <p className="mt-md">
            Les paiements Mobile Money sont initiés par vous auprès de votre opérateur ; nous
            recevons uniquement la référence de transaction que vous communiquez pour vérification
            manuelle par l&apos;organisateur.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-background mb-md">
            5. Vos droits
          </h2>
          <p>
            Conformément aux réglementations applicables en matière de protection des données, vous
            disposez d&apos;un droit d&apos;accès, de rectification et de suppression de vos données
            personnelles. Vous pouvez quitter une organisation ou demander la suppression de votre
            profil depuis l&apos;application ou en nous contactant à{' '}
            <a
              href="mailto:faniriantsoajacquesr@gmail.com"
              className="text-primary underline hover:text-primary/80"
            >
              faniriantsoajacquesr@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-background mb-md">
            6. Modifications
          </h2>
          <p>
            Nous pouvons mettre à jour cette politique. La date de dernière mise à jour sera
            modifiée en conséquence.             Consultez également nos{' '}
            <a
              href="/cgu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              Conditions Générales d&apos;Utilisation
            </a>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
