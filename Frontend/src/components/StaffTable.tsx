import { Check, X, Trash2 } from 'lucide-react';

export interface StaffRow {
  id: number;
  status: string;
  created_at?: string;
  post: string;
  profile: {
    id: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  } | null;
}

interface StaffTableProps {
  staffData: any[];
  selectedIds?: Set<number>;
  onSelectionChange?: (ids: Set<number>) => void;
  onRowClick: (staff: any) => void;
  onDeleteStaff?: (memberId: number) => void;
  onValidateStaff?: (memberId: number) => void;
  onRejectStaff?: (memberId: number) => void;
}

export default function StaffTable({
  staffData,
  selectedIds,
  onSelectionChange,
  onRowClick,
  onDeleteStaff,
  onValidateStaff,
  onRejectStaff,
}: StaffTableProps) {
  const selectionEnabled = Boolean(selectedIds && onSelectionChange);
  const allSelected = selectionEnabled && staffData.length > 0 && staffData.every((s) => selectedIds!.has(s.id));
  const someSelected = selectionEnabled && staffData.some((s) => selectedIds!.has(s.id));

  const toggleSelectAll = () => {
    if (!selectionEnabled) return;
    if (allSelected) {
      const next = new Set(selectedIds);
      staffData.forEach((s) => next.delete(s.id));
      onSelectionChange!(next);
    } else {
      const next = new Set(selectedIds);
      staffData.forEach((s) => next.add(s.id));
      onSelectionChange!(next);
    }
  };

  const toggleSelectOne = (memberId: number) => {
    if (!selectionEnabled) return;
    const next = new Set(selectedIds);
    if (next.has(memberId)) next.delete(memberId);
    else next.add(memberId);
    onSelectionChange!(next);
  };

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
              {selectionEnabled && (
                <th className="px-4 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-outline-variant/50 text-primary focus:ring-primary/30 cursor-pointer"
                    aria-label="Tout sélectionner"
                  />
                </th>
              )}
              <th className="px-6 py-4">Nom complet</th>
              <th className="px-6 py-4">Poste Recruté</th>
              <th className="px-6 py-4">Téléphone</th>
              <th className="px-6 py-4">Statut</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {staffData.length === 0 ? (
              <tr>
                <td
                  colSpan={selectionEnabled ? 6 : 5}
                  className="px-6 py-10 text-center text-sm text-on-surface-variant"
                >
                  Aucun profil trouvé pour ce filtre.
                </td>
              </tr>
            ) : (
              staffData.map((staff) => (
                <tr
                  key={staff.id}
                  className={`hover:bg-surface-container-low transition-colors cursor-pointer ${
                    selectionEnabled && selectedIds!.has(staff.id) ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => onRowClick(staff)}
                >
                  {selectionEnabled && (
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds!.has(staff.id)}
                        onChange={() => toggleSelectOne(staff.id)}
                        className="h-4 w-4 rounded border-outline-variant/50 text-primary focus:ring-primary/30 cursor-pointer"
                        aria-label={`Sélectionner ${staff.profile?.first_name || 'membre'}`}
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-on-surface">
                    {staff.profile
                      ? `${staff.profile.first_name || ''} ${staff.profile.last_name || ''}`.trim() || 'Sans Nom'
                      : 'Compte sans profil'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                      {staff.post}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant">
                    {staff.profile?.phone || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(staff.status || '')}`}>
                      {String(staff.status ?? '').replace(/_/g, ' ') || '—'}
                    </span>
                  </td>
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
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-3 bg-surface-container-low border-t border-outline-variant text-xs text-on-surface-variant">
        {staffData.length === 0
          ? 'Aucun profil affiché'
          : `${staffData.length} profil${staffData.length > 1 ? 's' : ''} affiché${staffData.length > 1 ? 's' : ''}`}
        {selectionEnabled && selectedIds!.size > 0 && ` · ${selectedIds!.size} sélectionné${selectedIds!.size > 1 ? 's' : ''}`}
      </div>
    </div>
  );
}
