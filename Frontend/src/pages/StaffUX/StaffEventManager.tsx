import { useState, useEffect } from 'react';
import { API_URL } from '../../config/api';
import ApplyEventModal from '../../components/ApplyEventModal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { authAPI } from '../../services/authAPI';

interface AppliedEvent {
  appId: number;
  eventId: string;
  name: string;
  status: 'En attente' | 'Approuvé' | 'Refusé';
  location?: string;
  startDate?: string;
  endDate?: string;
}

export default function StaffEventManager() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [appliedEvents, setAppliedEvents] = useState<AppliedEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [retryingAppId, setRetryingAppId] = useState<number | null>(null);

  // Fetch user's applications
  const fetchMyApplications = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${API_URL}/my-applications`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.applications)) {
        const mapped: AppliedEvent[] = data.applications.map((a: any) => {
          const raw = (a.status || '').toString().toLowerCase();
          const statusLabel = raw.includes('valide') || raw.includes('valid') ? 'Approuvé' : raw.includes('refus') ? 'Refusé' : 'En attente';
          return {
            appId: a.id,
            eventId: a.events?.id || a.event_id,
            name: a.events?.title || a.events?.name || 'Événement',
            status: statusLabel,
            location: a.events?.location || 'Non spécifié',
            startDate: a.events?.start_date,
            endDate: a.events?.end_date,
          };
        });
        setAppliedEvents(mapped);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des candidatures :', err);
    }
  };

  useEffect(() => {
    fetchMyApplications();
  }, [session]);

  // Poll while any application is pending
  useEffect(() => {
    const hasPending = appliedEvents.some(a => a.status === 'En attente');
    if (!hasPending) return;
    const iv = setInterval(() => fetchMyApplications(), 10000);
    return () => clearInterval(iv);
  }, [appliedEvents]);

  const handleOpen = () => setIsModalOpen(true);
  const handleClose = () => setIsModalOpen(false);
  const handleApplied = async () => { await fetchMyApplications(); };

  const handleLeaveEvent = async (appId: number) => {
    if (!session?.access_token) return;
    if (!confirm("Voulez-vous vraiment quitter cet événement ?")) return;
    try {
      const res = await fetch(`${API_URL}/event-staff/my/${appId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.success) {
        setAppliedEvents((prev) => prev.filter((p) => p.appId !== appId));
        showToast('Candidature retirée.', 'success');
      } else {
        showToast(data.error || 'Impossible de quitter l\'événement', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Erreur réseau', 'error');
    }
  };

  const handleRetryApplication = async (appId: number) => {
    if (!session?.access_token) return;

    setRetryingAppId(appId);
    try {
      const data = await authAPI.retryEventApplication(appId, session.access_token);
      if (data.success) {
        showToast(data.message || 'Candidature renvoyée pour validation.', 'success');
        setAppliedEvents((prev) =>
          prev.map((event) =>
            event.appId === appId ? { ...event, status: 'En attente' } : event
          )
        );
      } else {
        showToast(data.error || 'Impossible de relancer la candidature.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Erreur réseau', 'error');
    } finally {
      setRetryingAppId(null);
    }
  };

  const getStatusStyle = (status: AppliedEvent['status']) => {
    switch (status) {
      case 'Approuvé': return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      case 'Refusé': return 'bg-rose-50 text-rose-700 border-rose-200/60';
      default: return 'bg-amber-50 text-amber-700 border-amber-200/60';
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-4 mt-16 md:p-6 bg-background custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/30 pb-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">Mes événements</h1>
            <p className="text-sm text-on-surface-variant">Basculez entre les événements auxquels vous participez.</p>
          </div>
          <button
            type="button"
            onClick={handleOpen}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 shadow-sm active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-md">add</span>
            Rejoindre un événement
          </button>
        </div>

        {appliedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/40 border-dashed text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3">assignment_ind</span>
            <p className="text-sm font-medium text-on-surface">Aucun engagement pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {appliedEvents.map((e) => (
              <div key={e.appId} className="bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col overflow-hidden">
                <div className="p-5 flex-1 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-gray-900 text-base line-clamp-1">{e.name}</h3>
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full border shrink-0 ${getStatusStyle(e.status)}`}>
                      {e.status}
                    </span>
                  </div>
                  <div className="h-[1px] bg-gray-50"></div>
                  <div className="space-y-2 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-gray-400">location_on</span>
                      <span className="truncate">{e.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-gray-400">calendar_today</span>
                      <span>
                        {e.startDate ? new Date(e.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'À définir'}
                        {e.endDate && ` - ${new Date(e.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                  {e.status === 'Refusé' && (
                    <button
                      type="button"
                      onClick={() => handleRetryApplication(e.appId)}
                      disabled={retryingAppId === e.appId}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-sm">refresh</span>
                      {retryingAppId === e.appId ? 'Envoi...' : 'Réessayer'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleLeaveEvent(e.appId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 hover:text-red-700 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">logout</span>
                    Quitter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ApplyEventModal isOpen={isModalOpen} onClose={handleClose} onApplied={handleApplied} />
      </div>
    </main>
  );
}