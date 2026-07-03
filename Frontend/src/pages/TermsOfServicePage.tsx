export default function TermsOfServicePage() {
  return (
    <article className="px-gutter py-xl max-w-3xl mx-auto text-on-background">
      <header className="mb-xl">
        <p className="text-sm text-on-surface-variant mb-sm">Légal</p>
        <h1 className="font-display-lg text-display-lg text-on-background mb-sm">
          Conditions Générales d&apos;Utilisation
        </h1>
        <p className="text-on-surface-variant">Dernière mise à jour : 03 juillet 2026</p>
      </header>

      <div className="space-y-lg font-body-md text-on-surface-variant leading-relaxed">
        <p>
          L&apos;accès et l&apos;utilisation de l&apos;application ToliarEvent sont soumis à
          l&apos;acceptation sans réserve des présentes Conditions Générales d&apos;Utilisation
          (CGU).
        </p>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-background mb-md">
            1. Inscription et sécurité du compte
          </h2>
          <ul className="list-disc pl-md space-y-xs">
            <li>
              L&apos;accès aux fonctionnalités de gestion nécessite la création d&apos;un compte
              authentifié (e-mail et mot de passe).
            </li>
            <li>
              Vous êtes responsable du maintien de la confidentialité de vos identifiants de
              connexion.
            </li>
            <li>
              Toute activité entreprise sous votre compte relève de votre entière responsabilité.
            </li>
            <li>
              La confirmation de votre adresse e-mail peut être requise lors de l&apos;inscription.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-background mb-md">
            2. Règles de conduite
          </h2>
          <p className="mb-md">En utilisant l&apos;application, vous vous engagez à :</p>
          <ul className="list-disc pl-md space-y-xs">
            <li>
              Fournir des informations exactes lors de votre inscription, de vos candidatures staff
              et de vos achats de billets.
            </li>
            <li>
              Ne pas tenter de contourner les systèmes de sécurité, de falsifier des identifiants
              ou de modifier des données (tâches, plannings, billets, statuts) pour lesquelles vous
              ne possédez pas les droits requis.
            </li>
            <li>
              Ne pas usurper l&apos;identité d&apos;un autre utilisateur ou d&apos;une organisation.
            </li>
            <li>
              Ne pas soumettre de fausses références de paiement Mobile Money ou tenter de
              frauder la billetterie.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-background mb-md">
            3. Rôles et responsabilités
          </h2>

          <h3 className="font-bold text-on-background mb-sm">Administrateurs d&apos;organisation</h3>
          <p className="mb-md">
            Les administrateurs disposent du contrôle sur la création d&apos;événements,
            l&apos;assignation des tâches, la validation des membres staff, la billetterie, les
            finances et les pages de publication. Ils sont responsables du contenu publié, des prix
            des billets et de la vérification des paiements reçus.
          </p>

          <h3 className="font-bold text-on-background mb-sm">Membres staff</h3>
          <p className="mb-md">
            Le staff peut postuler aux événements, mettre à jour l&apos;avancement des tâches qui
            lui sont confiées, vendre ou scanner des billets selon les droits accordés. Postuler à
            un événement implique l&apos;examen de votre profil par l&apos;organisation concernée.
          </p>

          <h3 className="font-bold text-on-background mb-sm">Création d&apos;organisations</h3>
          <p>
            Toute nouvelle organisation est soumise à un processus d&apos;approbation par
            l&apos;équipe ToliarEvent avant activation. L&apos;accès aux fonctionnalités de gestion
            est limité tant que l&apos;organisation n&apos;est pas validée.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-background mb-md">
            4. Billetterie et achats publics
          </h2>
          <ul className="list-disc pl-md space-y-xs">
            <li>
              L&apos;achat de billets via les pages publiques ne nécessite pas de compte utilisateur.
            </li>
            <li>
              Le paiement s&apos;effectue via Mobile Money auprès de l&apos;opérateur indiqué ;
              la validation du billet dépend de la vérification manuelle de la transaction par
              l&apos;organisateur.
            </li>
            <li>
              Les litiges relatifs aux remboursements, annulations ou erreurs de paiement relèvent
              de la relation entre l&apos;acheteur et l&apos;organisation organisatrice.
            </li>
            <li>
              Le scan de codes QR à l&apos;entrée d&apos;un événement requiert l&apos;accès à la
              caméra de l&apos;appareil utilisé par le staff autorisé.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-background mb-md">
            5. Limitation de responsabilité
          </h2>
          <p className="mb-md">
            L&apos;application fournit des outils de gestion logistique, de billetterie et de
            planification. Nous ne saurions être tenus responsables en cas de litige entre une
            organisation et ses membres staff, d&apos;annulation d&apos;un événement, de
            mauvaise exécution des tâches convenues ou de différend lié à un achat de billet.
          </p>
          <p>
            Nous faisons de notre mieux pour assurer une disponibilité continue du service, mais
            nous ne garantissons pas qu&apos;il soit totalement exempt d&apos;interruptions, de
            latences ou d&apos;erreurs techniques. L&apos;application nécessite une connexion
            Internet pour fonctionner.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-background mb-md">
            6. Modification des conditions
          </h2>
          <p>
            Nous nous réservons le droit de modifier ces conditions à tout moment. La continuation
            de l&apos;utilisation de l&apos;application après publication des modifications
            constitue votre acceptation des nouvelles CGU.
          </p>
        </section>

        <section>
          <h2 className="font-headline-md text-headline-md text-on-background mb-md">
            7. Contact
          </h2>
          <p>
            Pour toute question relative à ces conditions ou à vos données personnelles, vous pouvez
            nous écrire à{' '}
            <a
              href="mailto:faniriantsoajacquesr@gmail.com"
              className="text-primary underline hover:text-primary/80"
            >
              faniriantsoajacquesr@gmail.com
            </a>
            . Consultez également notre{' '}
            <a
              href="/confidentialite"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              Politique de Confidentialité
            </a>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
