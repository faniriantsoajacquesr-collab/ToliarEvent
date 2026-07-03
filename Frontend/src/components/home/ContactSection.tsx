const PHONE = '+261328980072';
const PHONE_DISPLAY = '+261 32 89 800 72';
const EMAIL = 'faniriantsoajacquesr@gmail.com';

const CONTACTS = [
  {
    label: 'WhatsApp',
    value: PHONE_DISPLAY,
    href: `https://wa.me/${PHONE.replace('+', '')}`,
    icon: 'chat',
  },
  {
    label: 'Numéro téléphone',
    value: PHONE_DISPLAY,
    href: `tel:${PHONE}`,
    icon: 'call',
  },
  {
    label: 'Mail',
    value: EMAIL,
    href: `mailto:${EMAIL}`,
    icon: 'mail',
  },
];

export default function ContactSection() {
  return (
    <section id="contact" className="bg-surface py-24 px-gutter scroll-mt-28">
      <div className="max-w-[720px] mx-auto text-center">
        <h2 className="font-display-lg text-display-lg text-on-background mb-md">Contact</h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant mb-xl">
          Une question ? Contactez-nous directement.
        </p>

        <div className="glass-card rounded-[32px] p-xl shadow-2xl space-y-lg text-left">
          {CONTACTS.map((contact) => (
            <a
              key={contact.label}
              href={contact.href}
              target={contact.label === 'WhatsApp' ? '_blank' : undefined}
              rel={contact.label === 'WhatsApp' ? 'noopener noreferrer' : undefined}
              className="flex items-center gap-lg p-lg rounded-2xl bg-surface-container-low hover:bg-surface-container transition-colors group"
            >
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                <span className="material-symbols-outlined text-[28px]">{contact.icon}</span>
              </div>
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant mb-xs">
                  {contact.label}
                </p>
                <p className="font-headline-sm text-headline-sm font-bold text-on-background group-hover:text-primary transition-colors">
                  {contact.value}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
