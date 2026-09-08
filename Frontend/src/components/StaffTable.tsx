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

function getStatusClass(status: string): string {
  const normalized = String(status).toLowerCase();
  if (normalized === 'valide' || normalized === 'accepted') {
    return 'dash-status-badge bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20';
  }
  if (normalized === 'en_attente' || normalized === 'pending') {
    return 'dash-status-badge bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20';
  }
  if (normalized === 'refuse' || normalized === 'rejected') {
    return 'dash-status-badge bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20';
  }
  return 'dash-status-badge bg-[var(--md-surface-muted)] app-text-muted border border-[var(--md-border)]';
}

function formatStatusLabel(status: string): string {
  return String(status ?? '').replace(/_/g, ' ') || '—';
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

  return (
    <div className="app-card rounded-2xl overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-max text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--md-border)] bg-[var(--md-surface-muted)]">
              {selectionEnabled && (
                <th className="px-4 py-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-[var(--md-border)] text-primary focus:ring-primary/30 cursor-pointer accent-[var(--landing-primary)]"
                    aria-label="Tout sélectionner"
                  />
                </th>
              )}
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">Nom complet</th>
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">Poste recruté</th>
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">Téléphone</th>
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">Statut</th>
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--md-border)]">
            {staffData.length === 0 ? (
              <tr>
                <td colSpan={selectionEnabled ? 6 : 5} className="px-5 py-14 text-center">
                  <div className="dash-empty-state !p-8 !max-w-sm mx-auto">
                    <span className="material-symbols-outlined text-3xl app-text-muted mb-2">group_off</span>
                    <p className="text-sm app-text-muted">Aucun profil trouvé pour ce filtre.</p>
                  </div>
                </td>
              </tr>
            ) : (
              staffData.map((staff) => (
                <tr
                  key={staff.id}
                  className={`hover:bg-[var(--md-surface-muted)]/60 transition-colors cursor-pointer ${
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
                        className="h-4 w-4 rounded border-[var(--md-border)] text-primary focus:ring-primary/30 cursor-pointer accent-[var(--landing-primary)]"
                        aria-label={`Sélectionner ${staff.profile?.first_name || 'membre'}`}
                      />
                    </td>
                  )}
                  <td className="px-5 py-4 whitespace-nowrap font-semibold app-heading">
                    {staff.profile
                      ? `${staff.profile.first_name || ''} ${staff.profile.last_name || ''}`.trim() || 'Sans nom'
                      : 'Compte sans profil'}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="dash-status-badge bg-primary/10 text-primary border border-primary/20">
                      {staff.post}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap app-text-muted">
                    {staff.profile?.phone || '—'}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className={getStatusClass(staff.status || '')}>
                      {formatStatusLabel(staff.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="dash-action-group w-fit ml-auto">
                      {onValidateStaff && staff.status !== 'valide' && (
                        <button
                          type="button"
                          title="Valider"
                          className="dash-action-btn dash-action-btn--primary"
                          aria-label="Valider"
                          onClick={() => onValidateStaff(staff.id)}
                        >
                          <span className="material-symbols-outlined text-lg">check_circle</span>
                        </button>
                      )}
                      {onRejectStaff && staff.status !== 'refuse' && (
                        <button
                          type="button"
                          title="Refuser"
                          className="dash-action-btn text-amber-600 hover:bg-amber-500/10"
                          aria-label="Refuser"
                          onClick={() => onRejectStaff(staff.id)}
                        >
                          <span className="material-symbols-outlined text-lg">cancel</span>
                        </button>
                      )}
                      {onDeleteStaff && (
                        <button
                          type="button"
                          title="Supprimer"
                          className="dash-action-btn dash-action-btn--danger"
                          aria-label="Supprimer"
                          onClick={() => onDeleteStaff(staff.id)}
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
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
      <div className="px-5 py-3 border-t border-[var(--md-border)] bg-[var(--md-surface-muted)] text-xs app-text-muted flex flex-wrap items-center justify-between gap-2">
        <span>
          {staffData.length === 0
            ? 'Aucun profil affiché'
            : `${staffData.length} profil${staffData.length > 1 ? 's' : ''} affiché${staffData.length > 1 ? 's' : ''}`}
        </span>
        {selectionEnabled && selectedIds!.size > 0 && (
          <span className="font-medium text-primary">
            {selectedIds!.size} sélectionné{selectedIds!.size > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
