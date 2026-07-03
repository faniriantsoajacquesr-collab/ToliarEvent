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
  isActive: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

export default function EventCard({
  id,
  name,
  category,
  organizer,
  location,
  startDate,
  endDate,
  status,
  icon,
  isActive,
  onSelect,
  onEdit,
  onDelete,
  isDeleting,
}: EventCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'upcoming':
        return 'bg-primary-fixed text-on-primary-fixed-variant';
      case 'completed':
        return 'bg-surface-variant text-on-surface-variant';
      default:
        return '';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'active':
        return 'En cours';
      case 'upcoming':
        return 'À venir';
      case 'completed':
        return 'Terminé';
      default:
        return '';
    }
  };

  const getIconBgColor = () => {
    switch (icon) {
      case 'stars':
        return 'bg-primary/10 text-primary';
      case 'sports_esports':
      case 'festival':
        return 'bg-surface-container-high text-on-surface-variant';
      default:
        return 'bg-primary/10 text-primary';
    }
  };

  return (
    <div
      className={`group relative bg-surface-container-lowest rounded-xl p-lg shadow-sm transition-all hover:shadow-xl cursor-pointer ${
        isActive
          ? 'border-2 border-primary shadow-md'
          : 'border border-outline-variant hover:border-primary'
      }`}
      onClick={() => onSelect(id)}
    >
      {isActive && (
        <div className="absolute top-4 right-4 bg-primary-container text-on-primary-container text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
          ACTIF
        </div>
      )}

      <div className="flex flex-col h-full">
        <div className="flex items-center gap-md mb-md">
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center ${getIconBgColor()}`}
          >
            <span
              className="material-symbols-outlined"
              style={icon === 'stars' ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {icon}
            </span>
          </div>
          <div>
            <h4 className="text-headline-md font-bold text-on-surface">{name}</h4>
            {category ? (
              <p className="text-label-sm text-on-surface-variant mb-1">Catégorie: {category}</p>
            ) : null}
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
            <span className="material-symbols-outlined text-primary">
              calendar_today
            </span>
            {startDate} - {endDate}
          </div>
        </div>

        <div className="flex items-center justify-between mt-auto pt-md border-t border-outline-variant">
          <div
            className={`flex items-center gap-sm px-3 py-1 rounded-full text-xs font-bold ${getStatusColor()} ${
              status === 'active' ? 'animate-pulse' : ''
            }`}
          >
            {status === 'active' && (
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            )}
            {getStatusLabel()}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-xl bg-primary/10 text-primary font-bold text-label-md hover:bg-primary/20 transition-colors flex items-center gap-xs"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(id);
              }}
            >
              Modifier
              <span className="material-symbols-outlined text-[18px]">
                edit
              </span>
            </button>

            <button
              disabled={isDeleting}
              className={`px-3 py-2 rounded-xl font-bold text-label-md flex items-center gap-xs transition-colors ${isDeleting ? 'bg-error/10 text-error opacity-60 cursor-not-allowed' : 'bg-error/10 text-error hover:bg-error/20'}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!isDeleting) onDelete(id);
              }}
            >
              {isDeleting ? (
                <span className="material-symbols-outlined animate-spin text-[18px]">autorenew</span>
              ) : (
                <span className="material-symbols-outlined text-[18px]">delete</span>
              )}
              <span className="ml-1">Supprimer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
