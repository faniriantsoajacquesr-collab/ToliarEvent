import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';
import AppPageHeader from '../components/AppPageHeader';
import PublicationPanel, { type PublicationData } from '../components/PublicationPanel';
import { PublicationPanelSkeleton } from '../components/skeleton';

export default function PublicationDashboard({ selectedEventId }: { selectedEventId?: string | null }) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [publications, setPublications] = useState<PublicationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!session?.access_token) return;

      setLoading(true);
      setError('');

      try {
        const orgRes = await authAPI.getMyOrganization(session.access_token);
        if (!orgRes.success || !orgRes.organization) {
          setError('Impossible de récupérer l’organisation.');
          return;
        }

        const res = await authAPI.getEventLandingPages(orgRes.organization.id, session.access_token);
        if (!res.success) {
          setError('Impossible de charger la publication.');
          return;
        }

        setPublications(res.publications || []);
      } catch (err) {
        console.error('PublicationDashboard load error', err);
        setError('Une erreur est survenue lors du chargement.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [session]);

  const activePublication = useMemo(
    () => publications.find((p) => p.eventId === selectedEventId) ?? null,
    [publications, selectedEventId]
  );

  const handleTogglePublish = async (eventId: string, currentValue: boolean) => {
    if (!session?.access_token) return;

    setIsToggling(true);
    setError('');

    try {
      const response = await authAPI.setEventLandingPagePublished(
        eventId,
        !currentValue,
        session.access_token
      );
      if (!response.success) {
        setError('Impossible de modifier la visibilité de la page.');
        return;
      }

      setPublications((prev) =>
        prev.map((publication) =>
          publication.eventId === eventId
            ? { ...publication, isPublished: !currentValue, updatedAt: new Date().toISOString() }
            : publication
        )
      );
    } catch (err) {
      console.error('PublicationDashboard publish error', err);
      setError('Une erreur est survenue lors de la modification.');
    } finally {
      setIsToggling(false);
    }
  };

  if (loading) {
    return <PublicationPanelSkeleton />;
  }

  return (
    <main className="dash-page flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-screen">
      <div className="relative z-10 max-w-5xl mx-auto px-gutter pb-12 pt-24 md:pt-28">
        <AppPageHeader
          title="Publication"
          subtitle="Gérez la landing page publique de l'événement sélectionné."
        />

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-error/30 bg-error-container/40 text-sm text-on-error-container">
            {error}
          </div>
        )}

        {!selectedEventId ? (
          <div className="dash-empty-state">
            <span className="material-symbols-outlined text-5xl text-primary mb-4 block" aria-hidden="true">
              event
            </span>
            <h2 className="font-landing-display text-2xl app-heading mb-2">Sélectionnez un événement</h2>
            <p className="app-text-muted text-sm max-w-sm mx-auto">
              Choisissez un événement dans le menu en haut à gauche pour gérer sa page de publication.
            </p>
          </div>
        ) : !activePublication ? (
          <div className="dash-empty-state">
            <span className="material-symbols-outlined text-5xl text-primary mb-4 block" aria-hidden="true">
              web
            </span>
            <h2 className="font-landing-display text-2xl app-heading mb-2">Page non configurée</h2>
            <p className="app-text-muted text-sm mb-6 max-w-sm mx-auto">
              La landing page de cet événement n&apos;a pas encore été créée. Ouvrez l&apos;éditeur pour la configurer.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/publication-builder/${selectedEventId}`)}
              className="landing-btn-primary !px-6 !py-3 !text-sm !rounded-xl"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">edit_document</span>
              Configurer la page
            </button>
          </div>
        ) : (
          <PublicationPanel
            publication={activePublication}
            isToggling={isToggling}
            onTogglePublish={handleTogglePublish}
            onEdit={(eventId) => navigate(`/publication-builder/${eventId}`)}
            onPreview={(eventId) => window.open(`/evenements/${eventId}`, '_blank', 'noopener,noreferrer')}
          />
        )}
      </div>
    </main>
  );
}
