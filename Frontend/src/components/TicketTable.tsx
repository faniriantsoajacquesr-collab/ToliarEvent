import { useState, useRef, useEffect } from 'react';

export interface Ticket {
  id: string;
  displayId: string;
  type: 'Standard' | 'VIP';
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
  onEditTicket: (ticketId: string) => void;
  onDeleteTicket: (ticketId: string) => void;
  onShowQrCode: (ticketId: string) => void;
}

export default function TicketTable({ tickets, onEditTicket, onDeleteTicket, onShowQrCode }: TicketTableProps) {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const getTypeColor = (type: string) => {
    // Ensure type is 'VIP' or 'Standard' for consistent styling
    type = type.toUpperCase() === 'VIP' ? 'VIP' : 'Standard';
    return type === 'VIP'
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
            {tickets.map((ticket, idx) => (
              <tr
                key={ticket.id}
                className={`hover:bg-surface-container-lowest transition-colors group ${
                  idx % 2 === 1 ? 'bg-surface-container-lowest/30' : ''
                }`}
              >
                <td className="px-xl py-md font-mono-sm text-sm text-primary font-medium">
                  {ticket.displayId}
                </td>
                <td className="px-xl py-md">
                  <span className={getTypeColor(ticket.type)}>
                    {ticket.type === 'VIP' && (
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
                      e.stopPropagation(); // Prevent row click from triggering
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
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="px-xl py-md bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-between">
        <p className="text-xs text-on-surface-variant">
          Affichage de 1 à 10 sur 1,240 billets
        </p>
        <div className="flex gap-sm">
          <button className="p-1.5 border border-outline-variant/50 rounded-lg bg-white disabled:opacity-30" disabled>
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          <button className="p-1.5 border border-outline-variant/50 rounded-lg bg-white hover:bg-surface-container">
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
}
