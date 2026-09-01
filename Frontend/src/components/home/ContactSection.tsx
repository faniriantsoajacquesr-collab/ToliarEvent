import RevealOnScroll from './RevealOnScroll';

const PHONE = '+261328980072';
const PHONE_DISPLAY = '+261 32 89 800 72';
const EMAIL = 'faniriantsoajacquesr@gmail.com';

const CONTACTS = [
  {
    label: 'WhatsApp',
    value: PHONE_DISPLAY,
    href: `https://wa.me/${PHONE.replace('+', '')}`,
    icon: 'chat',
    description: 'Réponse rapide, idéal pour une démo',
  },
  {
    label: 'Téléphone',
    value: PHONE_DISPLAY,
    href: `tel:${PHONE}`,
    icon: 'call',
    description: 'Appelez-nous directement',
  },
  {
    label: 'Email',
    value: EMAIL,
    href: `mailto:${EMAIL}`,
    icon: 'mail',
    description: 'Pour les demandes détaillées',
  },
];

export default function ContactSection() {
  return (
    <section
      id="contact"
      className="landing-section landing-section-surface scroll-mt-28 relative"
      aria-labelledby="contact-heading"
    >
      <div className="landing-container">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20 items-start">
          <RevealOnScroll direction="left">
            <p className="landing-eyebrow mb-5">Contact</p>
            <h2
              id="contact-heading"
              className="font-landing-display text-3xl md:text-5xl leading-[1.08] tracking-tight mb-6 landing-heading"
            >
              Une question sur votre
              <br />
              <span className="landing-gradient-text">prochain événement ?</span>
            </h2>
            <p className="landing-text-muted text-lg leading-relaxed max-w-md">
              L&apos;équipe ToliarEvent est basée à Toliara. Contactez-nous pour une démo,
              un accompagnement ou toute question sur la plateforme.
            </p>
          </RevealOnScroll>

          <div className="space-y-3">
            {CONTACTS.map((contact, i) => (
              <RevealOnScroll key={contact.label} delay={i * 100} direction="right">
                <a
                  href={contact.href}
                  target={contact.label === 'WhatsApp' ? '_blank' : undefined}
                  rel={contact.label === 'WhatsApp' ? 'noopener noreferrer' : undefined}
                  className="landing-glass-card flex items-center gap-5 p-5 rounded-2xl group cursor-pointer"
                >
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                    <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                      {contact.icon}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] landing-text-subtle mb-0.5">
                      {contact.label}
                    </p>
                    <p className="font-semibold landing-heading group-hover:text-primary transition-colors truncate">
                      {contact.value}
                    </p>
                    <p className="text-sm landing-text-subtle mt-0.5">{contact.description}</p>
                  </div>
                  <span
                    className="material-symbols-outlined landing-text-subtle group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0"
                    aria-hidden="true"
                  >
                    arrow_forward
                  </span>
                </a>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
