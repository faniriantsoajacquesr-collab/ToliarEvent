import { useState, useRef, useEffect } from 'react';

export interface Ticket {
  id: string;
  displayId: string;
  type: string;
  holder: {
    initials: string;
    name: string;
    avatar?: string;
  };
  status: 'Utilisé' | 'Payé' | 'Valide';
  sellerName?: string;
  scannerName?: string;
}

interface TicketTableProps {
  tickets: Ticket[];
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  isRefreshing?: boolean;
  onEditTicket: (ticketId: string) => void;
  onDeleteTicket: (ticketId: string) => void;
  onShowQrCode: (ticketId: string) => void;
}

export default function TicketTable({
  tickets,
  selectedIds,
  onSelectionChange,
  isRefreshing = false,
  onEditTicket,
  onDeleteTicket,
  onShowQrCode,
}: TicketTableProps) {
  const selectionEnabled = Boolean(selectedIds && onSelectionChange);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allSelected = selectionEnabled && tickets.length > 0 && tickets.every((t) => selectedIds!.has(t.id));
  const someSelected = selectionEnabled && tickets.some((t) => selectedIds!.has(t.id));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef]);

  const toggleSelectAll = () => {
    if (!selectionEnabled) return;
    if (allSelected) {
      const next = new Set(selectedIds);
      tickets.forEach((t) => next.delete(t.id));
      onSelectionChange!(next);
    } else {
      const next = new Set(selectedIds);
      tickets.forEach((t) => next.add(t.id));
      onSelectionChange!(next);
    }
  };

  const toggleSelectOne = (ticketId: string) => {
    if (!selectionEnabled) return;
    const next = new Set(selectedIds);
    if (next.has(ticketId)) {
      next.delete(ticketId);
    } else {
      next.add(ticketId);
    }
    onSelectionChange!(next);
  };

  const getTypeColor = (type: string) => {
    const isVip = type.toUpperCase().includes('VIP');
    return isVip
      ? 'dash-status-badge bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25'
      : 'dash-status-badge bg-[var(--md-surface-muted)] app-text-muted border border-[var(--md-border)]';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Utilisé':
        return 'dash-status-badge bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
      case 'Payé':
        return 'dash-status-badge bg-blue-500/15 text-blue-700 dark:text-blue-400';
      case 'Valide':
        return 'dash-status-badge bg-[var(--md-surface-muted)] app-text-muted';
      default:
        return 'dash-status-badge';
    }
  };

  const getInitialsBgColor = (initials: string) => {
    if (initials === 'RH') return 'bg-primary-fixed text-primary';
    if (initials === 'AM') return 'bg-secondary-fixed text-secondary';
    if (initials === 'ST') return 'bg-tertiary-fixed text-tertiary';
    return 'bg-primary-fixed text-primary';
  };

  return (
    <div className="app-card rounded-2xl overflow-hidden">
      <div className="overflow-auto max-h-[520px] custom-scrollbar">
        <table className="w-full min-w-max text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--md-border)] bg-[var(--md-surface-muted)]">
              {selectionEnabled && (
                <th className="px-md py-md w-10">
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
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">N°</th>
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">Type</th>
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">Détenteur</th>
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">Statut</th>
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">Vendeur</th>
              <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">Scanneur</th>
              <th className="px-xl py-md"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--md-border)]">
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={selectionEnabled ? 8 : 7} className="px-5 py-12 text-center text-sm app-text-muted">
                  Aucun billet trouvé.
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className={`hover:bg-[var(--md-surface-muted)]/60 transition-colors group ${
                    selectionEnabled && selectedIds!.has(ticket.id) ? 'bg-primary/5' : ''
                  }`}
                >
                  {selectionEnabled && (
                    <td className="px-md py-md">
                      <input
                        type="checkbox"
                        checked={selectedIds!.has(ticket.id)}
                        onChange={() => toggleSelectOne(ticket.id)}
                        className="h-4 w-4 rounded border-outline-variant/50 text-primary focus:ring-primary/30 cursor-pointer"
                        aria-label={`Sélectionner ${ticket.displayId}`}
                      />
                    </td>
                  )}
                  <td className="px-5 py-3.5 font-mono text-sm text-primary font-semibold">
                    {ticket.displayId}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 ${getTypeColor(ticket.type)}`}>
                      {ticket.type.toUpperCase().includes('VIP') && (
                        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          stars
                        </span>
                      )}
                      {ticket.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-sm">
                      {ticket.holder.avatar ? (
                        <img
                          alt={ticket.holder.name}
                          className="w-8 h-8 rounded-full object-cover"
                          src={ticket.holder.avatar}
                        />
                      ) : (
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getInitialsBgColor(
                            ticket.holder.initials
                          )}`}
                        >
                          {ticket.holder.initials}
                        </div>
                      )}
                      <span className="text-sm font-medium app-heading">{ticket.holder.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={getStatusColor(ticket.status)}>
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs app-text-muted">
                    {ticket.sellerName || 'N/A'}
                  </td>
                  <td className="px-5 py-3.5 text-xs app-text-muted">
                    {ticket.scannerName || 'N/A'}
                  </td>
                  <td className="px-5 py-3.5 text-right relative">
                    <button
                      type="button"
                      className="dash-action-btn rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(openDropdownId === ticket.id ? null : ticket.id);
                      }}
                    >
                      <span className="material-symbols-outlined">more_vert</span>
                    </button>
                    {openDropdownId === ticket.id && (
                      <div
                        ref={dropdownRef}
                        className="app-card absolute right-0 mt-2 w-48 rounded-xl shadow-lg z-10 py-1 overflow-hidden"
                      >
                        <button
                          className="block w-full text-left px-4 py-2.5 text-sm app-heading hover:bg-[var(--md-surface-muted)] transition"
                          onClick={(e) => { e.stopPropagation(); onEditTicket(ticket.id); setOpenDropdownId(null); }}
                        >Modifier</button>
                        <button
                          className="block w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 transition"
                          onClick={(e) => { e.stopPropagation(); onDeleteTicket(ticket.id); setOpenDropdownId(null); }}
                        >Supprimer</button>
                        <button
                          className="block w-full text-left px-4 py-2.5 text-sm app-heading hover:bg-[var(--md-surface-muted)] transition"
                          onClick={(e) => { e.stopPropagation(); onShowQrCode(ticket.id); setOpenDropdownId(null); }}
                        >Afficher QR Code</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3.5 border-t border-[var(--md-border)] bg-[var(--md-surface-muted)]/50 flex items-center justify-between gap-3">
        <p className="text-xs app-text-muted">
          {tickets.length === 0
            ? 'Aucun billet affiché'
            : `${tickets.length.toLocaleString()} billet${tickets.length > 1 ? 's' : ''} affiché${tickets.length > 1 ? 's' : ''}`}
          {selectionEnabled && selectedIds!.size > 0 && ` · ${selectedIds!.size} sélectionné${selectedIds!.size > 1 ? 's' : ''}`}
        </p>
        {isRefreshing && (
          <span
            className="inline-flex items-center gap-1 text-xs app-text-muted"
            aria-live="polite"
            aria-label="Mise à jour en cours"
          >
            <span className="material-symbols-outlined text-sm animate-spin text-primary">progress_activity</span>
            Mise à jour...
          </span>
        )}
      </div>
    </div>
  );
}
