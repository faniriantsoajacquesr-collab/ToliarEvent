import { useState, useEffect, useCallback, useRef } from 'react';
import LoadingOverlay from '../components/LoadingOverlay';
import { useToast } from '../contexts/ToastContext';
import TicketTable from '../components/TicketTable';
import BulkGenerationModal from '../components/BulkGenerationModal';
import type { BulkConfig } from '../components/BulkGenerationModal';
import { useAuth } from '../contexts/AuthContext';
import EditTicketModal from '../components/EditTicketModal';
import QrCodeModal from '../components/QrCodeModal';
import TicketTypesManagement from '../components/TicketTypesManagement';

interface Ticket {
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

export default function TicketManagement({ selectedEventId }: { selectedEventId: string | null }) {
  const { session } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'registre' | 'config'>('registre');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrTicketId, setQrTicketId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
  }, [searchQuery]);

  const fetchTickets = useCallback(async () => {
    if (!selectedEventId || !session?.access_token || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/auth/tickets?event_id=${selectedEventId}${debouncedSearchQuery ? `&search=${encodeURIComponent(debouncedSearchQuery)}` : ''}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();

      if (data.success) {
        const mapped: Ticket[] = data.tickets.map((t: any) => {
          let uiStatus: 'Valide' | 'Payé' | 'Utilisé' = 'Valide';
          if (t.status === 'vendu') uiStatus = 'Payé';
          else if (t.status === 'utilisé') uiStatus = 'Utilisé';
          else if (t.status === 'valide' || t.status === 'valid') uiStatus = 'Valide';

          const name = t.holder_name || 'Inconnu';
          const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
          
          const sellerName = t.sold_by_profile?.first_name && t.sold_by_profile?.last_name
            ? `${t.sold_by_profile.first_name} ${t.sold_by_profile.last_name}`
            : (t.sold_by ? 'ID: ' + t.sold_by.slice(0, 8) : 'Système');

          const scannerName = t.scanned_by_profile?.first_name && t.scanned_by_profile?.last_name
            ? `${t.scanned_by_profile.first_name} ${t.scanned_by_profile.last_name}`
            : (t.scanned_by ? 'ID: ' + t.scanned_by.slice(0, 8) : 'N/A');

          return {
            id: t.id,
            displayId: '#' + t.id.slice(0, 8).toUpperCase(),
            type: (t.ticket_type === 'vip' || t.ticket_type === 'VIP') ? 'VIP' : 'Standard',
            holder: { initials, name },
            status: uiStatus,
            sellerName,
            scannerName,
          };
        });
        setTickets(mapped);
      } else {
        showToast(data.error || 'Erreur lors du chargement des billets', 'error');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      showToast('Impossible de contacter le serveur', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEventId, session, showToast, debouncedSearchQuery]);

  useEffect(() => {
    fetchTickets(); 
  }, [fetchTickets, selectedEventId, debouncedSearchQuery]);

  const handleGenerateBulk = (config: BulkConfig) => {
    showToast(`Billets générés avec succès ! Préparation du téléchargement (${config.quantity} x ${config.type})`, 'success');
    setTimeout(fetchTickets, 3000);
  };

  const filteredTickets = tickets.filter(t => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'valid') return t.status === 'Valide';
    if (filterStatus === 'paid') return t.status === 'Payé';
    if (filterStatus === 'used') return t.status === 'Utilisé';
    return true;
  });

  const validTicketsCount = tickets.filter((t) => t.status === 'Valide').length;
  const paidTicketsCount = tickets.filter((t) => t.status === 'Payé').length;
  const usedTicketsCount = tickets.filter((t) => t.status === 'Utilisé').length;

  const handleEditTicket = (ticketId: string) => {
    setEditingTicketId(ticketId);
    setIsEditModalOpen(true);
  };

  const handleDeleteTicket = (ticketId: string) => {
    if (!confirm(`Supprimer le billet ${ticketId} ?`)) return;
    setTickets(prev => prev.filter(t => t.id !== ticketId));
    showToast('Billet supprimé avec succès.', 'success');
  };

  const handleShowQrCode = (ticketId: string) => {
    setQrTicketId(ticketId);
    setIsQrModalOpen(true);
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-4 md:px-xl pb-xl pt-24 md:pt-28 min-h-screen space-y-6">
        <div className="rounded-3xl border border-outline-variant/30 bg-surface p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 rounded-full border border-outline-variant/40 bg-background p-1">
              <button
                type="button"
                onClick={() => setActiveTab('registre')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === 'registre' ? 'border-b-2 border-primary text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Registre
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('config')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === 'config' ? 'border-b-2 border-primary text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Tarifs
              </button>
            </div>
            <p className="text-sm text-on-surface-variant">Basculez entre le registre opérationnel et la configuration des types de billets.</p>
          </div>
        </div>

        {activeTab === 'registre' ? (
          <>
            {/* Section Actions de Billetterie */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-on-surface-variant/70 uppercase tracking-wider">
                Actions de Billetterie
              </h3>
              <button
                className="w-full flex items-center justify-center gap-3 bg-primary text-white px-4 py-4 rounded-xl shadow-sm hover:bg-primary/95 active:scale-[0.99] transition-all group overflow-hidden relative"
                onClick={() => {
                  if (!selectedEventId) {
                    showToast("Sélectionnez d'abord un événement dans la section 'Événements'", 'error');
                    return;
                  }
                  const url = `/badge-editor?eventId=${encodeURIComponent(selectedEventId)}`;
                  window.open(url, '_blank');
                }}
              >
                <span className="material-symbols-outlined text-xl">confirmation_number</span>
                <div className="text-left">
                  <span className="block text-sm font-bold">Générer des billets</span>
                </div>
              </button>
            </div>

            {/* Grille KPI Responsive : 1 col sur mobile, 3 sur Desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 flex items-center justify-between">
                <div>
                  <span className="block text-outline text-[10px] uppercase tracking-widest font-semibold">Valides / Imprimés</span>
                  <span className="block text-xl font-bold mt-1">{validTicketsCount.toLocaleString()}</span>
                </div>
                <span className="material-symbols-outlined text-primary text-lg bg-primary/5 p-2 rounded-lg">print</span>
              </div>

              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 flex items-center justify-between">
                <div>
                  <span className="block text-outline text-[10px] uppercase tracking-widest font-semibold">Billets Vendus</span>
                  <span className="block text-xl font-bold mt-1">{paidTicketsCount.toLocaleString()}</span>
                </div>
                <span className="material-symbols-outlined text-secondary text-lg bg-secondary/5 p-2 rounded-lg">payments</span>
              </div>

              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 flex items-center justify-between">
                <div>
                  <span className="block text-outline text-[10px] uppercase tracking-widest font-semibold">Billets Scannés</span>
                  <span className="block text-xl font-bold mt-1">{usedTicketsCount.toLocaleString()}</span>
                </div>
                <span className="material-symbols-outlined text-tertiary text-lg bg-tertiary/5 p-2 rounded-lg">qr_code_scanner</span>
              </div>
            </div>

            {/* Section Registre et Filtres Entièrement Réparée */}
            <section className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-outline-variant/20 pb-4">
                <h2 className="text-lg font-bold text-on-surface">Registre des Billets</h2>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                  <div className="relative w-full sm:w-48">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-md">
                      filter_list
                    </span>
                    <select
                      className="w-full pl-9 pr-8 py-2 bg-white border border-outline-variant/50 rounded-xl text-xs font-semibold appearance-none focus:border-primary focus:outline-none transition-all text-on-surface"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="all">Tous les statuts</option>
                      <option value="valid">Valide</option>
                      <option value="paid">Payé</option>
                      <option value="used">Utilisé</option>
                    </select>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-md">
                      search
                    </span>
                    <input
                      className="w-full pl-9 pr-4 py-2 bg-white border border-outline-variant/50 rounded-xl text-xs focus:border-primary focus:outline-none transition-all text-on-surface"
                      placeholder="ID ou détenteur..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      type="text"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                {isLoading && <LoadingOverlay message="Chargement des billets..." />}
                {!isLoading && (
                  <TicketTable
                    tickets={filteredTickets}
                    onEditTicket={handleEditTicket}
                    onDeleteTicket={handleDeleteTicket}
                    onShowQrCode={handleShowQrCode}
                  />
                )}
              </div>
            </section>
          </>
        ) : (
          <TicketTypesManagement selectedEventId={selectedEventId} />
        )}
      </div>

      <BulkGenerationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onGenerate={handleGenerateBulk}
      />

      <EditTicketModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        ticketId={editingTicketId} 
        eventId={selectedEventId} 
        onSave={() => fetchTickets()} 
      />
      
      <QrCodeModal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} ticketId={qrTicketId} />
    </>
  );
}