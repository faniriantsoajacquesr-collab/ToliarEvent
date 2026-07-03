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
      ? 'flex items-center gap-xs text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-100 uppercase tracking-tighter'
      : 'flex items-center gap-xs text-xs font-medium text-on-surface-variant bg-surface-container px-2 py-1 rounded-full border border-outline-variant/30 uppercase tracking-tighter';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Utilisé':
        return 'text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full uppercase tracking-tighter';
      case 'Payé':
        return 'text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-tighter';
      case 'Valide':
        return 'text-xs font-bold text-outline bg-surface-container px-3 py-1 rounded-full uppercase tracking-tighter opacity-70';
      default:
        return '';
    }
  };

  const getInitialsBgColor = (initials: string) => {
    if (initials === 'RH') return 'bg-primary-fixed text-primary';
    if (initials === 'AM') return 'bg-secondary-fixed text-secondary';
    if (initials === 'ST') return 'bg-tertiary-fixed text-tertiary';
    return 'bg-primary-fixed text-primary';
  };

  return (
    <div className="bg-white rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden">
      <div className="overflow-auto max-h-[500px] custom-scrollbar">
        <table className="w-full min-w-max text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant/30">
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
              <th className="px-xl py-md font-label-md text-label-md text-on-surface-variant">
                Ticket ID
              </th>
              <th className="px-xl py-md font-label-md text-label-md text-on-surface-variant">
                Type
              </th>
              <th className="px-xl py-md font-label-md text-label-md text-on-surface-variant">
                Détenteur
              </th>
              <th className="px-xl py-md font-label-md text-label-md text-on-surface-variant">
                Statut
              </th>
              <th className="px-xl py-md font-label-md text-label-md text-on-surface-variant">
                Vendeur
              </th>
              <th className="px-xl py-md font-label-md text-label-md text-on-surface-variant">
                Scanneur
              </th>
              <th className="px-xl py-md"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={selectionEnabled ? 8 : 7} className="px-xl py-8 text-center text-sm text-on-surface-variant">
                  Aucun billet trouvé.
                </td>
              </tr>
            ) : (
              tickets.map((ticket, idx) => (
                <tr
                  key={ticket.id}
                  className={`hover:bg-surface-container-lowest transition-colors group ${
                    selectionEnabled && selectedIds!.has(ticket.id)
                      ? 'bg-primary/5'
                      : idx % 2 === 1
                        ? 'bg-surface-container-lowest/30'
                        : ''
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
                  <td className="px-xl py-md font-mono-sm text-sm text-primary font-medium">
                    {ticket.displayId}
                  </td>
                  <td className="px-xl py-md">
                    <span className={getTypeColor(ticket.type)}>
                      {ticket.type.toUpperCase().includes('VIP') && (
                        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          stars
                        </span>
                      )}
                      {ticket.type}
                    </span>
                  </td>
                  <td className="px-xl py-md">
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
                      <span className="text-sm font-medium">{ticket.holder.name}</span>
                    </div>
                  </td>
                  <td className="px-xl py-md">
                    <span className={getStatusColor(ticket.status)}>
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-xl py-md text-xs text-on-surface-variant">
                    {ticket.sellerName || 'N/A'}
                  </td>
                  <td className="px-xl py-md text-xs text-on-surface-variant">
                    {ticket.scannerName || 'N/A'}
                  </td>
                  <td className="px-xl py-md text-right relative">
                    <button
                      className="material-symbols-outlined text-outline opacity-0 group-hover:opacity-100 transition-opacity hover:text-on-surface-variant"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(openDropdownId === ticket.id ? null : ticket.id);
                      }}
                    >
                      more_vert
                    </button>
                    {openDropdownId === ticket.id && (
                      <div
                        ref={dropdownRef}
                        className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200"
                      >
                        <button
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={(e) => { e.stopPropagation(); onEditTicket(ticket.id); setOpenDropdownId(null); }}
                        >Modifier</button>
                        <button
                          className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                          onClick={(e) => { e.stopPropagation(); onDeleteTicket(ticket.id); setOpenDropdownId(null); }}
                        >Supprimer</button>
                        <button
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
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

      <div className="px-xl py-md bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-between gap-3">
        <p className="text-xs text-on-surface-variant">
          {tickets.length === 0
            ? 'Aucun billet affiché'
            : `${tickets.length.toLocaleString()} billet${tickets.length > 1 ? 's' : ''} affiché${tickets.length > 1 ? 's' : ''}`}
          {selectionEnabled && selectedIds!.size > 0 && ` · ${selectedIds!.size} sélectionné${selectedIds!.size > 1 ? 's' : ''}`}
        </p>
        {isRefreshing && (
          <span
            className="inline-flex items-center gap-1 text-xs text-on-surface-variant"
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
