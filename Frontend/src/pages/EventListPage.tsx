import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/authAPI';
import LandingBackground from '../components/home/LandingBackground';
import RevealOnScroll from '../components/home/RevealOnScroll';
import { PublicEventsListSkeleton } from '../components/skeleton';

type EventCategory = {
  id: number;
  name: string;
};

type ListedEvent = {
  id: string;
  name: string;
  title: string;
  description: string;
  category: string;
  location: string;
  price: string;
  day: number | string;
  month: string;
  image: string;
  isPremiumRequired: boolean;
  startDate: string | null;
  endDate: string | null;
};

const ALL_CATEGORIES_LABEL = 'Tous';

function parseDateBoundary(value: string, endOfDay = false): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

function eventOverlapsDateRange(
  startDate: string | null,
  endDate: string | null,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  if (!rangeStart && !rangeEnd) return true;
  if (!startDate) return false;

  const eventStart = new Date(startDate);
  const eventEnd = endDate ? new Date(endDate) : eventStart;
  if (Number.isNaN(eventStart.getTime()) || Number.isNaN(eventEnd.getTime())) return false;

  const from = parseDateBoundary(rangeStart);
  const to = parseDateBoundary(rangeEnd, true);

  if (from && eventEnd < from) return false;
  if (to && eventStart > to) return false;
  return true;
}

function mapEventsToListed(events: any[], landingByEventId: Record<string, any>): ListedEvent[] {
  return (events || []).map((e: any) => {
    const landing = e.id ? landingByEventId[e.id] : null;
    const title = e.title || e.name || 'Événement';
    return {
      id: e.id,
      name: title,
      title,
      description: e.description || 'Aucune description fournie pour cet événement.',
      category: e.event_categories?.name || 'Autre',
      location: e.location || 'Toliara, Madagascar',
      price: e.price ? `${e.price} Ar` : 'Gratuit',
      day: e.start_date ? new Date(e.start_date).getDate() : '—',
      month: e.start_date
        ? new Date(e.start_date).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
        : '—',
      image:
        landing?.heroImage ||
        e.image_url ||
        'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600&auto=format&fit=crop',
      isPremiumRequired: e.is_premium || false,
      startDate: e.start_date ?? null,
      endDate: e.end_date ?? null,
    };
  });
}

export default function EventListPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<ListedEvent[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES_LABEL);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await authAPI.getPublicEvents();

        if (res.success && Array.isArray(res.categories)) {
          setCategories(
            res.categories.filter(
              (cat: EventCategory) => typeof cat.name === 'string' && cat.name.trim().length > 0,
            ),
          );
        } else {
          setCategories([]);
        }

        const landingByEventId =
          res.success && Array.isArray(res.publications)
            ? (res.publications || []).reduce((acc: Record<string, any>, landing: any) => {
                if (landing.eventId) acc[landing.eventId] = landing;
                return acc;
              }, {})
            : {};

        if (res.success && Array.isArray(res.events)) {
          setEvents(mapEventsToListed(res.events, landingByEventId));
        } else {
          setEvents([]);
        }
      } catch (err) {
        console.error('Failed to load events:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return events.filter((ev) => {
      if (activeCategory !== ALL_CATEGORIES_LABEL && ev.category !== activeCategory) {
        return false;
      }

      if (normalizedSearch) {
        const matchesName = ev.name.toLowerCase().includes(normalizedSearch);
        const matchesTitle = ev.title.toLowerCase().includes(normalizedSearch);
        if (!matchesName && !matchesTitle) return false;
      }

      if (!eventOverlapsDateRange(ev.startDate, ev.endDate, dateFrom, dateTo)) {
        return false;
      }

      return true;
    });
  }, [events, activeCategory, searchQuery, dateFrom, dateTo]);

  const categoryButtons = [ALL_CATEGORIES_LABEL, ...categories.map((cat) => cat.name)];

  const hasActiveFilters =
    activeCategory !== ALL_CATEGORIES_LABEL ||
    searchQuery.trim().length > 0 ||
    dateFrom.length > 0 ||
    dateTo.length > 0;

  const resetFilters = () => {
    setActiveCategory(ALL_CATEGORIES_LABEL);
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  };

  if (loading) {
    return <PublicEventsListSkeleton />;
  }

  return (
    <div className="landing-page min-h-screen flex flex-col">
      {/* Hero + filtres */}
      <section className="relative pt-20 pb-10 md:pb-14 overflow-hidden">
        <LandingBackground />

        <div className="landing-container relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-10 landing-hero-enter">
            <p className="landing-eyebrow mb-5 justify-center">Événements · Toliara</p>
            <h1 className="font-landing-display text-3xl md:text-5xl lg:text-6xl leading-[1.05] tracking-tight mb-5 landing-heading">
              Découvrez le meilleur de{' '}
              <span className="landing-gradient-text">Toliara</span>
            </h1>
            <p className="landing-text-muted text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
              Concerts, conférences, festivals — explorez les événements locaux et réservez votre
              place en quelques secondes.
            </p>
          </div>

          <div className="landing-filter-bar rounded-2xl p-2 md:p-3 flex flex-col md:flex-row items-stretch md:items-center gap-2 landing-hero-enter landing-hero-enter-d1">
            <div className="flex-1 flex items-center px-3 gap-2 py-2.5 border-b md:border-b-0 md:border-r landing-input-divider">
              <span className="material-symbols-outlined landing-text-subtle text-xl" aria-hidden="true">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Quel événement cherchez-vous ?"
                className="landing-input-field"
              />
            </div>
            <div className="flex-1 flex items-center px-3 gap-2 py-2.5 border-b md:border-b-0 md:border-r landing-input-divider">
              <span className="material-symbols-outlined landing-text-subtle text-xl" aria-hidden="true">
                calendar_month
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="landing-input-field landing-text-muted"
                aria-label="Date de début"
              />
            </div>
            <div className="flex-1 flex items-center px-3 gap-2 py-2.5 border-b md:border-b-0 md:border-r landing-input-divider">
              <span className="material-symbols-outlined landing-text-subtle text-xl" aria-hidden="true">
                event_available
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom || undefined}
                className="landing-input-field landing-text-muted"
                aria-label="Date de fin"
              />
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="landing-btn-secondary !px-5 !py-3 !text-sm shrink-0"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  filter_alt_off
                </span>
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Catégories */}
      <section className="landing-container mb-10">
        <div className="flex flex-wrap justify-center gap-2">
          {categoryButtons.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`landing-chip ${activeCategory === cat ? 'landing-chip--active' : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Grille événements */}
      <main className="landing-container flex-1 pb-20">
        {events.length === 0 ? (
          <div className="landing-empty-state py-16">
            <span className="material-symbols-outlined text-4xl text-primary mb-4 block" aria-hidden="true">
              event_busy
            </span>
            <p className="font-landing-display text-xl landing-heading mb-2">Aucun événement à afficher</p>
            <p className="landing-text-muted text-sm">
              Aucun événement publié pour le moment. Revenez bientôt !
            </p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="landing-empty-state py-16">
            <span className="material-symbols-outlined text-4xl text-primary mb-4 block" aria-hidden="true">
              search_off
            </span>
            <p className="font-landing-display text-xl landing-heading mb-2">Aucun événement trouvé</p>
            <p className="landing-text-muted text-sm mb-6">
              Essayez de modifier votre recherche, la catégorie ou l&apos;intervalle de dates.
            </p>
            {hasActiveFilters && (
              <button type="button" onClick={resetFilters} className="landing-btn-secondary !text-sm">
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  filter_alt_off
                </span>
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((ev, index) => (
              <RevealOnScroll key={ev.id} delay={(index % 3) * 80} direction="up">
                <article className="landing-event-card group h-full">
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--landing-bg-section-alt)]">
                    <img
                      src={ev.image}
                      alt={ev.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4 w-12 h-12 landing-event-date rounded-xl flex flex-col items-center justify-center shadow-sm">
                      <span className="text-base font-black landing-heading leading-none">{ev.day}</span>
                      <span className="text-[9px] font-bold uppercase landing-text-subtle tracking-wider mt-0.5">
                        {ev.month}
                      </span>
                    </div>
                    <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-full tracking-wide">
                      {ev.category}
                    </div>
                    {ev.isPremiumRequired && (
                      <div className="absolute inset-0 bg-[var(--landing-bg)]/80 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center">
                        <span
                          className="material-symbols-outlined text-primary text-3xl mb-2"
                          aria-hidden="true"
                        >
                          qr_code_scanner
                        </span>
                        <p className="text-xs font-bold landing-heading uppercase tracking-widest">
                          Pass Premium Requis
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <h2 className="font-landing-display text-lg md:text-xl landing-heading group-hover:text-primary transition-colors line-clamp-1 mb-2">
                      {ev.name}
                    </h2>
                    <p className="text-xs landing-text-muted line-clamp-2 leading-relaxed mb-4 flex-grow">
                      {ev.description}
                    </p>

                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--landing-border)] mb-4 bg-[var(--landing-bg-section-alt)]">
                      <span className="material-symbols-outlined landing-text-subtle text-sm shrink-0" aria-hidden="true">
                        location_on
                      </span>
                      <span className="text-xs font-semibold landing-text-muted truncate">{ev.location}</span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      {ev.price && ev.price !== 'Gratuit' && (
                        <span className="text-base font-bold text-primary">{ev.price}</span>
                      )}
                      {ev.price === 'Gratuit' && (
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Gratuit</span>
                      )}
                      <button
                        type="button"
                        className="landing-btn-primary !px-5 !py-2.5 !text-xs ml-auto"
                        onClick={() => navigate(`/evenements/${ev.id}`)}
                      >
                        En savoir plus
                      </button>
                    </div>
                  </div>
                </article>
              </RevealOnScroll>
            ))}
          </div>
        )}

        {!loading && filteredEvents.length > 0 && (
          <p className="text-center mt-12 text-sm landing-text-subtle">
            {filteredEvents.length} événement{filteredEvents.length > 1 ? 's' : ''} affiché
            {filteredEvents.length > 1 ? 's' : ''}</p>
        )}
      </main>
    </div>
  );
}
