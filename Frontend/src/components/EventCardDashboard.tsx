const CARD_GRADIENTS = [
  'from-blue-600 via-indigo-600 to-violet-700',
  'from-amber-500 via-orange-500 to-rose-600',
  'from-emerald-500 via-teal-600 to-cyan-700',
  'from-fuchsia-500 via-purple-600 to-indigo-700',
  'from-sky-500 via-blue-600 to-indigo-700',
] as const;

const DEFAULT_EVENT_IMAGE =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80';

interface EventCardProps {
  id: string;
  name: string;
  category?: string;
  organizer: string;
  location: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'upcoming' | 'completed';
  icon: string;
  imageUrl?: string;
  isActive: boolean;
  onActivate: (id: string) => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

function gradientForId(id: string) {
  const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % CARD_GRADIENTS.length;
  return CARD_GRADIENTS[index];
}

function parseDayMonth(dateStr: string) {
  if (!dateStr) return { day: '—', month: '—' };
  const parts = dateStr.split(' ');
  return {
    day: parts[0]?.replace(/\D/g, '') || '—',
    month: parts[1]?.slice(0, 3).toUpperCase() || '—',
  };
}

export default function EventCardDashboard({
  id,
  name,
  category,
  organizer,
  location,
  startDate,
  endDate,
  status,
  icon,
  imageUrl,
  isActive,
  onActivate,
  onView,
  onEdit,
  onDelete,
  isDeleting,
}: EventCardProps) {
  const { day, month } = parseDayMonth(startDate);
  const gradient = gradientForId(id);
  const cover = imageUrl || DEFAULT_EVENT_IMAGE;

  const statusConfig = {
    active: {
      label: 'En cours',
      className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
      dot: 'bg-emerald-500 animate-pulse',
    },
    upcoming: {
      label: 'À venir',
      className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25',
      dot: 'bg-blue-500',
    },
    completed: {
      label: 'Terminé',
      className: 'bg-[var(--md-surface-subtle)] app-text-muted border-[var(--md-border)]',
      dot: 'bg-[var(--md-text-muted)]',
    },
  }[status];

  return (
    <article
      className={`dash-event-card group ${isActive ? 'dash-event-card--active' : ''}`}
      onClick={() => onActivate(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate(id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      aria-label={`Événement ${name}${isActive ? ', contexte actif' : ''}`}
    >
      <div className="dash-event-card__media">
        <img
          src={cover}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />
        <div className={`absolute inset-0 bg-gradient-to-t ${gradient} opacity-30 mix-blend-multiply`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        <div className="absolute top-3 left-3 w-12 h-12 rounded-xl flex flex-col items-center justify-center shadow-lg backdrop-blur-md bg-white/95 dark:bg-black/60 border border-white/20">
          <span className="text-base font-black leading-none app-heading">{day}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider app-text-muted mt-0.5">{month}</span>
        </div>

        {category && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-black/50 backdrop-blur-md text-white border border-white/15">
            {category}
          </span>
        )}

        {isActive && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary text-white shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Contexte actif
          </span>
        )}

        <div className="absolute bottom-3 right-3 w-9 h-9 rounded-xl flex items-center justify-center bg-white/15 backdrop-blur-md border border-white/20 text-white">
          <span
            className="material-symbols-outlined text-lg"
            style={icon === 'stars' ? { fontVariationSettings: "'FILL' 1" } : {}}
          >
            {icon}
          </span>
        </div>
      </div>

      <div className="dash-event-card__body">
        <div>
          <h3 className="font-landing-display text-lg md:text-xl app-heading line-clamp-1 group-hover:text-primary transition-colors">
            {name}
          </h3>
          {organizer && (
            <p className="text-xs app-text-muted mt-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">groups</span>
              {organizer}
            </p>
          )}
        </div>

        <div className="space-y-2">
          {location && (
            <div className="dash-meta-row">
              <span className="material-symbols-outlined text-primary text-sm shrink-0" aria-hidden="true">
                location_on
              </span>
              <span className="truncate">{location}</span>
            </div>
          )}
          <div className="dash-meta-row">
            <span className="material-symbols-outlined text-primary text-sm shrink-0" aria-hidden="true">
              calendar_month
            </span>
            <span className="truncate">
              {startDate}{endDate ? ` — ${endDate}` : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1 mt-auto">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusConfig.className}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
            {statusConfig.label}
          </span>

          <div className="dash-action-group" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="dash-action-btn dash-action-btn--primary"
              title="Voir les détails"
              aria-label={`Voir les détails de ${name}`}
              onClick={() => onView(id)}
            >
              <span className="material-symbols-outlined text-[18px]">visibility</span>
            </button>
            <button
              type="button"
              className="dash-action-btn dash-action-btn--primary"
              title="Modifier"
              aria-label={`Modifier ${name}`}
              onClick={() => onEdit(id)}
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </button>
            <button
              type="button"
              disabled={isDeleting}
              className={`dash-action-btn dash-action-btn--danger ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Supprimer"
              aria-label={`Supprimer ${name}`}
              onClick={() => !isDeleting && onDelete(id)}
            >
              <span className={`material-symbols-outlined text-[18px] ${isDeleting ? 'animate-spin' : ''}`}>
                {isDeleting ? 'progress_activity' : 'delete'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
