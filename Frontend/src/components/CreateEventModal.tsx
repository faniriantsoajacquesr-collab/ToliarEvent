import { useState } from 'react';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EventFormData) => void;
}

export interface EventFormData {
  name: string;
  organizer: string;
  location: string;
  startDateTime: string;
  endDateTime: string;
  description: string;
}

export default function CreateEventModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateEventModalProps) {
  const [formData, setFormData] = useState<EventFormData>({
    name: '',
    organizer: '',
    location: '',
    startDateTime: '',
    endDateTime: '',
    description: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      name: '',
      organizer: '',
      location: '',
      startDateTime: '',
      endDateTime: '',
      description: '',
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-on-background/40 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest w-full max-w-xl rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-lg py-md bg-surface-container flex justify-between items-center border-b border-outline-variant">
          <h4 className="text-headline-md font-bold text-primary">
            Créer un Nouvel Événement
          </h4>
          <button
            className="p-2 hover:bg-surface-variant rounded-full transition-colors"
            onClick={onClose}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-lg space-y-md">
          <div className="grid grid-cols-2 gap-md">
            <div className="col-span-2">
              <label className="block text-label-md font-medium text-on-surface-variant mb-xs">
                Nom de l'Événement
              </label>
              <input
                className="w-full px-md py-sm border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                placeholder="ex: Concert National Toliara"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-span-1">
              <label className="block text-label-md font-medium text-on-surface-variant mb-xs">
                Organisateur
              </label>
              <input
                className="w-full px-md py-sm border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                placeholder="Nom de l'entité"
                type="text"
                name="organizer"
                value={formData.organizer}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-span-1">
              <label className="block text-label-md font-medium text-on-surface-variant mb-xs">
                Lieu
              </label>
              <input
                className="w-full px-md py-sm border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                placeholder="ex: Jardin de la Mer"
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-span-1">
              <label className="block text-label-md font-medium text-on-surface-variant mb-xs">
                Date & Heure de Début
              </label>
              <input
                className="w-full px-md py-sm border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                type="datetime-local"
                name="startDateTime"
                value={formData.startDateTime}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-span-1">
              <label className="block text-label-md font-medium text-on-surface-variant mb-xs">
                Date & Heure de Fin
              </label>
              <input
                className="w-full px-md py-sm border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                type="datetime-local"
                name="endDateTime"
                value={formData.endDateTime}
                onChange={handleChange}
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-label-md font-medium text-on-surface-variant mb-xs">
                Description Logistique
              </label>
              <textarea
                  className="w-full px-md py-sm border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none resize-none"
                  required
                placeholder="Détails du projet..."
                rows={3}
                name="description"
                value={formData.description}
                onChange={handleChange}
              ></textarea>
            </div>
          </div>

          <div className="flex justify-end gap-md pt-md">
            <button
              type="button"
              className="px-lg py-sm text-on-surface-variant font-bold hover:bg-surface-variant rounded-lg transition-colors"
              onClick={onClose}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-lg py-sm bg-primary text-on-primary font-bold rounded-lg shadow-md hover:opacity-90 transition-opacity"
            >
              Créer l'événement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
