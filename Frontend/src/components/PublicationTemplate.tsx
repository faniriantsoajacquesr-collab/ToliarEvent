import SocialPlatformIcon from './SocialPlatformIcon';

export interface TicketCard {
  id?: string | number;
  badge: string;
  title: string;
  price: string;
  currency: string;
  bulletPoints: string[];
  featured?: boolean;
  badgeColor?: string;
  numericPrice?: number;
}

export interface SocialLinkItem {
  platform: 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'youtube' | 'twitter' | 'website';
  url: string;
}

export interface PublicationTemplateProps {
  title: string;
  heroTitle: string;
  heroSubtitle: string;
  customButtonText: string;
  dateText: string;
  publicDescription: string;
  heroImage: string;
  aboutTitle: string;
  aboutParagraphs: string[];
  aboutImage: string;
  location: string;
  tickets: TicketCard[];
  contactEmail: string;
  contactPhone: string;
  socialLinks: SocialLinkItem[];
  templateStyle: 'default' | 'compact' | 'split';
  themePreset: 'indigo' | 'cyberpunk' | 'forest' | 'crimson' | 'amber';
  hideAboutSection?: boolean;
  mode?: 'desktop' | 'mobile';
  onBuyTicket?: (ticket: TicketCard) => void;
}

export default function PublicationTemplate({
  title,
  heroTitle,
  heroSubtitle,
  customButtonText,
  dateText,
  publicDescription,
  heroImage,
  aboutTitle,
  aboutParagraphs = [], // Fallback de sécurité
  aboutImage,
  location = '',
  tickets = [],
  contactEmail,
  contactPhone,
  socialLinks = [],
  templateStyle,
  themePreset,
  hideAboutSection = false,
  mode = 'desktop',
  onBuyTicket,
}: PublicationTemplateProps) {
  const isMobileMode = mode === 'mobile';
  
  // Amélioration des classes pour impacter tout le template
  const themeClasses = {
    indigo: { accent: 'text-indigo-600', text: 'text-indigo-600', button: 'bg-indigo-600 text-white', bg: 'from-indigo-50 to-white', border: 'border-indigo-600', bgFixed: 'bg-indigo-100', iconBg: 'bg-indigo-600', iconFg: 'text-white' },
    cyberpunk: { accent: 'text-fuchsia-500', text: 'text-fuchsia-500', button: 'bg-fuchsia-500 text-white', bg: 'from-fuchsia-50 to-white', border: 'border-fuchsia-500', bgFixed: 'bg-fuchsia-100', iconBg: 'bg-fuchsia-500', iconFg: 'text-white' },
    forest: { accent: 'text-emerald-600', text: 'text-emerald-600', button: 'bg-emerald-600 text-white', bg: 'from-emerald-50 to-white', border: 'border-emerald-600', bgFixed: 'bg-emerald-100', iconBg: 'bg-emerald-600', iconFg: 'text-white' },
    crimson: { accent: 'text-rose-600', text: 'text-rose-600', button: 'bg-rose-600 text-white', bg: 'from-rose-50 to-white', border: 'border-rose-600', bgFixed: 'bg-rose-100', iconBg: 'bg-rose-600', iconFg: 'text-white' },
    amber: { accent: 'text-amber-600', text: 'text-amber-600', button: 'bg-amber-500 text-white', bg: 'from-amber-50 to-white', border: 'border-amber-500', bgFixed: 'bg-amber-100', iconBg: 'bg-amber-500', iconFg: 'text-white' },
  } as const;
  
  const accent = themeClasses[themePreset] || themeClasses.indigo;
  
  const containerClass = isMobileMode
    ? 'w-full max-w-full rounded-[2.5rem] bg-background overflow-hidden'
    : 'w-full rounded-[2.5rem] bg-background shadow-xl overflow-hidden';
    
  const isSplitDesktop = templateStyle === 'split' && !isMobileMode;
  const heroGridClass = isSplitDesktop ? 'grid-cols-1 md:grid-cols-2 items-center' : 'grid-cols-1';
  const heroSpacing = templateStyle === 'compact' ? 'py-6 md:py-12' : 'py-10 md:py-20';

  return (
    <div className={containerClass}>
      <div className="relative overflow-hidden bg-background w-full">

        <main className="relative min-h-[800px] w-full" id="main-content">
          
          {/* Section Hero */}
          <section className="relative w-full overflow-hidden" id="hero-default">
            <div className="absolute inset-0 z-0">
              <div
                className="w-full h-full scale-110 blur-2xl opacity-30"
                style={{ backgroundImage: `url('${heroImage}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
              />
              <div className={`absolute inset-0 bg-gradient-to-b ${accent.bg}`} />
            </div>
            
            <div className={`w-full mx-auto px-4 ${heroSpacing} relative z-10 grid gap-6 md:gap-12 ${heroGridClass}`}>
              
              <div className={`w-full flex justify-center ${isSplitDesktop ? 'order-1 md:order-2' : 'order-1'}`}>
                <div className="rounded-2xl overflow-hidden border-2 md:border-4 border-white shadow-lg bg-surface-container w-full max-w-sm md:max-w-md">
                  <img 
                    className="w-full h-auto object-contain max-h-[500px] md:max-h-[600px] block" 
                    src={heroImage} 
                    alt="Hero Poster" 
                  />
                </div>
              </div>

              <div className={`flex flex-col justify-center ${isSplitDesktop ? 'items-center md:items-start text-center md:text-left order-2 md:order-1' : 'items-center text-center'}`}>
                <span className={`inline-block px-3 py-1 rounded-full ${accent.button} text-xs font-semibold tracking-wide mb-4`}>
                  {dateText}
                </span>
                {location ? (
                  <div className={`flex items-center gap-2 text-xs md:text-sm text-on-surface-variant uppercase tracking-[0.2em] mb-2 ${isSplitDesktop ? 'justify-center md:justify-start' : 'justify-center'}`}>
                    <span className="material-symbols-outlined text-base">place</span>
                    <span>{location}</span>
                  </div>
                ) : null}
                <p className={`text-xs md:text-sm font-bold ${accent.accent} uppercase tracking-[0.2em] mb-2`}>
                  {title}
                </p>
                <h1 className="text-2xl md:text-4xl font-extrabold text-on-surface mb-3 leading-tight max-w-2xl px-2 md:px-0">
                  {heroTitle}
                </h1>
                <p className="text-sm md:text-base text-on-surface-variant font-medium mb-3 max-w-xl px-2 md:px-0">
                  {heroSubtitle}
                </p>
                <p className="text-xs md:text-sm text-on-surface-variant mb-6 max-w-lg px-2 md:px-0">
                  {publicDescription}
                </p>
                
                <div className={`flex w-full px-4 sm:px-0 ${isSplitDesktop ? 'justify-center md:justify-start' : 'justify-center'}`}>
                  <a
                    className={`${accent.button} inline-flex items-center justify-center rounded-xl font-bold shadow-md active:scale-95 transition-transform w-full max-w-sm sm:max-w-md px-8 py-4 text-base md:text-lg tracking-wide ${isSplitDesktop ? 'md:min-w-[320px] md:max-w-none' : ''}`}
                    href="#tickets"
                  >
                    {customButtonText}
                  </a>
                </div>
              </div>

            </div>
          </section>

          {/* Section À Propos */}
          {!hideAboutSection && (
            <section className="bg-background py-8 md:py-16" id="about">
              <div className="w-full mx-auto px-4">
                <div className="max-w-4xl mx-auto bg-surface-container-low p-4 md:p-8 rounded-2xl border border-outline-variant/20 shadow-sm">
                  <h2 className="text-xl md:text-2xl font-bold text-on-surface mb-4 text-center md:text-left">{aboutTitle}</h2>
                  <div className={`grid grid-cols-1 ${isMobileMode ? '' : 'md:grid-cols-2'} gap-6 items-center`}>
                    <div className="space-y-3 text-xs md:text-sm text-on-surface-variant text-center md:text-left">
                      {aboutParagraphs.map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                    </div>
                    <div className="rounded-xl overflow-hidden w-full max-w-sm mx-auto md:max-w-none shadow-sm bg-surface-container">
                      <img 
                        className="w-full h-auto object-contain max-h-[300px] md:max-h-[400px] block" 
                        src={aboutImage} 
                        alt="About event" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Section Billets / Cards */}
          <section className="py-8 md:py-16 bg-surface-container-low" id="tickets">
            <div className="w-full mx-auto px-4">
              <div className="text-center mb-6 md:mb-10">
                <h2 className="text-xl md:text-2xl font-bold text-on-surface">Billetterie Officielle</h2>
                <p className="text-on-surface-variant text-xs md:text-sm mt-1">Sélectionnez le forfait qui vous convient.</p>
              </div>
              
              <div className={`flex flex-col ${isMobileMode ? '' : 'md:grid md:grid-cols-3'} gap-6 max-w-sm md:max-w-none mx-auto w-full`}>
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id ?? ticket.title}
                    className={`flex flex-col w-full min-w-0 rounded-2xl overflow-hidden bg-surface-container-lowest shadow-sm border transition-all ${
                      (ticket.featured && !isMobileMode) ? `${accent.border} md:-translate-y-2 ring-1 ring-primary/20` : 'border-outline-variant/40'
                    }`}
                  >
                    <div className="p-5 border-b border-dashed border-outline-variant/60 relative">
                      {ticket.badge && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 block ${ticket.badgeColor ?? 'text-tertiary'}`}>
                          {ticket.badge}
                        </span>
                      )}
                      <h3 className="text-lg font-bold text-on-surface truncate whitespace-normal">{ticket.title}</h3>
                      <div className="mt-2 flex items-baseline flex-wrap">
                        <span className={`text-2xl font-black ${accent.text} break-all`}>{ticket.price}</span>
                        <span className="ml-1 text-xs text-on-surface-variant font-medium">{ticket.currency}</span>
                      </div>
                    </div>
                    
                    <div className="p-5 flex-grow">
                      <ul className="space-y-2.5">
                        {ticket.bulletPoints.map((point) => (
                          <li key={point} className="flex items-start gap-2.5 text-xs text-on-surface-variant">
                            <span className={`material-symbols-outlined ${accent.text} text-base shrink-0 mt-0.5`}>check_circle</span>
                            <span className="break-words">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="p-5 pt-0 mt-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => onBuyTicket?.(ticket)}
                        className={`w-full ${accent.button} py-2.5 rounded-xl font-bold text-xs hover:brightness-105 active:scale-[0.98] transition-all whitespace-nowrap inline-flex items-center justify-center gap-2`}
                      >
                        <span className="material-symbols-outlined text-sm">shopping_cart</span>
                        Acheter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section Contacts */}
          <section id="contact-social" className="bg-background py-8 md:py-16 border-t border-outline-variant/20">
            <div className="w-full mx-auto px-4">
              <div className="max-w-4xl mx-auto text-center">
                <h2 className="text-xl md:text-2xl font-bold text-on-surface mb-6">Contactez-nous</h2>
                
                <div className={`grid grid-cols-1 ${isMobileMode ? '' : 'md:grid-cols-2'} gap-4 max-w-sm md:max-w-none mx-auto mb-8`}>
                  <a href={`mailto:${contactEmail}`} className="flex flex-col items-center p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors group">
                    <div className={`w-12 h-12 rounded-full ${accent.bgFixed} flex items-center justify-center mb-2 group-hover:scale-105 transition-transform`}>
                      <span className={`material-symbols-outlined ${accent.text} text-xl`}>mail</span>
                    </div>
                    <p className="text-[10px] text-outline uppercase tracking-wider mb-0.5">Email</p>
                    <span className={`text-sm font-bold ${accent.text} break-all px-2`}>{contactEmail}</span>
                  </a>
                  
                  <a href={`tel:${contactPhone}`} className="flex flex-col items-center p-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors group">
                    <div className={`w-12 h-12 rounded-full ${accent.bgFixed} flex items-center justify-center mb-2 group-hover:scale-105 transition-transform`}>
                      <span className={`material-symbols-outlined ${accent.text} text-xl`}>call</span>
                    </div>
                    <p className="text-[10px] text-outline uppercase tracking-wider mb-0.5">Téléphone</p>
                    <span className="text-sm font-bold text-on-surface">{contactPhone}</span>
                  </a>
                </div>
                
                {socialLinks && socialLinks.length > 0 && (
                  <div className="pt-6 border-t border-outline-variant/30">
                    <h3 className="text-[10px] text-outline uppercase tracking-widest mb-4">Suivez-nous</h3>
                    <div className="flex flex-wrap justify-center gap-4">
                      {socialLinks.map((link, i) => {
                        if (!link.url) return null;
                        return (
                          <a
                            key={i}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            title={link.platform}
                            className={`w-10 h-10 rounded-full border ${accent.border} ${accent.iconBg} flex items-center justify-center ${accent.iconFg} hover:${accent.button} transition-all shadow-sm`}
                          >
                            <SocialPlatformIcon
                              platform={link.platform}
                              url={link.url}
                              size={22}
                              fgColor="#ffffff"
                            />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
          
        </main>
      </div>
    </div>
  );
}