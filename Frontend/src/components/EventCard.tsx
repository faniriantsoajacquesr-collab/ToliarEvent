interface EventCardProps {
  date: string;
  month: string;
  category: string;
  categoryColor: string;
  title: string;
  location: string;
  price: string;
  image: string;
  icon: string;
  onViewDetails?: () => void;
}

export default function EventCard({
  date,
  month,
  category,
  categoryColor,
  title,
  location,
  price,
  image,
  icon,
  onViewDetails,
}: EventCardProps) {
  return (
    <div
      className="group bg-white rounded-xl overflow-hidden border border-outline-variant/50 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer"
      onClick={onViewDetails}
    >
      <div className="relative h-48">
        <img
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          src={image}
          alt={title}
        />
        <div className="absolute top-md left-md bg-white/90 backdrop-blur px-sm py-xs rounded-lg font-bold text-center">
          <span className="block text-primary text-xs uppercase">{month}</span>
          <span className="text-xl text-on-background">{date}</span>
        </div>
      </div>
      <div className="p-lg flex flex-col h-full">
        <div
          className={`flex items-center gap-xs ${categoryColor} font-label-md text-label-md mb-xs`}
        >
          <span className="material-symbols-outlined text-[16px]">{icon}</span>
          {category}
        </div>
        <h3 className="font-headline-md text-headline-md mb-md">{title}</h3>
        <div className="flex items-center justify-between text-on-surface-variant text-sm border-t border-outline-variant/30 pt-md">
          <div className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-[18px]">
              location_on
            </span>
            {location}
          </div>
          <div className="bg-surface-container px-sm py-xs rounded text-on-surface font-bold">
            {price}
          </div>
        </div>
        <div className="mt-auto pt-md">
          <button
            type="button"
            className="w-full bg-primary text-on-primary px-4 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails?.();
            }}
          >
            Voir les détails
          </button>
        </div>
      </div>
    </div>
  );
}
