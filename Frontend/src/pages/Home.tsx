import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { normalizeHash, scrollToSection } from '../hooks/usePublicNav';
import { useCountUp } from '../hooks/useCountUp';
import AboutSection from '../components/home/AboutSection';
import ContactSection from '../components/home/ContactSection';
import HowItWorksSection from '../components/home/HowItWorksSection';
import CtaBandSection from '../components/home/CtaBandSection';
import LandingBackground from '../components/home/LandingBackground';
import MarqueeStrip from '../components/home/MarqueeStrip';
import heroImage from '../assets/Logo hero section.png';

function StatItem({ value, label, isNumeric }: { value: string; label: string; isNumeric?: boolean }) {
  const count = useCountUp({ end: isNumeric ? parseInt(value, 10) : 0, suffix: isNumeric ? '+' : '' });

  return (
    <div className="text-center md:text-left">
      <dd className="landing-stat-value">
        {isNumeric ? <span ref={count.ref}>{count.display}</span> : value}
      </dd>
      <dd className="text-xs uppercase tracking-wider landing-text-subtle mt-1">{label}</dd>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, setAuthModalOpen, getAppEntryPath } = useAuth();

  useEffect(() => {
    const scrollFromHash = () => {
      const section = normalizeHash(window.location.hash);
      if (section && section !== 'evenements') {
        setTimeout(() => {
          scrollToSection(section);
          window.dispatchEvent(new Event('scroll'));
        }, 100);
      }
    };
    scrollFromHash();
    window.addEventListener('hashchange', scrollFromHash);
    return () => window.removeEventListener('hashchange', scrollFromHash);
  }, []);

  const handleCreateEvent = () => {
    if (isAuthenticated) {
      navigate(getAppEntryPath());
    } else {
      setAuthModalOpen(true);
    }
  };

  return (
    <div className="landing-page min-h-screen overflow-x-hidden">
      {/* ── Hero ── */}
      <section
        id="accueil"
        className="relative scroll-mt-28 min-h-[92vh] flex flex-col justify-center pt-20 pb-8 overflow-hidden"
      >
        <LandingBackground />

        <div className="landing-container relative z-10 flex-1 flex flex-col justify-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-10 items-center">
            <div className="lg:col-span-6">
              <p className="landing-eyebrow mb-6 landing-hero-enter">
                Plateforme événementielle · Toliara
              </p>
              <h1 className="font-landing-display text-[2.75rem] md:text-[4rem] lg:text-[4.5rem] leading-[1.02] tracking-tight mb-7 landing-hero-enter landing-hero-enter-d1 landing-heading">
                Chaque billet vendu,
                <br />
                <span className="landing-gradient-text">chaque entrée contrôlée</span>
              </h1>
              <p className="landing-text-muted text-lg md:text-xl leading-relaxed max-w-lg mb-10 landing-hero-enter landing-hero-enter-d2">
                ToliarEvent centralise billetterie, équipe et comptabilité pour les organisateurs
                toliarais. Fini le chaos des groupes WhatsApp et des tickets papier non tracés.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-14 landing-hero-enter landing-hero-enter-d3">
                <button type="button" onClick={handleCreateEvent} className="landing-btn-primary">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    add_circle
                  </span>
                  Créer un événement
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/evenements')}
                  className="landing-btn-secondary"
                >
                  Voir les événements
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    arrow_forward
                  </span>
                </button>
              </div>
              <dl className="grid grid-cols-3 gap-6 pt-8 border-t border-[var(--landing-border)] landing-hero-enter landing-hero-enter-d4">
                <StatItem value="5" label="Piliers opérationnels" isNumeric />
                <StatItem value="QR" label="Billets sécurisés" />
                <StatItem value="24/7" label="Suivi financier" />
              </dl>
            </div>

            <div className="lg:col-span-6 landing-hero-enter landing-hero-enter-d2">
              <div className="relative max-w-md mx-auto lg:max-w-none lg:ml-auto perspective-[1200px]">
                <div className="landing-hero-card-glow" aria-hidden="true" />
                <div className="landing-hero-card">
                  <div className="p-2">
                    <img
                      src={heroImage}
                      alt="Interface ToliarEvent — gestion d'événements à Toliara"
                      className="rounded-xl w-full"
                    />
                  </div>
                  <div className="px-5 py-4 landing-hero-card-footer flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="material-symbols-outlined text-primary text-[18px]"
                        aria-hidden="true"
                      >
                        qr_code_2
                      </span>
                      <span className="text-xs font-medium landing-text-subtle tracking-wide">
                        Validé → Payé → Utilisé
                      </span>
                    </div>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-landing-gold">
                      <span className="w-1.5 h-1.5 rounded-full bg-landing-gold landing-step-ring" />
                      Live
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <MarqueeStrip />
      </section>

      <AboutSection />
      <HowItWorksSection />
      <CtaBandSection
        onCreateEvent={handleCreateEvent}
        onBrowseEvents={() => navigate('/evenements')}
      />
      <ContactSection />
    </div>
  );
}
