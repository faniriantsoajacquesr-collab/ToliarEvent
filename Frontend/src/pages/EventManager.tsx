import { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../config/api';
import { EventsGridSkeleton } from '../components/skeleton';
import EventCardDashboard from '../components/EventCardDashboard';
import EventModal from '../components/EventModal';
import AppPageHeader from '../components/AppPageHeader';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';
import { useToast } from '../contexts/ToastContext';
import EventDetailsModal from '../components/EventDetailsModal';

interface EventManagerProps {
  onNavigateToHome?: () => void;
  onSelectEvent: (eventId: string | null) => void;
}

type EventStatus = 'upcoming' | 'active' | 'completed';

type DashboardEvent = {
  id: string;
  name: string;
  organizer: string;
  category: string;
  location: string;
  startDate: string;
  endDate: string;
  status: EventStatus;
  icon: string;
  description?: string;
  imageUrl?: string;
  rawStartDate?: string;
  rawEndDate?: string;
};

function resolveStatus(start?: string, end?: string): EventStatus {
  const now = new Date();
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  if (endDate && endDate < now) return 'completed';
  if (startDate && startDate <= now && (!endDate || endDate >= now)) return 'active';
  return 'upcoming';
}

export default function EventManager({ onSelectEvent }: EventManagerProps) {
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const { session } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingEventId, setViewingEventId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EventStatus>('all');
  const { showToast } = useToast();

  useEffect(() => {
    const load = async () => {
      if (!session?.access_token) return;

      setIsLoading(true);
      try {
        await refreshEvents();
      } catch (err) {
        console.error('Erreur chargement événements:', err);
        setEvents([]);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [session]);

  const refreshEvents = async () => {
    if (!session?.access_token) return;
    const orgRes = await authAPI.getMyOrganization(session.access_token);
    if (!orgRes.success || !orgRes.organization) {
      setEvents([]);
      return;
    }

    const evRes = await authAPI.getEvents(orgRes.organization.id, session.access_token);
    if (!evRes.success) {
      setEvents([]);
      return;
    }

    const mapped: DashboardEvent[] = (evRes.events || []).map((e: any) => ({
      id: e.id,
      name: e.title || e.name || 'Événement',
      organizer: orgRes.organization.name || '',
      category: e.event_categories?.name || '',
      location: e.location || '',
      startDate: e.start_date
        ? new Date(e.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
        : '',
      endDate: e.end_date
        ? new Date(e.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : '',
      status: resolveStatus(e.start_date, e.end_date),
      icon: 'event',
      description: e.description,
      imageUrl: e.image_url,
      rawStartDate: e.start_date,
      rawEndDate: e.end_date,
    }));

    setEvents(mapped);
    if (mapped.length > 0 && !selectedEventId) {
      setSelectedEventId(mapped[0].id);
      onSelectEvent(mapped[0].id);
    }
  };

  const stats = useMemo(() => ({
    total: events.length,
    upcoming: events.filter((e) => e.status === 'upcoming').length,
    active: events.filter((e) => e.status === 'active').length,
    completed: events.filter((e) => e.status === 'completed').length,
  }), [events]);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((event) => {
      const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
      const matchesQuery =
        !q ||
        event.name.toLowerCase().includes(q) ||
        event.category.toLowerCase().includes(q) ||
        event.location.toLowerCase().includes(q) ||
        event.organizer.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [events, searchQuery, statusFilter]);

  const viewingEvent = events.find((e) => e.id === viewingEventId);
  const editingEvent = events.find((e) => e.id === editingEventId);

  const handleActivateEvent = (id: string) => {
    setSelectedEventId(id);
    onSelectEvent(id);
  };

  const handleViewEvent = (id: string) => {
    setViewingEventId(id);
    setIsDetailsOpen(true);
  };

  const handleEditEvent = (id: string) => {
    setEditingEventId(id);
    setIsModalOpen(true);
  };

  const handleDeleteEvent = async (id: string) => {
    if (!session?.access_token) return;
    if (!confirm('Voulez-vous vraiment supprimer cet événement ?')) return;
    setDeleteLoadingId(id);
    try {
      const res = await fetch(`${API_URL}/events/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.success) {
        showToast('Événement supprimé', 'success');
        await refreshEvents();
      } else {
        showToast(data.error || 'Erreur suppression', 'error');
      }
    } catch (err) {
      console.error('Erreur suppression', err);
      showToast('Erreur suppression', 'error');
    } finally {
      setDeleteLoadingId(null);
    }
  };

  if (isLoading) {
    return <EventsGridSkeleton />;
  }

  const statCards = [
    { label: 'Total', value: stats.total, icon: 'event', accent: 'text-primary' },
    { label: 'À venir', value: stats.upcoming, icon: 'schedule', accent: 'text-blue-500' },
    { label: 'En cours', value: stats.active, icon: 'play_circle', accent: 'text-emerald-500' },
    { label: 'Terminés', value: stats.completed, icon: 'check_circle', accent: 'text-[var(--md-text-muted)]' },
  ] as const;

  const filterChips: { id: 'all' | EventStatus; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'upcoming', label: 'À venir' },
    { id: 'active', label: 'En cours' },
    { id: 'completed', label: 'Terminés' },
  ];

  return (
    <>
      <main className="dash-page flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-screen">
        <div className="relative z-10 max-w-container-max mx-auto px-gutter pb-12 pt-24 md:pt-28">
          <AppPageHeader
            title="Mes Événements"
            subtitle="Pilotez vos projets logistiques, basculez de contexte en un clic et suivez l'avancement en temps réel."
            actions={
              <button
                type="button"
                onClick={() => {
                  setEditingEventId(null);
                  setIsModalOpen(true);
                }}
                className="landing-btn-primary !px-5 !py-3 !text-sm !rounded-xl whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">add_circle</span>
                Nouvel événement
              </button>
            }
          />

          {/* KPI strip */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((stat) => (
              <div key={stat.label} className="dash-stat-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="dash-stat-label mb-1">{stat.label}</p>
                    <p className="dash-stat-value">{stat.value}</p>
                  </div>
                  <span className={`material-symbols-outlined text-2xl ${stat.accent} opacity-80`} aria-hidden="true">
                    {stat.icon}
                  </span>
                </div>
              </div>
            ))}
          </section>

          {/* Toolbar */}
          {events.length > 0 && (
            <section className="mb-8 space-y-4">
              <div className="dash-toolbar">
                <div className="flex-1 flex items-center gap-2 px-3 py-2.5">
                  <span className="material-symbols-outlined app-text-muted text-xl" aria-hidden="true">search</span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un événement, lieu, catégorie…"
                    className="w-full bg-transparent text-sm app-heading placeholder:app-text-muted focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {filterChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setStatusFilter(chip.id)}
                    className={`landing-chip ${statusFilter === chip.id ? 'landing-chip--active' : ''}`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Grid */}
          {events.length === 0 ? (
            <div className="dash-empty-state">
              <span className="material-symbols-outlined text-5xl text-primary mb-4 block" aria-hidden="true">
                event_busy
              </span>
              <h2 className="font-landing-display text-2xl app-heading mb-2">Aucun événement</h2>
              <p className="app-text-muted text-sm mb-6 max-w-sm mx-auto">
                Créez votre premier événement pour commencer à gérer billets, staff et planning depuis le dashboard.
              </p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="landing-btn-primary !px-6 !py-3 !text-sm !rounded-xl"
              >
                Créer un événement
              </button>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="dash-empty-state">
              <span className="material-symbols-outlined text-5xl text-primary mb-4 block" aria-hidden="true">
                search_off
              </span>
              <h2 className="font-landing-display text-2xl app-heading mb-2">Aucun résultat</h2>
              <p className="app-text-muted text-sm mb-6">
                Aucun événement ne correspond à votre recherche ou filtre.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="landing-btn-secondary !px-5 !py-2.5 !text-sm !rounded-xl"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                {filteredEvents.map((event) => (
                  <EventCardDashboard
                    key={event.id}
                    id={event.id}
                    name={event.name}
                    category={event.category}
                    organizer={event.organizer}
                    location={event.location}
                    startDate={event.startDate}
                    endDate={event.endDate}
                    status={event.status}
                    icon={event.icon}
                    imageUrl={event.imageUrl}
                    isActive={selectedEventId === event.id}
                    onActivate={handleActivateEvent}
                    onView={handleViewEvent}
                    onEdit={handleEditEvent}
                    onDelete={handleDeleteEvent}
                    isDeleting={deleteLoadingId === event.id}
                  />
                ))}
              </div>
              <p className="text-center mt-10 text-xs app-text-muted">
                {filteredEvents.length} événement{filteredEvents.length > 1 ? 's' : ''} affiché
                {filteredEvents.length > 1 ? 's' : ''}
                {selectedEventId && (
                  <> · Cliquez sur une carte pour définir le contexte actif du dashboard</>
                )}
              </p>
            </>
          )}
        </div>
      </main>

      <EventModal
        isOpen={isModalOpen}
        event={editingEvent || undefined}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEventId(null);
        }}
        onSuccess={() => {
          refreshEvents().then(() => setEditingEventId(null));
        }}
      />

      <EventDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        event={
          viewingEvent
            ? {
                ...viewingEvent,
                description: viewingEvent.description ?? '',
                rawStartDate: viewingEvent.rawStartDate ?? viewingEvent.startDate,
                rawEndDate: viewingEvent.rawEndDate ?? viewingEvent.endDate,
              }
            : null
        }
      />
    </>
  );
}
