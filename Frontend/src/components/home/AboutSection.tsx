import RevealOnScroll from './RevealOnScroll';

type Feature = {
  phase: string;
  phaseColor: string;
  icon: string;
  iconBg: string;
  title: string;
  description: string;
  bullets: { icon: string; text: string }[];
  span?: string;
  delay?: number;
};

const FEATURES: Feature[] = [
  {
    phase: 'Avant l\'événement',
    phaseColor: 'text-blue-500 dark:text-blue-400',
    icon: 'group',
    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    title: 'Staff et rôles centralisés',
    description:
      'Profils, compétences et rôles assignés — vendeur, scanneur, technique — dans un seul registre.',
    bullets: [
      { icon: 'check_circle', text: 'Listing bénévoles, prestataires et staff' },
      { icon: 'badge', text: 'Attribution de rôles par événement' },
    ],
    span: 'lg:col-span-2',
    delay: 0,
  },
  {
    phase: 'Avant l\'événement',
    phaseColor: 'text-violet-500 dark:text-violet-400',
    icon: 'event_upcoming',
    iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    title: 'Jalons et préparation',
    description:
      'Suivez l\'avancement par pôles logistiques avec des barres de progression en temps réel.',
    bullets: [
      { icon: 'trending_up', text: 'Suivi des préparatifs (son, scène, accès)' },
      { icon: 'timeline', text: 'Phases Avant · Jour J · Après' },
    ],
    delay: 80,
  },
  {
    phase: 'Jour J',
    phaseColor: 'text-cyan-600 dark:text-cyan-400',
    icon: 'confirmation_number',
    iconBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    title: 'Billetterie bulk sécurisée',
    description:
      'Générez des milliers de tickets QR uniques, prêts pour l\'impression ou la vente numérique.',
    bullets: [
      { icon: 'qr_code_2', text: 'UUID/QR unique par billet (Standard, VIP, Invité)' },
      { icon: 'print', text: 'Export optimisé pour impression' },
    ],
    span: 'lg:col-span-2',
    delay: 160,
  },
  {
    phase: 'Jour J',
    phaseColor: 'text-rose-500 dark:text-rose-400',
    icon: 'verified_user',
    iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    title: 'Anti-fraude à l\'entrée',
    description:
      'Chaque scan verrouille le billet. Les doublons sont bloqués immédiatement à la porte.',
    bullets: [
      { icon: 'lock', text: 'Cycle Validé → Payé → Utilisé' },
      { icon: 'security', text: 'Blocage instantané des entrées frauduleuses' },
    ],
    delay: 240,
  },
  {
    phase: 'Après l\'événement',
    phaseColor: 'text-amber-600 dark:text-landing-gold',
    icon: 'calculate',
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-landing-gold',
    title: 'Comptabilité en direct',
    description:
      'CA, dépenses, bénéfices et performance par vendeur — sans calculs manuels ni tableurs.',
    bullets: [
      { icon: 'insights', text: 'Tableau de bord financier live' },
      { icon: 'receipt_long', text: 'Frais logistiques avec justificatifs' },
      { icon: 'leaderboard', text: 'Bilan de caisse par vendeur' },
    ],
    span: 'lg:col-span-3',
    delay: 320,
  },
];

export default function AboutSection() {
  return (
    <section
      id="a-propos"
      className="landing-section landing-section-surface scroll-mt-28 relative"
      aria-labelledby="about-heading"
    >
      <div
        className="absolute inset-0 opacity-40 dark:opacity-30 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 60%)',
        }}
      />

      <div className="landing-container relative">
        <RevealOnScroll className="max-w-2xl mb-16 md:mb-24">
          <p className="landing-eyebrow mb-5">Fonctionnalités</p>
          <h2
            id="about-heading"
            className="font-landing-display text-3xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight mb-6 landing-heading"
          >
            Tout le cycle événementiel,
            <br />
            <span className="landing-gradient-text">d&apos;un seul endroit</span>
          </h2>
          <p className="landing-text-muted text-lg leading-relaxed">
            Organisé par phase réelle — avant, pendant et après — parce que vos besoins
            changent à chaque étape.
          </p>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {FEATURES.map((feature) => (
            <RevealOnScroll
              key={feature.title}
              delay={feature.delay}
              direction="scale"
              className={feature.span ?? ''}
            >
              <article className="landing-bento-card h-full group">
                <p className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-5 ${feature.phaseColor}`}>
                  {feature.phase}
                </p>
                <div
                  className={`w-11 h-11 ${feature.iconBg} rounded-xl flex items-center justify-center mb-5
                    group-hover:scale-110 transition-transform duration-300`}
                >
                  <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                    {feature.icon}
                  </span>
                </div>
                <h3 className="font-landing-display text-xl md:text-2xl landing-heading mb-3 leading-snug">
                  {feature.title}
                </h3>
                <p className="landing-text-muted text-sm leading-relaxed mb-5 flex-grow">
                  {feature.description}
                </p>
                <ul className="space-y-2.5 pt-4 border-t border-[var(--landing-border)]">
                  {feature.bullets.map((bullet) => (
                    <li
                      key={bullet.text}
                      className="flex items-start gap-2.5 text-sm landing-text-muted"
                    >
                      <span
                        className="material-symbols-outlined text-primary text-[15px] mt-0.5 shrink-0"
                        aria-hidden="true"
                      >
                        {bullet.icon}
                      </span>
                      {bullet.text}
                    </li>
                  ))}
                </ul>
              </article>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
