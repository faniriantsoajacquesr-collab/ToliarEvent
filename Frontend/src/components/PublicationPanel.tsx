const DEFAULT_COVER =
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80';

export interface PublicationData {
  eventId: string;
  eventTitle: string;
  heroTitle: string;
  heroImage: string;
  isPublished: boolean;
  updatedAt?: string | null;
}

interface PublicationPanelProps {
  publication: PublicationData;
  isToggling?: boolean;
  onTogglePublish: (eventId: string, currentValue: boolean) => void;
  onEdit: (eventId: string) => void;
  onPreview: (eventId: string) => void;
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Aujourd'hui à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PublicationPanel({
  publication,
  isToggling,
  onTogglePublish,
  onEdit,
  onPreview,
}: PublicationPanelProps) {
  const cover = publication.heroImage || DEFAULT_COVER;
  const updatedLabel = formatUpdatedAt(publication.updatedAt);
  const isOnline = publication.isPublished;

  return (
    <div className="app-card rounded-2xl overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
        {/* Preview */}
        <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[420px] overflow-hidden bg-[var(--md-surface-subtle)]">
          <img
            src={cover}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          <span
            className={`absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
              isOnline
                ? 'bg-emerald-500 text-white shadow-lg'
                : 'bg-black/60 backdrop-blur-md text-white/90 border border-white/15'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-white/60'}`} />
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </span>

          <div className="absolute bottom-0 inset-x-0 p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">
              {publication.eventTitle}
            </p>
            <h2 className="font-landing-display text-2xl md:text-3xl text-white leading-tight max-w-xl">
              {publication.heroTitle || publication.eventTitle}
            </h2>
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 md:p-8 flex flex-col gap-6 border-t lg:border-t-0 lg:border-l border-[var(--md-border)]">
          <div>
            <p className="landing-eyebrow mb-3">Landing page publique</p>
            <p className="app-text-muted text-sm leading-relaxed">
              Cette page est unique par événement. Publiez-la pour la rendre visible sur{' '}
              <span className="font-medium app-heading">/evenements</span>, ou masquez-la temporairement.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--md-border)] bg-[var(--md-surface-muted)] p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs app-text-muted mb-0.5">Visibilité</p>
              <p className="text-sm font-semibold app-heading">
                {isOnline ? 'Page visible au public' : 'Page masquée'}
              </p>
            </div>
            <button
              type="button"
              disabled={isToggling}
              onClick={() => onTogglePublish(publication.eventId, publication.isPublished)}
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-60 ${
                isOnline ? 'bg-emerald-500' : 'bg-[var(--md-border-strong)]'
              }`}
              aria-label={isOnline ? 'Masquer la page' : 'Publier la page'}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                  isOnline ? 'translate-x-7' : 'translate-x-1'
                } ${isToggling ? 'scale-90' : ''}`}
              />
            </button>
          </div>

          {updatedLabel && (
            <div className="dash-meta-row">
              <span className="material-symbols-outlined text-primary text-sm shrink-0" aria-hidden="true">
                schedule
              </span>
              <span>Dernière modification · {updatedLabel}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mt-auto pt-2">
            <button
              type="button"
              onClick={() => onEdit(publication.eventId)}
              className="flex-1 landing-btn-primary !px-5 !py-3 !text-sm !rounded-xl justify-center"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">edit_document</span>
              Modifier la page
            </button>
            <button
              type="button"
              onClick={() => onPreview(publication.eventId)}
              className="flex-1 landing-btn-secondary !px-5 !py-3 !text-sm !rounded-xl justify-center"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">open_in_new</span>
              Voir la page publique
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
