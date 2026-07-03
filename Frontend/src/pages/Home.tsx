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
          <div className="mt-xl flex items-center gap-md">
            <div className="flex -space-x-2">
              <img
                className="w-10 h-10 rounded-full border-2 border-surface"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAJmF6ZXSydVKH19BqvKuJcJoHT9t9g4t_SF5E3x7Olh72S6zFF1GFbfRLANXHi3SnFCAo_tI3BZhvjV7R7iwzRMp0KXGmW71vFZyqq5M4lvcWhigqL5mYH33IHPyzkAPHq99bBMYWnPuLBkIXooCqZ_e2d3D7jSxy7SWskJ1D5N9o_QPD8i9vwbfjQUWZwnrP_ytx9hZ_psz2LbfIAfmJrL5BkUFLjcqXWO8wR3I6Axwb_v-CKZyFubgQPIBHW2fHopBpipIE_NKs"
                alt="User"
              />
              <img
                className="w-10 h-10 rounded-full border-2 border-surface"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB4q_yptGfYBZ4b7cwq7hDScSlYvBjzUpVehWuuZKwjrBnnwYRS4xic0_QvJ3Czd0xhU35BNkstweDmh8LKTl1RxjSTHccb78UkFW6dZ9eyaWa80p3QtOMOYoQsXT1S3j2wpvl8dLuocTjFCvfRicAKMKg_AfwpvbVIWQXxoLXKG4Rcp1zOwiZUom6ev6RWF2_1ad0c5D4EHyUxV25mYCXF7iYD2mCve92NpaH5T0DWn18VkWofHurev5bcgpjquqt8uezvgjvzK7M"
                alt="User"
              />
              <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-bold text-xs">
                +12
              </div>
            </div>
            <p className="font-label-md text-label-md text-on-surface-variant">
              Rejoint par +200 organisateurs locaux
            </p>
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
