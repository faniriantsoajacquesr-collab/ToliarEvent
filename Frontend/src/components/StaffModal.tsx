import { useState } from 'react';

interface StaffMember {
  id: number; // organization_members.id
  organization_id: string;
  profile_id: string;
  role: 'admin' | 'staff'; // organization_members.role
  is_validated: boolean; // organization_members.is_validated
  created_at: string;
  profile: {
    id: string; // profiles.id
    first_name: string;
    last_name: string;
    phone?: string;
  };
  profile_skills?: Array<{ skill_id: number; name: string }>;
}


interface StaffModalProps {
  isOpen: boolean;
  staff: StaffMember | null;
  onClose: () => void;
  onSave: (updatedStaff: StaffMember) => void;
}

export default function StaffModal({
  isOpen,
  staff,
  onClose,
  onSave,
}: StaffModalProps) {
  const [editedStaff, setEditedStaff] = useState<StaffMember>(staff!); // Assume staff is always provided when open
  const [isSaving, setIsSaving] = useState(false);
  const [competencies, setCompetencies] = useState<string[]>(staff?.profile_skills?.map(s => s.name) || []);

  if (!isOpen || !staff) return null;

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'bg-primary/10 text-primary';
      case 'staff':
        return 'bg-secondary-container/10 text-secondary';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getValidationStatusColor = (isValidated: boolean) => {
    if (isValidated) {
        return 'bg-green-100 text-green-700';
    } else {
        return 'bg-orange-100 text-orange-700';
    }
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setEditedStaff({
      ...editedStaff,
      role: e.target.value as 'admin' | 'staff',
    });
  };

  const handleValidate = () => {
    setEditedStaff({
      ...editedStaff,
      is_validated: true,
    });
  };

  const handleSuspend = () => {
    setEditedStaff({
      ...editedStaff,
      is_validated: false, // Assuming suspend means not validated
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsSaving(false);
    onSave(editedStaff);
    onClose();
  };

  const handleCompetencyChange = (competency: string) => {
    setCompetencies((prev) =>
      prev.includes(competency)
        ? prev.filter((c) => c !== competency)
        : [...prev, competency]
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] modal-overlay flex items-center justify-center p-md"
      onClick={onClose}
    >
      <div
        className="modal-content bg-surface-container-lowest w-full max-w-2xl rounded-xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-lg py-md border-b border-outline-variant/30 flex items-center justify-between bg-surface-bright">
          <h3 className="font-headline-md text-headline-md text-on-surface">
            Détails du Profil
          </h3>
          <button
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-high transition-colors"
            onClick={onClose}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-lg">
          {/* Photo/Identity */}
          <div className="flex flex-col md:flex-row gap-lg mb-lg">
            <div className="w-24 h-24 rounded-full bg-surface-container-highest flex-shrink-0 overflow-hidden border border-outline-variant">
              <img
                alt={`${editedStaff.profile.last_name} ${editedStaff.profile.first_name}`}
                className="w-full h-full object-cover"
                src={`https://api.dicebear.com/7.x/initials/svg?seed=${editedStaff.profile.id}`} // Placeholder avatar
              />
            </div>
            <div className="flex-1">
              <h4 className="font-headline-md text-headline-md text-on-surface mb-xs">
                {editedStaff.profile.last_name} {editedStaff.profile.first_name}
              </h4>
              <p className="text-on-surface-variant font-body-md text-body-md flex items-center gap-xs">
                <span className="material-symbols-outlined text-md">phone</span>{' '}
                {editedStaff.profile.phone || 'N/A'}
              </p>
              <div className="mt-md flex flex-wrap gap-sm">
                <span
                  className={`px-sm py-xs rounded font-label-md text-xs uppercase badge-transition ${getRoleColor(
                    editedStaff.role
                  )}`}
                >
                  {editedStaff.role}
                </span>
                <span
                  className={`px-sm py-xs rounded-full text-xs font-label-md badge-transition ${getValidationStatusColor(
                    editedStaff.is_validated
                  )}`}
                >
                  {editedStaff.is_validated ? 'Validé' : 'En attente'}
                </span>
              </div>
            </div>
          </div>

          {/* Form Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg mb-lg">
            <div>
              <label className="block font-label-md text-label-md mb-sm text-on-surface-variant">
                Modifier le Rôle
              </label>
              <select
                className="w-full p-sm bg-surface-bright border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary outline-none transition-all"
                value={editedStaff.role}
                onChange={handleRoleChange}
              >
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <div>
              <label className="block font-label-md text-label-md mb-sm text-on-surface-variant">
                Statut de validation
              </label>
              <div className="flex gap-sm">
                <button
                  className="flex-1 py-sm px-md rounded-lg bg-green-600 text-white font-label-md hover:bg-green-700 hover:shadow-md transition-all active:scale-95"
                  onClick={handleValidate}
                >
                  Valider
                </button>
                <button
                  className="flex-1 py-sm px-md rounded-lg bg-error text-white font-label-md hover:bg-red-700 hover:shadow-md transition-all active:scale-95"
                  onClick={handleSuspend}
                >
                  Suspendre
                </button>
              </div>
            </div>
          </div>

          {/* Competencies */}
          <div>
            <label className="block font-label-md text-label-md mb-sm text-on-surface-variant">
              Compétences
            </label>
            <div className="flex flex-wrap gap-sm">
              {['Sécurité', 'Comptabilité', 'Accueil'].map((comp) => (
                <label
                  key={comp}
                  className="inline-flex items-center px-md py-sm bg-surface-container rounded-full cursor-pointer hover:bg-surface-container-high transition-all active:scale-95"
                >
                  <input
                    type="checkbox"
                    className="hidden peer"
                    checked={competencies.includes(comp)}
                    onChange={() => handleCompetencyChange(comp)}
                  />
                  <span className="text-on-surface-variant peer-checked:text-primary peer-checked:font-bold font-body-md">
                    {comp}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-lg py-md border-t border-outline-variant/30 bg-surface-bright flex justify-end gap-md">
          <button
            className="px-lg py-sm rounded-lg text-on-surface-variant font-label-md hover:bg-surface-container-high transition-colors"
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            className="px-lg py-sm rounded-lg bg-primary text-on-primary font-label-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Sauvegarde...' : 'Enregistrer les modifications'}
          </button>
        </div>
      </div>
    </div>
  );
}
