import RevealOnScroll from './RevealOnScroll';

const STEPS = [
  {
    phase: 'Créer',
    title: 'Publiez votre événement',
    description:
      'Renseignez les infos, configurez vos tarifs et assignez votre équipe — vendeurs, scanneurs, technique.',
    icon: 'event',
  },
  {
    phase: 'Vendre',
    title: 'Générez et distribuez les billets',
    description:
      'Tickets QR uniques en masse, vente en ligne ou sur place. Chaque billet est tracé dès sa création.',
    icon: 'confirmation_number',
  },
  {
    phase: 'Contrôler',
    title: 'Scannez et suivez en direct',
    description:
      'Le jour J, validez les entrées au scan. Tableau de bord financier et bilan de caisse en temps réel.',
    icon: 'qr_code_scanner',
  },
];

export default function HowItWorksSection() {
  return (
    <section
      id="comment-ca-marche"
      className="landing-section landing-section-alt scroll-mt-28 relative overflow-hidden"
      aria-labelledby="how-it-works-heading"
    >
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-30 dark:opacity-20 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse, rgba(37,99,235,0.2) 0%, transparent 70%)',
        }}
      />

      <div className="landing-container relative">
        <RevealOnScroll className="max-w-2xl mb-20 md:mb-28 text-center mx-auto">
          <p className="landing-eyebrow mb-5 justify-center">Comment ça marche</p>
          <h2
            id="how-it-works-heading"
            className="font-landing-display text-3xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight landing-heading"
          >
            De l&apos;annonce à la caisse clôturée,
            <br />
            <span className="landing-text-subtle">en trois étapes</span>
          </h2>
        </RevealOnScroll>

        <ol className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 relative">
          <div
            className="hidden md:block absolute top-[2.5rem] left-[20%] right-[20%] h-px bg-[var(--landing-border-strong)]"
            aria-hidden="true"
          />
          {STEPS.map((step, index) => (
            <RevealOnScroll
              key={step.phase}
              as="li"
              delay={index * 120}
              direction="up"
              className="relative flex flex-col items-center text-center px-4"
            >
              <div className="relative mb-7">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/25 landing-step-ring">
                  <span className="material-symbols-outlined text-[28px]" aria-hidden="true">
                    {step.icon}
                  </span>
                </div>
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-landing-gold text-landing-void text-[10px] font-bold flex items-center justify-center">
                  {index + 1}
                </span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-500 dark:text-blue-400 mb-2">
                {step.phase}
              </p>
              <h3 className="font-landing-display text-xl md:text-2xl landing-heading mb-3">
                {step.title}
              </h3>
              <p className="landing-text-muted text-sm md:text-base leading-relaxed max-w-xs">
                {step.description}
              </p>
            </RevealOnScroll>
          ))}
        </ol>
      </div>
    </section>
  );
}
