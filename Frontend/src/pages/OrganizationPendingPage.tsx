import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthShell from '../components/AuthShell';
import OnboardingLayout from '../components/OnboardingLayout';

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
    <OnboardingLayout>
      <AuthShell
        wide
        title={isRejected ? 'Demande refusée' : 'Validation en cours'}
        subtitle={organizationName || undefined}
      >
        <div className="text-center space-y-6">
          <div
            className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
              isRejected ? 'bg-error-container' : 'bg-primary/10'
            }`}
          >
            <Clock className={`w-8 h-8 ${isRejected ? 'text-on-error-container' : 'text-primary'}`} />
          </div>

          <p className="landing-text-muted text-sm leading-relaxed">
            {isRejected
              ? 'Votre organisation n\'a pas été approuvée par notre équipe. Vous ne pouvez pas accéder à la plateforme pour le moment.'
              : 'Votre organisation a bien été créée et est en attente de validation par un administrateur ToliarEvent. Vous recevrez l\'accès au SaaS dès qu\'elle sera approuvée.'}
          </p>

          {!isRejected && (
            <div className="rounded-xl border border-[var(--landing-border)] bg-[var(--landing-glass-bg)] p-4 text-left">
              <p className="landing-text-muted text-sm">
                En attendant, vous pouvez fermer cette page. Revenez plus tard ou cliquez sur « Vérifier le statut » pour actualiser.
              </p>
            </div>
          )}

          {message && (
            <div className="p-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-glass-bg)] text-sm landing-text-muted">
              {message}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            {!isRejected && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={checking}
                className="inline-flex items-center justify-center gap-2 landing-btn-primary !px-5 !py-2.5 !text-sm !rounded-xl disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                {checking ? 'Vérification...' : 'Vérifier le statut'}
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 landing-btn-secondary !px-5 !py-2.5 !text-sm !rounded-xl"
            >
              <LogOut className="w-4 h-4" />
              Se déconnecter
            </button>
          </div>
        </div>
      </AuthShell>
    </OnboardingLayout>
  );
}
