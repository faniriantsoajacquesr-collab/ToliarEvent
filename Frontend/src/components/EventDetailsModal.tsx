import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';

interface EventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: {
    id: string;
    name: string;
    category?: string;
    organizer: string;
    location: string;
    description: string;
    organizationCode?: number;
    rawStartDate: string;
    rawEndDate: string;
  } | null;
}

export default function EventDetailsModal({ isOpen, onClose, event }: EventDetailsModalProps) {
  const { showToast } = useToast();
  const { user, session } = useAuth();

  const [hasApplied, setHasApplied] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (isOpen && event && user?.role === 'staff' && session?.access_token) {
      const fetchApplicationStatus = async () => {
        try {
          const res = await fetch(`http://localhost:5000/api/auth/my-event-application?event_id=${event.id}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const data = await res.json();
          if (data.success && data.application) {
            setHasApplied(true);
            setApplicationStatus(data.application.status);
          } else {
            setHasApplied(false);
            setApplicationStatus(null);
          }
        } catch (err) {
          console.error('Error fetching application status:', err);
          showToast('Erreur lors de la récupération du statut de candidature.', 'error');
        }
      };
      fetchApplicationStatus();
    } else {
      setHasApplied(false);
      setApplicationStatus(null);
    }
  }, [isOpen, event, user?.role, session?.access_token, showToast]);

  if (!isOpen || !event) return null;

  const handleCopyCode = async () => {
    if (event.organizationCode) {
      try {
        await navigator.clipboard.writeText(event.organizationCode.toString());
        showToast('Code de l\'événement copié !', 'success');
      } catch (err) {
        console.error('Failed to copy event code:', err);
        showToast('Échec de la copie du code.', 'error');
      }
    }
  };

  const isStaff = user?.role === 'staff';

  const handleApply = async () => {
    if (!session?.access_token || !event?.id) {
      showToast('Erreur d\'authentification ou événement manquant.', 'error');
      return;
    }

    setIsApplying(true);
    try {
      const res = await authAPI.applyEvent(event.id, session.access_token);
      const data = res;
      if (data.success) {
        showToast('Candidature envoyée avec succès !', 'success');
        setHasApplied(true);
        setApplicationStatus('en_attente'); // Assuming default status is 'en_attente'
      } else {
        showToast(data.error || 'Erreur lors de l\'envoi de la candidature.', 'error');
      }
    } catch (err) {
      console.error('Error applying to event:', err);
      showToast('Impossible de contacter le serveur.', 'error');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-surface-container-low rounded-xl shadow-xl w-full max-w-lg p-lg space-y-md">
        <div className="flex justify-between items-center">
          <h2 className="text-headline-sm font-bold text-on-surface">Détails de l'événement</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-sm">
          <p className="text-body-md text-on-surface-variant">
            <span className="font-semibold text-on-surface">Nom:</span> {event.name}
          </p>
          {event.category && (
            <p className="text-body-md text-on-surface-variant">
              <span className="font-semibold text-on-surface">Catégorie:</span> {event.category}
            </p>
          )}
          <p className="text-body-md text-on-surface-variant">
            <span className="font-semibold text-on-surface">Organisateur:</span> {event.organizer}
          </p>
          <p className="text-body-md text-on-surface-variant">
            <span className="font-semibold text-on-surface">Lieu:</span> {event.location} {/* Use event.location directly */}
          </p>
          <p className="text-body-md text-on-surface-variant">
            <span className="font-semibold text-on-surface">Dates:</span> {event.rawStartDate ? new Date(event.rawStartDate).toLocaleDateString('fr-FR') : ''} - {event.rawEndDate ? new Date(event.rawEndDate).toLocaleDateString('fr-FR') : ''}
          </p>
          <p className="text-body-md text-on-surface-variant">
            <span className="font-semibold text-on-surface">Description:</span> {event.description || 'Aucune description'}
          </p>

          {event.organizationCode && (
            <div className="flex items-center gap-sm bg-surface-container-high p-sm rounded-lg">
              <span className="font-semibold text-on-surface">Code de l'événement:</span>
              <span className="font-mono text-on-surface-variant flex-1">{event.organizationCode}</span>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-xs px-sm py-xs bg-primary text-on-primary rounded-md text-label-sm hover:bg-primary-container hover:text-on-primary-container transition-colors"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                Copier
              </button>
            </div>
          )}
        </div>
        
        {isStaff && (
          <div className="mt-md pt-md border-t border-outline-variant space-y-sm">
            <h3 className="text-title-md font-semibold text-on-surface">Postuler à cet événement</h3>
            {hasApplied ? (
              <p className="text-body-md text-on-surface-variant">
                Vous avez déjà postulé à cet événement. Statut: <span className="font-semibold">{applicationStatus}</span>
              </p>
            ) : (
              <button
                onClick={handleApply}
                disabled={isApplying}
                className="w-full mt-sm bg-primary text-on-primary px-lg py-md rounded-xl font-bold hover:bg-primary-container hover:text-on-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApplying ? 'Envoi...' : 'Postuler'}
              </button>
            )}
          </div>
        )}

        <div className="flex justify-end gap-md">
          <button
            onClick={onClose}
            className="px-lg py-md rounded-xl text-on-surface-text-button hover:bg-surface-hover transition-colors"
          >
            Fermer
          </button>
          {/* Add other actions if needed, e.g., Edit Event */}
        </div>
      </div>
    </div>
  );
}