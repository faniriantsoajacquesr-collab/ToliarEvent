import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/authAPI';

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
  rangeEnd: string
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
      description: e.description || "Aucune description fournie pour cet événement.",
      category: e.event_categories?.name || 'Autre',
      location: e.location || 'Toliara, Madagascar',
      price: e.price ? `${e.price} Ar` : 'Gratuit',
      day: e.start_date ? new Date(e.start_date).getDate() : '12',
      month: e.start_date ? new Date(e.start_date).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '') : 'OCT',
      image: landing?.heroImage || e.image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600&auto=format&fit=crop',
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
            res.categories.filter((cat: EventCategory) => typeof cat.name === 'string' && cat.name.trim().length > 0)
          );
        } else {
          setCategories([]);
        }

        const landingByEventId = (res.success && Array.isArray(res.publications))
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <section className="relative w-full pt-16 pb-12 px-4 text-center bg-gradient-to-b from-indigo-50/60 to-transparent">
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
            Découvrez le meilleur de <span className="text-blue-600">Toliara</span>.
          </h1>

          <p className="text-slate-500 font-medium max-w-2xl text-sm md:text-base leading-relaxed mb-8">
            Des concerts live aux sommets technologiques, explorez les événements qui façonnent notre ville. Réservez votre place en quelques secondes.
          </p>

          <div className="w-full max-w-4xl bg-white rounded-2xl p-2 shadow-xl shadow-slate-200/80 border border-slate-100 flex flex-col md:flex-row items-center gap-2">
            <div className="w-full flex items-center px-3 gap-2 border-b md:border-b-0 md:border-r border-slate-100 py-2">
              <span className="material-symbols-outlined text-slate-400 text-xl">event</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Quel événement cherchez-vous ?"
                className="w-full text-sm font-medium focus:outline-none bg-transparent placeholder-slate-400"
              />
            </div>
            <div className="w-full flex items-center px-3 gap-2 border-b md:border-b-0 md:border-r border-slate-100 py-2">
              <span className="material-symbols-outlined text-slate-400 text-xl">calendar_month</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full text-sm font-medium focus:outline-none bg-transparent text-slate-600"
                aria-label="Date de début"
              />
            </div>
            <div className="w-full flex items-center px-3 gap-2 border-b md:border-b-0 md:border-r border-slate-100 py-2">
              <span className="material-symbols-outlined text-slate-400 text-xl">event_available</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom || undefined}
                className="w-full text-sm font-medium focus:outline-none bg-transparent text-slate-600"
                aria-label="Date de fin"
              />
            </div>
            <button
              type="button"
              className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <span className="material-symbols-outlined text-base">search</span>
              Explorer
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="w-full md:w-auto px-5 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold text-sm hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shrink-0"
              >
                <span className="material-symbols-outlined text-base">filter_alt_off</span>
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="w-full px-4 mb-10">
        <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
          {categoryButtons.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-6 py-2 rounded-full text-xs font-bold tracking-wide border transition-all ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200/60 hover:border-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      <main className="flex-1 px-4 md:px-8 max-w-7xl mx-auto w-full pb-16">
        {loading ? (
          <div className="text-center py-20 font-medium text-slate-400">Chargement des événements…</div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 p-8 max-w-lg mx-auto">
            <p className="font-bold text-lg text-slate-800 mb-1">Aucun événement à afficher</p>
            <p className="text-sm text-slate-400">Aucun événement publié pour le moment. Revenez bientôt !</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 p-8 max-w-lg mx-auto">
            <p className="font-bold text-lg text-slate-800 mb-1">Aucun événement trouvé</p>
            <p className="text-sm text-slate-400 mb-6">Essayez de modifier votre recherche, la catégorie ou l&apos;intervalle de dates.</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm hover:border-slate-300 transition-all"
              >
                <span className="material-symbols-outlined text-base">filter_alt_off</span>
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEvents.map((ev) => (
              <div
                key={ev.id}
                className="group bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col relative"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                  <img
                    src={ev.image}
                    alt={ev.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-4 left-4 w-12 h-12 bg-white/90 backdrop-blur-md rounded-xl flex flex-col items-center justify-center border border-white/40 shadow-sm">
                    <span className="text-base font-black text-slate-800 leading-none">{ev.day}</span>
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider mt-0.5">{ev.month}</span>
                  </div>

                  <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-full tracking-wide">
                    {ev.category}
                  </div>

                  {ev.isPremiumRequired && (
                    <div className="absolute inset-0 bg-slate-50/80 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center">
                      <span className="material-symbols-outlined text-blue-600 text-3xl mb-2 font-bold">qr_code_scanner</span>
                      <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Pass Premium Requis</p>
                    </div>
                  )}
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-lg md:text-xl font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1 mb-2">
                    {ev.name}
                  </h3>
                  <p className="text-xs font-medium text-slate-400 line-clamp-2 leading-relaxed mb-5">
                    {ev.description}
                  </p>

                  <div className="mt-auto flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100/50 mb-5">
                    <span className="material-symbols-outlined text-slate-400 text-sm shrink-0">location_on</span>
                    <span className="text-xs font-bold text-slate-500 truncate">{ev.location}</span>
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-1">
                    {ev.price && ev.price !== 'Gratuit' && (
                      <span className="text-base font-black text-blue-600">
                        {ev.price}
                      </span>
                    )}
                    <button
                      type="button"
                      className="px-5 py-2.5 rounded-xl font-bold text-xs tracking-wide shadow-sm transition-all bg-blue-600 text-white hover:bg-blue-700"
                      onClick={() => navigate(`/evenements/${ev.id}`)}
                    >
                      En savoir plus
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredEvents.length > 0 && (
          <div className="flex justify-center mt-12">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm hover:border-slate-300 active:scale-98 transition-all"
            >
              Charger plus d'événements
              <span className="material-symbols-outlined text-base">expand_more</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
