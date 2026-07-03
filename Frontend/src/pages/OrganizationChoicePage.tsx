import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/authAPI';
import { useAuth } from '../contexts/AuthContext';
import { resolveAppEntryPath } from '../utils/appRouting';

export default function OrganizationChoicePage() {
  const navigate = useNavigate();
  const { checkProfileCompletion, hasOrganization, organizationStatus } = useAuth();
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [orgName, setOrgName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accessToken = localStorage.getItem('access_token') || '';

  useEffect(() => {
    if (hasOrganization) {
      navigate(resolveAppEntryPath({
        hasProfile: true,
        hasOrganization: true,
        organizationStatus,
      }), { replace: true });
    }
  }, [hasOrganization, organizationStatus, navigate]);

  const handleCreate = async () => {
    setError('');
    if (!orgName || orgName.trim().length < 2) return setError('Nom d\'organisation requis');
    setLoading(true);
    const res = await authAPI.createOrganization(orgName.trim(), accessToken);
    setLoading(false);
    if (!res.success) return setError(res.error || 'Erreur lors de la création');
    const result = await checkProfileCompletion(accessToken);
    navigate(resolveAppEntryPath({ hasProfile: true, hasOrganization: true, organizationStatus: result.organizationStatus }), { replace: true });
  };

  const handleJoin = async () => {
    setError('');
    if (!joinCode || joinCode.trim().length === 0) return setError('Code requis');
    setLoading(true);
    const res = await authAPI.joinOrganization(joinCode.trim(), accessToken);
    setLoading(false);
    if (!res.success) return setError(res.error || 'Erreur lors de la demande');
    const result = await checkProfileCompletion(accessToken);
    navigate(resolveAppEntryPath({ hasProfile: true, hasOrganization: true, organizationStatus: result.organizationStatus }), { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-lg">
      <div className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl shadow-lg p-xl border border-outline-variant">
        <h1 className="text-headline-md font-bold mb-md">Que souhaitez-vous faire ?</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-lg mb-lg">
          <button
            onClick={() => setMode('create')}
            className={`p-lg rounded-xl border text-left shadow-sm ${mode === 'create' ? 'border-primary bg-primary/5' : 'border-outline-variant bg-white'}`}
          >
            <div className="font-semibold text-headline-sm">Créer une organisation</div>
            <p className="text-label-md text-on-surface-variant mt-xs">Vous serez admin de cette organisation. Elle devra être validée avant l'accès à la plateforme.</p>
          </button>

          <button
            onClick={() => setMode('join')}
            className={`p-lg rounded-xl border text-left shadow-sm ${mode === 'join' ? 'border-primary bg-primary/5' : 'border-outline-variant bg-white'}`}
          >
            <div className="font-semibold text-headline-sm">Rejoindre une organisation</div>
            <p className="text-label-md text-on-surface-variant mt-xs">Entrez le code d'invitation fourni par l'administrateur.</p>
          </button>
        </div>

        {mode === 'create' && (
          <div className="mt-md">
            <label className="block text-label-md mb-sm">Nom de l'organisation</label>
            <input value={orgName} onChange={e => setOrgName(e.target.value)} className="w-full px-md py-sm border rounded-lg" placeholder="Association Otaku Toliara" />
            <div className="mt-sm flex gap-sm">
              <button onClick={handleCreate} disabled={loading} className="px-lg py-md bg-primary text-white rounded-lg">Créer</button>
              <button onClick={() => setMode(null)} className="px-lg py-md border rounded-lg">Annuler</button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div className="mt-md">
            <label className="block text-label-md mb-sm">Code d'invitation</label>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value)} className="w-full px-md py-sm border rounded-lg" placeholder="Entrez le code (ex: 123456)" />
            <div className="mt-sm flex gap-sm">
              <button onClick={handleJoin} disabled={loading} className="px-lg py-md bg-primary text-white rounded-lg">Envoyer la demande</button>
              <button onClick={() => setMode(null)} className="px-lg py-md border rounded-lg">Annuler</button>
            </div>
          </div>
        )}

        {error && <div className="mt-md p-md bg-error-container text-on-error-container rounded-lg">{error}</div>}
      </div>
    </div>
  );
}
