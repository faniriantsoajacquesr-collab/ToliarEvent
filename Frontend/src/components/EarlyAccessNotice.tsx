const contacts = [
  { label: 'E-mail', value: 'faniriantsoajacquesr@gmail.com', href: 'mailto:faniriantsoajacquesr@gmail.com', icon: 'mail' },
  { label: 'Facebook', value: 'ToliarEvent', href: 'https://www.facebook.com/search/top?q=ToliarEvent', icon: 'public' },
  { label: 'Téléphone', value: '+261 32 89 800 72', href: 'tel:+261328980072', icon: 'call' },
  { label: 'WhatsApp', value: '+261 32 89 800 72', href: 'https://wa.me/261328980072', icon: 'chat' },
];

export default function EarlyAccessNotice() {
  return (
    <div className="space-y-5 text-on-surface">
      <p className="text-sm leading-relaxed">Pendant la phase d’accès anticipé, ToliarEvent Pro est gratuit pour les étudiants et jeunes organisateurs sélectionnés. L’accès se fait sur invitation pour accompagner les premiers utilisateurs et améliorer la plateforme avec leurs retours.</p>
      <p className="text-sm leading-relaxed font-medium">Contactez-nous directement pour discuter de votre projet et recevoir vos identifiants.</p>
      <div className="grid gap-3">
        {contacts.map((contact) => (
          <a key={contact.label} href={contact.href} target={contact.href.startsWith('https:') ? '_blank' : undefined} rel={contact.href.startsWith('https:') ? 'noopener noreferrer' : undefined} className="flex min-h-14 items-center gap-3 rounded-xl border border-outline-variant p-4 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <span className="material-symbols-outlined shrink-0 text-primary" aria-hidden="true">{contact.icon}</span>
            <span className="min-w-0"><span className="block text-xs text-on-surface-variant">{contact.label}</span><span className="block break-words text-sm font-semibold text-primary">{contact.value}</span></span>
          </a>
        ))}
      </div>
    </div>
  );
}
