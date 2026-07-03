import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function OrganizationPendingPage() {
  const navigate = useNavigate();
  const { checkProfileCompletion, logout, organizationName, organizationStatus } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');

  const accessToken = localStorage.getItem('access_token') || '';

  const handleRefresh = async () => {
    setChecking(true);
    setMessage('');
    const result = await checkProfileCompletion(accessToken);
    setChecking(false);

    if (result.organizationStatus === 'active') {
      navigate('/events', { replace: true });
      return;
    }

    if (result.organizationStatus === 'rejected') {
      setMessage('Votre demande d\'organisation a été refusée. Contactez le support pour plus d\'informations.');
      return;
    }

    setMessage('Votre organisation est toujours en cours de validation.');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const isRejected = organizationStatus === 'rejected';

  return (
    <div className="min-h-screen flex items-center justify-center p-lg bg-gradient-to-br from-primary-light/30 to-surface-container-lowest">
      <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-lg p-xl border border-outline-variant text-center">
        <div className={`mx-auto mb-lg w-16 h-16 rounded-full flex items-center justify-center ${isRejected ? 'bg-error-container' : 'bg-primary/10'}`}>
          <Clock className={`w-8 h-8 ${isRejected ? 'text-on-error-container' : 'text-primary'}`} />
        </div>

        <h1 className="text-headline-md font-bold mb-sm">
          {isRejected ? 'Demande refusée' : 'Validation en cours'}
        </h1>

        {organizationName && (
          <p className="text-title-md text-primary font-semibold mb-md">{organizationName}</p>
        )}

        <p className="text-body-md text-on-surface-variant mb-xl">
          {isRejected
            ? 'Votre organisation n\'a pas été approuvée par notre équipe. Vous ne pouvez pas accéder à la plateforme pour le moment.'
            : 'Votre organisation a bien été créée et est en attente de validation par un administrateur ToliarEvent. Vous recevrez l\'accès au SaaS dès qu\'elle sera approuvée.'}
        </p>

        {!isRejected && (
          <div className="rounded-xl bg-surface-container-low p-md mb-xl text-left">
            <p className="text-label-md text-on-surface-variant">
              En attendant, vous pouvez fermer cette page. Revenez plus tard ou cliquez sur « Vérifier le statut » pour actualiser.
            </p>
          </div>
        )}

        {message && (
          <div className="mb-lg p-md bg-surface-container-high rounded-lg text-label-md text-on-surface-variant">
            {message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-sm justify-center">
          {!isRejected && (
            <button
              onClick={handleRefresh}
              disabled={checking}
              className="inline-flex items-center justify-center gap-sm px-lg py-md bg-primary text-white rounded-lg disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? 'Vérification...' : 'Vérifier le statut'}
            </button>
          )}
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-sm px-lg py-md border border-outline-variant rounded-lg"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
