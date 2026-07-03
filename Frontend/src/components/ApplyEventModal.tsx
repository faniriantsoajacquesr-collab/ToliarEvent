import { useEffect, useState } from 'react';
import { authAPI } from '../services/authAPI';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface ApplyEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplied: (eventId: string, eventName: string) => void;
}

export default function ApplyEventModal({ isOpen, onClose, onApplied }: ApplyEventModalProps) {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [events, setEvents] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      if (!session?.access_token) return;
      setLoading(true);
      try {
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
        setEvents(evRes.events || []);
      } catch (err) {
        console.error(err);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, session]);

  const filtered = events.filter((e: any) =>
    `${e.title || e.name || ''}`.toLowerCase().includes(query.toLowerCase())
  );

  const handleApply = async () => {
    if (!selectedEventId || !session?.access_token) return;
    setLoading(true);
    try {
      const res = await authAPI.applyEvent(selectedEventId, session.access_token);
      if (res.success) {
        showToast('Candidature envoyée', 'success');
        const ev = events.find((x: any) => x.id === selectedEventId);
        onApplied(selectedEventId, ev?.title || ev?.name || 'Événement');
        onClose();
      } else {
        showToast(res.error || 'Erreur lors de la candidature', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Erreur serveur', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative bg-surface-container-low rounded-lg w-full max-w-2xl p-lg shadow-xl z-50">
        <div className="flex justify-between items-center mb-md">
          <h3 className="text-headline-sm font-bold">Participer à un événement</h3>
          <button onClick={onClose} className="text-on-surface-variant">Fermer</button>
        </div>

        <div className="mb-md">
          <input
            placeholder="Rechercher un événement..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div className="max-h-64 overflow-auto space-y-2 mb-md">
          {loading ? (
            <div className="text-center py-6">Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-6 text-on-surface-variant">Aucun événement trouvé</div>
          ) : (
            filtered.map((e: any) => (
              <div
                key={e.id}
                onClick={() => setSelectedEventId(e.id)}
                className={`p-3 border rounded-md cursor-pointer ${selectedEventId === e.id ? 'border-primary bg-primary/5' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold">{e.title || e.name}</div>
                    <div className="text-sm text-on-surface-variant">{e.location || ''}</div>
                  </div>
                  <div className="text-sm text-on-surface-variant">{e.start_date ? new Date(e.start_date).toLocaleDateString('fr-FR') : ''}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-surface-container">Annuler</button>
          <button onClick={handleApply} disabled={!selectedEventId || loading} className="px-4 py-2 rounded-md bg-primary text-on-primary disabled:opacity-50">
            {loading ? 'Envoi...' : 'Postuler'}
          </button>
        </div>
      </div>
    </div>
  );
}
