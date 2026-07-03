export default function AboutSection() {
  return (
    <section id="a-propos" className="py-24 px-gutter max-w-container-max mx-auto scroll-mt-28">
      <div className="text-center mb-20">
        <h2 className="font-display-lg text-display-lg text-on-background mb-md">
          La Solution Locale
        </h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
          Une plateforme intégrée pour transformer la complexité logistique
          en excellence opérationnelle.
        </p>
      </div>

      <div className="gap-lg flex flex-wrap justify-center">
        <div className="bg-white rounded-[32px] p-xl border border-outline-variant/50 hover:shadow-xl transition-shadow flex flex-col h-full w-full md:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-lg">
            <span className="material-symbols-outlined text-[32px]">group</span>
          </div>
          <h3 className="font-headline-lg text-headline-lg mb-md text-on-background">
            Gestion Intelligente du Staff (Logistique RH)
          </h3>
          <p className="font-body-md text-on-surface-variant mb-lg flex-grow">
            Centralisez les profils et les compétences pour une organisation sans failles.
            Fini le chaos des groupes WhatsApp, passez à une gestion structurée.
          </p>
          <div className="space-y-sm bg-surface-container-low p-md rounded-xl">
            <div className="flex items-center gap-sm text-sm font-medium text-on-surface">
              <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
              Listing centralisé (Bénévoles, Prestataires, Staff)
            </div>
            <div className="flex items-center gap-sm text-sm font-medium text-on-surface">
              <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
              Attribution de rôles : Vendeur, Scanneur, Technique
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[32px] p-xl border border-outline-variant/50 hover:shadow-xl transition-shadow flex flex-col h-full w-full md:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]">
          <div className="w-14 h-14 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center mb-lg">
            <span className="material-symbols-outlined text-[32px]">event_upcoming</span>
          </div>
          <h3 className="font-headline-lg text-headline-lg mb-md text-on-background">
            Suivi Dynamique par Jalons (Gestion de Projet)
          </h3>
          <p className="font-body-md text-on-surface-variant mb-lg flex-grow">
            Agissez comme un chef d'orchestre avec une visibilité totale sur l'avancement.
            Surveillez les 3 étapes clés : Avant, Jour J, et Après.
          </p>
          <div className="space-y-sm bg-surface-container-low p-md rounded-xl">
            <div className="flex items-center gap-sm text-sm font-medium text-on-surface">
              <span className="material-symbols-outlined text-secondary text-[18px]">trending_up</span>
              Suivi en temps réel des préparatifs (ex: Installation Son)
            </div>
            <div className="flex items-center gap-sm text-sm font-medium text-on-surface">
              <span className="material-symbols-outlined text-secondary text-[18px]">trending_up</span>
              Barres de progression par pôles logistiques
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[32px] p-xl border border-outline-variant/50 hover:shadow-xl transition-shadow flex flex-col h-full w-full md:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]">
          <div className="w-14 h-14 bg-tertiary/10 text-tertiary rounded-2xl flex items-center justify-center mb-lg">
            <span className="material-symbols-outlined text-[32px]">confirmation_number</span>
          </div>
          <h3 className="font-headline-lg text-headline-lg mb-md text-on-background">
            Billetterie Physique Sécurisée (Génération Bulk)
          </h3>
          <p className="font-body-md text-on-surface-variant mb-lg flex-grow">
            Réinventez le ticket papier avec une sécurité numérique de pointe.
            Générez massivement des milliers de tickets uniques prêts à l'impression.
          </p>
          <div className="space-y-sm bg-surface-container-low p-md rounded-xl">
            <div className="flex items-center gap-sm text-sm font-medium text-on-surface">
              <span className="material-symbols-outlined text-tertiary text-[18px]">qr_code_2</span>
              Génération UUID/QR Code unique (Standard, VIP, Invit)
            </div>
            <div className="flex items-center gap-sm text-sm font-medium text-on-surface">
              <span className="material-symbols-outlined text-tertiary text-[18px]">print</span>
              Export optimisé pour impression haute sécurité
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[32px] p-xl border border-outline-variant/50 hover:shadow-xl transition-shadow flex flex-col h-full w-full md:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]">
          <div className="w-14 h-14 bg-error-container/20 text-error rounded-2xl flex items-center justify-center mb-lg">
            <span className="material-symbols-outlined text-[32px]">verified_user</span>
          </div>
          <h3 className="font-headline-lg text-headline-lg mb-md text-on-background">
            Traçabilité et Cycle de Vie (Sécurité Anti-Fraude)
          </h3>
          <p className="font-body-md text-on-surface-variant mb-lg flex-grow">
            Sécurisez vos revenus financiers et verrouillez les accès.
            Suivez l'état exact de chaque billet pour empêcher le vol et la fraude.
          </p>
          <div className="space-y-sm bg-surface-container-low p-md rounded-xl">
            <div className="flex items-center gap-sm text-sm font-medium text-on-surface">
              <span className="material-symbols-outlined text-error text-[18px]">lock</span>
              Cycle de vie : Validé → Payé (Vente) → Utilisé (Porte)
            </div>
            <div className="flex items-center gap-sm text-sm font-medium text-on-surface">
              <span className="material-symbols-outlined text-error text-[18px]">security</span>
              Blocage immédiat des entrées en cas de doublon
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[32px] p-xl border border-outline-variant/50 hover:shadow-xl transition-shadow flex flex-col h-full w-full md:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]">
          <div className="w-14 h-14 bg-surface-container-highest/20 text-on-surface-variant rounded-2xl flex items-center justify-center mb-lg">
            <span className="material-symbols-outlined text-[32px]">calculate</span>
          </div>
          <h3 className="font-headline-lg text-headline-lg mb-md text-on-background">
            Comptabilité Automatisée & Chiffres Clés
          </h3>
          <p className="font-body-md text-on-surface-variant mb-lg flex-grow">
            Fini le stress des calculs manuels. L'application centralise les flux financiers
            en temps réel pour une gestion sereine.
          </p>
          <div className="space-y-sm bg-surface-container-low p-md rounded-xl">
            <div className="flex items-center gap-sm text-sm font-medium text-on-surface">
              <span className="material-symbols-outlined text-primary text-[18px]">insights</span>
              Tableau de bord financier en direct (CA, Bénéfices, Dépenses)
            </div>
            <div className="flex items-center gap-sm text-sm font-medium text-on-surface">
              <span className="material-symbols-outlined text-primary text-[18px]">receipt_long</span>
              Enregistrement des frais logistiques avec justificatifs
            </div>
            <div className="flex items-center gap-sm text-sm font-medium text-on-surface">
              <span className="material-symbols-outlined text-primary text-[18px]">leaderboard</span>
              Classement de performance et bilan de caisse par vendeur
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
