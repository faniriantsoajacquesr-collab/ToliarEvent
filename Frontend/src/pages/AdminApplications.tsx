import { useEffect, useState } from 'react';
import LoadingOverlay from '../components/LoadingOverlay';
import { authAPI } from '../services/authAPI';

interface Application {
  id: number;
  event_id: string;
  profile_id: string;
  staff_type: string;
  status: string;
  created_at: string;
  profile: { id: string; first_name: string; last_name: string };
  profile_skill_rows?: Array<{ id: number; name: string }>;
}

export default function AdminApplications() {
  const [eventId, setEventId] = useState('');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accessToken = localStorage.getItem('access_token') || '';

  const fetchApplications = async () => {
    if (!eventId) return setError('Entrez l\'ID de l\'événement');
    setLoading(true);
    setError('');
    const res = await authAPI.getEventApplications(eventId, accessToken);
    setLoading(false);
    if (!res.success) return setError(res.error || 'Erreur');
    setApplications(res.applications || []);
  };

  const handleValidate = async (id: number, action: 'accept' | 'reject') => {
    setLoading(true);
    const res = await authAPI.validateApplication(id, action, accessToken);
    setLoading(false);
    if (!res.success) return setError(res.error || 'Erreur');
    // Refresh
    fetchApplications();
  };

  useEffect(() => {
    // no-op
  }, []);

  return (
    <div className="p-lg">
      <h2 className="text-headline-md font-bold mb-md">Gestion des candidatures</h2>

      <div className="mb-md">
        <label className="block text-label-md mb-sm">Event ID</label>
        <input value={eventId} onChange={e => setEventId(e.target.value)} className="px-md py-sm border rounded-lg w-full" placeholder="Entrez l'ID de l'événement" />
        <div className="mt-sm flex gap-sm">
          <button onClick={fetchApplications} className="px-lg py-md bg-primary text-white rounded-lg">Charger</button>
        </div>
      </div>

      {error && <div className="p-md bg-error-container text-on-error-container rounded-lg mb-md">{error}</div>}

      {loading && <LoadingOverlay message="Chargement des candidatures..." />}

      {!loading && applications.length === 0 && <div className="text-on-surface-variant">Aucune candidature en attente</div>}

      <div className="grid gap-md">
        {applications.map(app => (
          <div key={app.id} className="p-md border rounded-lg bg-surface-container-low">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold">{app.profile?.first_name} {app.profile?.last_name}</div>
                <div className="text-label-sm text-on-surface-variant">Rôle demandé: {app.staff_type}</div>
              </div>
              <div className="text-label-sm text-on-surface-variant">Candidature: {new Date(app.created_at).toLocaleString()}</div>
            </div>

            <div className="mt-sm">
              <div className="text-label-sm font-semibold">Compétences déclarées:</div>
              <div className="flex gap-xs flex-wrap mt-xs">
                {app.profile_skill_rows?.map(s => (
                  <span key={s.id} className="px-md py-xs bg-primary-container text-primary rounded-full text-label-sm">{s.name}</span>
                ))}
              </div>
            </div>

            <div className="mt-md flex gap-sm">
              <button onClick={() => handleValidate(app.id, 'accept')} className="px-lg py-md bg-success text-white rounded-lg">Accepter</button>
              <button onClick={() => handleValidate(app.id, 'reject')} className="px-lg py-md bg-error text-white rounded-lg">Rejeter</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
