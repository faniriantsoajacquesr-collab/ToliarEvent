import { Check, X, Trash2 } from 'lucide-react';

export interface StaffRow {
  id: number; // event_staff.id
  status: string; // 'en_attente', 'valide', 'refuse', etc.
  created_at?: string;
  post: string; // Nom du poste récupéré du backend (ex: "Scanneur")
  profile: {
    id: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  } | null;
}

interface StaffTableProps {
  staffData: any[];
  onRowClick: (staff: any) => void;
  onDeleteStaff?: (memberId: number) => void;
  onValidateStaff?: (memberId: number) => void;
  onRejectStaff?: (memberId: number) => void;
}

export default function StaffTable({ staffData, onRowClick, onDeleteStaff, onValidateStaff, onRejectStaff }: StaffTableProps) {

  // Style dynamique selon le statut de postulation dans event_staff
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valide':
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'en_attente':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'refuse':
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="w-full bg-surface rounded-2xl border border-outline-variant overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low text-label-md font-bold text-on-surface-variant uppercase tracking-wider">
              <th className="px-6 py-4">Nom complet</th>
              <th className="px-6 py-4">Poste Recruté</th>
              <th className="px-6 py-4">Téléphone</th>
              <th className="px-6 py-4">Statut</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {staffData.map((staff) => {
              return (
                <tr 
                  key={staff.id} 
                  className="hover:bg-surface-container-low transition-colors cursor-pointer"
                  onClick={() => onRowClick(staff)}
                >
                  {/* Nom complet avec sécurité Optional Chaining */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-on-surface">
                    {staff.profile 
                      ? `${staff.profile.first_name || ''} ${staff.profile.last_name || ''}`.trim() || 'Sans Nom'
                      : 'Compte sans profil'
                    }
                  </td>

                  {/* Cellule du Poste (anciennement Rôle) */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                      {staff.post}
                    </span>
                  </td>

                  {/* Téléphone */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant">
                    {staff.profile?.phone || '—'}
                  </td>

                  {/* Statut de la postulation dans event_staff */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(staff.status || '')}`}>
                      {(String(staff.status ?? '').replace(/_/g, ' ') || '—')}
                    </span>
                  </td>

                  {/* Actions avec icônes explicites */}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-2">
                      {onValidateStaff && staff.status !== 'valide' && (
                        <button
                          className="text-green-600 hover:text-green-800 p-2 rounded-full hover:bg-green-100 transition-colors"
                          aria-label="Valider"
                          onClick={() => onValidateStaff(staff.id)}
                        >
                          <Check size={18} />
                        </button>
                      )}

                      {onRejectStaff && staff.status !== 'refuse' && (
                        <button
                          className="text-orange-600 hover:text-orange-800 p-2 rounded-full hover:bg-orange-100 transition-colors"
                          aria-label="Refuser"
                          onClick={() => onRejectStaff(staff.id)}
                        >
                          <X size={18} />
                        </button>
                      )}

                      {onDeleteStaff && (
                        <button
                          className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-100 transition-colors"
                          aria-label="Supprimer"
                          onClick={() => onDeleteStaff(staff.id)}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}