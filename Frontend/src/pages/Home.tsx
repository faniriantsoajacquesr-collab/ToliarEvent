import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { normalizeHash, scrollToSection } from '../hooks/usePublicNav';
import { authAPI } from '../services/authAPI';
import DashboardPreview from '../components/home/DashboardPreview';
import ContactSection from '../components/home/ContactSection';
import heroLogo from '../assets/Logo hero section.png';
import './Home.css';

type PublicEvent = { id: string; title: string; start_date: string; location?: string; image_url?: string; event_categories?: { name: string } | null };
type Publication = { eventId: string; heroImage?: string };
type UpcomingEvent = PublicEvent & { image?: string };
const features = [
  { icon: 'group', title: 'Équipe', text: 'Répartissez les rôles et gérez les candidatures de votre staff.' },
  { icon: 'calendar_month', title: 'Planning', text: 'Attribuez les tâches et suivez les préparatifs de votre événement.' },
  { icon: 'qr_code_2', title: 'Billetterie', text: 'Créez vos billets QR et contrôlez les entrées le jour J.' },
  { icon: 'account_balance_wallet', title: 'Finances', text: 'Retrouvez vos recettes et vos dépenses au même endroit.' },
];
function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{name}</span>;
}
export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, setAuthModalOpen, getAppEntryPath } = useAuth();
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const result = await authAPI.getPublicEvents();
        if (!result.success || !Array.isArray(result.events)) throw new Error('Events unavailable');
        const publications: Publication[] = Array.isArray(result.publications) ? result.publications : [];
        const images = new Map(publications.map((publication) => [publication.eventId, publication.heroImage]));
        const now = Date.now();
        const upcoming = (result.events as PublicEvent[])
          .filter((event) => event.id && Date.parse(event.start_date) >= now)
          .sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date))
          .slice(0, 3)
          .map((event) => ({ ...event, image: images.get(event.id) || event.image_url }));
        if (active) setEvents(upcoming);
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scrollFromHash = () => {
      const section = normalizeHash(window.location.hash);
      if (section && section !== 'evenements') timer = setTimeout(() => scrollToSection(section), 100);
    };
    scrollFromHash();
    window.addEventListener('hashchange', scrollFromHash);
    return () => { clearTimeout(timer); window.removeEventListener('hashchange', scrollFromHash); };
  }, []);
  const handleCreateEvent = () => {
    if (isAuthenticated) navigate(getAppEntryPath());
    else setAuthModalOpen(true, 'signup');
  };
  return (
    <div className="landing-page home-public">
      <section id="accueil" className="home-hero scroll-mt-28" aria-labelledby="home-title">
        <div className="landing-container relative home-hero-layout">
          <div className="home-hero-content">
            <p className="home-location"><Icon name="location_on" className="text-lg" /> Toliara, Madagascar</p>
            <h1 id="home-title" className="font-landing-display landing-heading">Découvrez ce qui se passe<br /><span className="home-city">à Toliara.</span></h1>
            <p className="home-hero-copy landing-text-muted">Concerts, gaming, culture, ateliers…<br />Découvrez les événements et réservez<br className="hidden sm:block" /> vos billets en ligne.</p>
            <Link to="/evenements" className="landing-btn-primary">Explorer les événements <Icon name="arrow_forward" className="text-xl" /></Link>
            <div className="home-interests landing-text-subtle" aria-label="Des événements pour toutes vos envies">
              {[[ 'music_note', 'Concerts' ], [ 'sports_esports', 'Gaming' ], [ 'theater_comedy', 'Culture' ], [ 'palette', 'Ateliers' ]].map(([icon, label]) => <span key={label}><Icon name={icon} className="text-lg" />{label}</span>)}
            </div>
          </div>
          <div className="home-logo-scene">
            <div className="home-logo-glass">
              <img src={heroLogo} alt="ToliarEvent — Gérez, organisez, publiez, vivez l’événement." width={1254} height={1254} fetchPriority="high" className="home-logo-art" />
            </div>
          </div>
        </div>
      </section>
      <section className="landing-container home-upcoming" aria-labelledby="upcoming-title" aria-busy={loading}>
        <div className="home-section-heading"><div><p className="landing-eyebrow mb-3">L’agenda local</p><h2 id="upcoming-title" className="font-landing-display landing-heading text-3xl md:text-4xl">À venir à Toliara</h2></div><Icon name="north_east" className="text-3xl landing-text-subtle" /></div>
        {loading ? (
          <div className="home-event-grid" role="status"><span className="sr-only">Chargement des événements à venir…</span>{[0, 1, 2].map((index) => <div className="home-event-placeholder motion-safe:animate-pulse" key={index} aria-hidden="true"><div /><span /><span /></div>)}</div>
        ) : error ? (
          <div className="landing-empty-state py-12" role="status"><Icon name="cloud_off" className="text-3xl mb-3 landing-text-subtle" /><p className="landing-heading font-semibold mb-2">Impossible de charger les événements.</p><p className="landing-text-muted text-sm mb-5">Vérifiez votre connexion, puis réessayez.</p><button type="button" className="landing-btn-secondary" onClick={() => setRetry((value) => value + 1)}>Réessayer</button></div>
        ) : events.length === 0 ? (
          <div className="landing-empty-state home-agenda-empty py-12" role="status"><div className="home-empty-art" aria-hidden="true"><span /><Icon name="calendar_month" /><span /></div><p className="landing-heading font-semibold mb-2">La suite du programme arrive bientôt.</p><p className="landing-text-muted text-sm">Aucun événement à venir n’est encore annoncé. Retrouvez les événements publiés dans l’agenda.</p></div>
        ) : (
          <div className="home-event-grid">{events.map((event) => (
            <Link to={`/evenements/${encodeURIComponent(event.id)}`} className="landing-event-card home-event-link" key={event.id}>
              <div className="home-event-image"><Icon name="confirmation_number" className="home-event-fallback" />
                {event.image && <img src={event.image} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                <time dateTime={event.start_date} className="home-event-date"><strong>{new Date(event.start_date).toLocaleDateString('fr-FR', { day: '2-digit', timeZone: 'Indian/Antananarivo' })}</strong><span>{new Date(event.start_date).toLocaleDateString('fr-FR', { month: 'short', timeZone: 'Indian/Antananarivo' })}</span></time>
              </div>
              <div className="p-6 flex flex-col flex-1"><p className="home-event-category">{event.event_categories?.name || 'Événement'}</p><h3 className="font-landing-display text-xl landing-heading mb-4 line-clamp-2">{event.title || 'Événement à Toliara'}</h3><p className="text-sm landing-text-muted flex gap-2 items-center mt-auto"><Icon name="location_on" className="text-lg shrink-0" /><span className="truncate">{event.location || 'Toliara, Madagascar'}</span></p><span className="home-event-action">Découvrir l’événement <Icon name="arrow_forward" className="text-lg" /></span></div>
            </Link>
          ))}</div>
        )}
        <div className="text-center mt-9"><Link to="/evenements" className="home-all-events">Voir tout <Icon name="arrow_forward" className="text-xl" /></Link></div>
      </section>
      <section id="a-propos" className="home-organizer scroll-mt-28" aria-labelledby="organizer-title">
        <div className="landing-container">
          <div className="max-w-3xl mx-auto text-center"><p className="landing-eyebrow justify-center mb-5">Vous êtes organisateur ?</p><h2 id="organizer-title" className="font-landing-display landing-heading text-3xl md:text-5xl leading-[1.12] tracking-tight">Toute la gestion de votre<br className="hidden md:block" /> événement, au même endroit.</h2><p className="landing-text-muted text-base md:text-lg leading-relaxed mt-6 mb-8">Gérez votre équipe, votre planning,<br className="hidden sm:block" /> votre billetterie et vos opérations<br className="hidden sm:block" /> depuis ToliarEvent.</p><div className="home-pro-actions"><Link to="/organisateurs" className="landing-btn-secondary">Découvrir ToliarEvent Pro <Icon name="arrow_forward" className="text-xl" /></Link><button type="button" className="landing-btn-primary" onClick={handleCreateEvent}>{isAuthenticated ? 'Accéder à mon espace' : 'Demander un accès anticipé'} <Icon name="add" className="text-xl" /></button></div></div>
          <div className="home-product-scene"><div className="home-product-orbit" aria-hidden="true" /><DashboardPreview /><div className="home-product-labels" aria-hidden="true">{features.map((feature) => <span key={feature.title}><Icon name={feature.icon} />{feature.title}</span>)}</div></div>
        </div>
      </section>
      <ContactSection />
    </div>
  );
}
