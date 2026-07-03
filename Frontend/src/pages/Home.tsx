import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { normalizeHash, scrollToSection } from '../hooks/usePublicNav';
import AboutSection from '../components/home/AboutSection';
import ContactSection from '../components/home/ContactSection';
import heroImage from '../assets/Logo hero section.png';

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
    <div className="min-h-screen bg-background overflow-x-hidden">
      <section
        id="accueil"
        className="relative px-gutter max-w-container-max mx-auto py-xl md:py-32 grid grid-cols-1 lg:grid-cols-2 gap-xl items-center scroll-mt-28"
      >
        <div className="z-10">
          <h1 className="font-display-lg text-display-lg lg:text-[64px] leading-tight mb-md text-on-background">
            Simplifiez vos événements à{' '}
            <span className="text-primary italic">Toliara</span>
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg mb-xl">
            Découvrez les événements locaux et achetez vos billets en ligne.
            Publier, vendre et organiser — tout au même endroit.
          </p>
          <div className="flex flex-col sm:flex-row gap-md">
            <button
              onClick={handleCreateEvent}
              className="bg-primary text-on-primary px-xl py-md font-label-md text-label-md font-bold rounded-xl flex items-center justify-center gap-sm shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
            >
              <span className="material-symbols-outlined">add_circle</span>
              Créer un événement
            </button>
            <button
              onClick={() => navigate('/evenements')}
              className="bg-surface-container-low border border-outline-variant text-on-surface px-xl py-md font-label-md text-label-md font-bold rounded-xl hover:bg-surface-container transition-colors"
            >
              Voir les événements
            </button>
          </div>
        </div>
        <div className="relative group">
          <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 to-tertiary/20 blur-3xl rounded-full opacity-50 group-hover:opacity-70 transition-opacity" />
          <div className="relative glass-card rounded-2xl p-sm shadow-2xl floating">
            <img
              className="rounded-xl w-full"
              src={heroImage}
              alt="ToliarEvent — gestion d'événements"
            />
          </div>
        </div>
      </section>

      <AboutSection />
      <ContactSection />
    </div>
  );
}
