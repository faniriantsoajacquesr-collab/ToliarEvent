import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';

interface PublicationSummary {
  eventId: string;
  eventTitle: string;
  heroTitle: string;
  heroImage: string;
  isPublished: boolean;
  updatedAt?: string | null;
}

export default function PublicationDashboard({ selectedEventId }: { selectedEventId?: string | null }) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [publications, setPublications] = useState<PublicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

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
          setError('Impossible de charger les publications.');
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

  const handleTogglePublish = async (eventId: string, currentValue: boolean) => {
    if (!session?.access_token) return;

    try {
      const response = await authAPI.setEventLandingPagePublished(eventId, !currentValue, session.access_token);
      if (!response.success) {
        setError('Impossible de modifier le statut de publication.');
        return;
      }

      setPublications((prev) => prev.map((publication) => (
        publication.eventId === eventId ? { ...publication, isPublished: !currentValue } : publication
      )));
    } catch (err) {
      console.error('PublicationDashboard publish error', err);
      setError('Une erreur est survenue lors de la modification du statut.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <div className="mb-8 flex flex-col gap-3">
        <div className="rounded-3xl border border-outline-variant bg-surface p-6 shadow-sm">
          <h1 className="text-headline-lg font-bold text-on-surface">Publication</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            Gérez les landing pages d’événements et éditez la version publiée de chaque événement.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-outline-variant bg-surface p-6 text-body-md text-on-surface-variant shadow-sm">
          Chargement des événements...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-300 bg-red-50 p-6 text-body-md text-red-700 shadow-sm">
          {error}
        </div>
      ) : publications.length === 0 ? (
        <div className="rounded-3xl border border-outline-variant bg-surface p-6 text-body-md text-on-surface-variant shadow-sm">
          <h3 className="text-lg font-semibold text-on-surface">Aucune publication pour l'instant</h3>
          <p className="mt-2 text-sm text-on-surface-variant">Aucune landing page n'a été créée pour l'instant. Vous pouvez en créer une depuis l'éditeur de publication.</p>
          <div className="mt-4">
            {selectedEventId ? (
              <button
                type="button"
                onClick={() => navigate(`/publication-builder/${selectedEventId}`)}
                className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-container"
              >
                Créer la page de publication
              </button>
            ) : (
              <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface-variant">
                Sélectionnez un événement dans la barre latérale pour créer une publication.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {publications.map((publication) => (
            <div key={publication.eventId} className="overflow-hidden rounded-3xl border border-outline-variant bg-surface shadow-sm">
              <div className="relative h-52 bg-surface-variant">
                {publication.heroImage ? (
                  <img
                    src={publication.heroImage}
                    alt={publication.heroTitle}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-surface-container-highest text-sm text-on-surface-variant">
                    Aucune image de couverture
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/40 px-4 py-3 text-white">
                  <h3 className="text-sm font-semibold line-clamp-1">{publication.heroTitle}</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-headline-sm font-semibold text-on-surface">{publication.eventTitle}</h2>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-on-surface-variant">
                      <span>{publication.isPublished ? 'Publié' : 'Brouillon'}</span>
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(publication.eventId, publication.isPublished)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors ${publication.isPublished ? 'bg-emerald-500' : 'bg-surface-container-highest'}`}
                        aria-label={publication.isPublished ? 'Dépublier la publication' : 'Publier la publication'}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${publication.isPublished ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </label>
                  </div>
                  {publication.updatedAt && (
                    <p className="text-xs text-on-surface-variant">Dernière mise à jour : {new Date(publication.updatedAt).toLocaleString('fr-FR')}</p>
                  )}
                </div>
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/publication-builder/${publication.eventId}`)}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-container"
                  >
                    Modifier la page
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
