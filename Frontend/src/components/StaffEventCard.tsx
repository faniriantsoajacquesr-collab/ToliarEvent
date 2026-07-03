
interface Props {
  appId: number;
  eventId: string;
  name: string;
  organizer?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  status: 'En attente' | 'Approuvé' | 'Refusé';
  onSelect?: (id: string) => void;
  onQuit?: (appId: number) => void;
  onRetry?: (appId: number) => void;
  isRetrying?: boolean;
}

export default function StaffEventCard({
  appId,
  eventId,
  name,
  organizer = '',
  location = '',
  startDate = '',
  endDate = '',
  status,
  onSelect,
  onQuit,
  onRetry,
  isRetrying = false,
}: Props) {
  return (
    <div
      className={`group relative bg-surface-container-lowest rounded-xl p-lg shadow-sm transition-all hover:shadow-xl cursor-pointer border border-outline-variant hover:border-primary`}
      onClick={() => onSelect?.(eventId)}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-md mb-md">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-primary/10 text-primary`}>
            <span className="material-symbols-outlined">event</span>
          </div>
          <div>
            <h4 className="text-headline-md font-bold text-on-surface">{name}</h4>
            <p className="text-label-md text-on-surface-variant flex items-center gap-xs">
              <span className="material-symbols-outlined text-[16px]">person</span>
              {organizer}
            </p>
          </div>
        </div>

        <div className="space-y-sm mb-lg flex-1">
          <div className="flex items-center gap-sm text-body-md text-on-surface-variant">
            <span className="material-symbols-outlined text-primary">map</span>
            {location}
          </div>
          <div className="flex items-center gap-sm text-body-md text-on-surface-variant">
            <span className="material-symbols-outlined text-primary">calendar_today</span>
            {startDate} {endDate ? ` - ${endDate}` : ''}
          </div>
        </div>

        <div className="flex items-center justify-between mt-auto pt-md border-t border-outline-variant">
          <div className={`flex items-center gap-sm px-3 py-1 rounded-full text-xs font-bold bg-surface-variant text-on-surface-variant`}>
            {status}
          </div>

          <div className="flex items-center gap-sm">
            {status === 'Refusé' && onRetry && (
              <button
                onClick={(e) => { e.stopPropagation(); onRetry(appId); }}
                disabled={isRetrying}
                className="text-primary font-bold text-label-md flex items-center gap-xs hover:underline disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                {isRetrying ? 'Envoi...' : 'Réessayer'}
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onQuit?.(appId); }}
              className="text-error font-bold text-label-md flex items-center gap-xs hover:underline"
            >
              <span className="material-symbols-outlined text-[18px]">exit_to_app</span>
              Quitter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
