import { useEffect, useState } from 'react';
import { API_URL } from '../config/api';
import LoadingOverlay from '../components/LoadingOverlay';
import EventCardDashboard from '../components/EventCardDashboard';
import EventModal from '../components/EventModal';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';
import { useToast } from '../contexts/ToastContext';
import EventDetailsModal from '../components/EventDetailsModal';

interface EventManagerProps {
  onNavigateToHome?: () => void;
  onSelectEvent: (eventId: string | null) => void;
}

export default function EventManager({ onSelectEvent }: EventManagerProps) {
  const [events, setEvents] = useState<any[]>([]);
  const { session } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingEventId, setViewingEventId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

    const mapped = (evRes.events || []).map((e: any) => ({
      id: e.id,
      name: e.title || e.name || 'Événement',
      organizer: orgRes.organization.name || '',
      category: e.event_categories?.name || '',
      location: e.location || '',
      startDate: e.start_date ? new Date(e.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '',
      endDate: e.end_date ? new Date(e.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '',
      status: 'upcoming' as const,
      icon: 'event',
      description: e.description,
      posts: e.posts,
      organizationCode: e.organizations?.code,
      rawStartDate: e.start_date,
      rawEndDate: e.end_date,
    }));

    setEvents(mapped);
    if (mapped.length > 0 && !selectedEventId) {
      setSelectedEventId(mapped[0].id);
      onSelectEvent(mapped[0].id);
    }
  };
 
  const viewingEvent = events.find(e => e.id === viewingEventId);
  const editingEvent = events.find(e => e.id === editingEventId);

  const handleSelectEvent = (id: string) => {
    setViewingEventId(id);
    setIsDetailsOpen(true);
  };

  const handleEditEvent = async (id: string) => {
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
        headers: { Authorization: `Bearer ${session.access_token}` } 
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
    return <LoadingOverlay message="Chargement de vos projets..." />;
  }

  return (
    <>
      <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-4 md:px-xl pb-xl pt-24 md:pt-28 min-h-screen">
        
        {/* En-tête Responsive Fixé */}
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-xl border-b border-outline-variant/20 pb-5">
          <div className="space-y-1">
            <h3 className="text-2xl font-bold tracking-tight text-on-surface">
              Mes Événements
            </h3>
            <p className="text-sm text-on-surface-variant max-w-2xl">
              Gerez et basculez entre vos différents projets logistiques. Suivez l'état de vos événements en temps réel depuis cette interface centralisée.
            </p>
          </div>
          <button
            onClick={() => { setEditingEventId(null); setIsModalOpen(true); }}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all whitespace-nowrap text-sm"
          >
            <span className="material-symbols-outlined text-md">add_circle</span>
            Nouvel Événement
          </button>
        </section>

        {/* Grille d'événements */}
        {events.length === 0 ? (
          <div className="mt-8 p-lg bg-surface-container-low rounded-xl text-center border border-dashed border-outline-variant/60">
            <h4 className="text-base font-bold mb-1">Aucun événement trouvé</h4>
            <p className="text-xs text-on-surface-variant mb-4">Vous n'avez encore créé aucun événement pour cette organisation.</p>
            <button onClick={() => setIsModalOpen(true)} className="bg-primary text-white text-xs px-4 py-2 rounded-lg font-bold">+ Ajouter un événement</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCardDashboard
                key={event.id}
                id={event.id}
                name={event.name}
                category={event.category}
                organizer={event.organizer ?? ''}
                location={event.location ?? ''}
                startDate={event.startDate ?? ''}
                endDate={event.endDate ?? ''}
                status={(event.status ?? 'upcoming') as 'upcoming' | 'active' | 'completed'}
                icon={event.icon ?? 'event'}
                isActive={selectedEventId === event.id}
                onSelect={handleSelectEvent}
                onEdit={handleEditEvent}
                onDelete={handleDeleteEvent}
                isDeleting={deleteLoadingId === event.id}
              />
            ))}
          </div>
        )}
      </main>

      <EventModal
        isOpen={isModalOpen}
        event={editingEvent || undefined}
        onClose={() => { setIsModalOpen(false); setEditingEventId(null); }}
        onSuccess={() => {
          refreshEvents().then(() => setEditingEventId(null));
        }}
      />

      <EventDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        event={viewingEvent}
      />
    </>
  );
}