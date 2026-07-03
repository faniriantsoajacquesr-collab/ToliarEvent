import { useState, useEffect, useCallback, useRef } from 'react';
import { API_URL } from '../config/api';
import LoadingOverlay from '../components/LoadingOverlay';
import { useToast } from '../contexts/ToastContext';
import TicketTable from '../components/TicketTable';
import BulkGenerationModal from '../components/BulkGenerationModal';
import type { BulkConfig } from '../components/BulkGenerationModal';
import { useAuth } from '../contexts/AuthContext';
import EditTicketModal from '../components/EditTicketModal';
import QrCodeModal from '../components/QrCodeModal';
import { QrCodeModalScan } from '../components/QrCodeModalScan';
import TicketTypesManagement from '../components/TicketTypesManagement';
import { authAPI } from '../services/authAPI';

interface Ticket {
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

export default function TicketManagement({ selectedEventId }: { selectedEventId: string | null }) {
  const { session } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'registre' | 'config'>('registre');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTicketType, setFilterTicketType] = useState('all');
  const [ticketTypeOptions, setTicketTypeOptions] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrTicketId, setQrTicketId] = useState<string | null>(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isScanProcessing, setIsScanProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
  }, [searchQuery]);

  useEffect(() => {
    const loadTicketTypes = async () => {
      if (!selectedEventId || !session?.access_token) {
        setTicketTypeOptions([]);
        return;
      }

      try {
        const result = await authAPI.getTicketTypes(selectedEventId, session.access_token);
        if (result.success && Array.isArray(result.ticket_types)) {
          setTicketTypeOptions(result.ticket_types.map((t: { name: string }) => t.name));
        } else {
          setTicketTypeOptions([]);
        }
      } catch {
        setTicketTypeOptions([]);
      }
    };

    loadTicketTypes();
  }, [selectedEventId, session?.access_token]);

  const fetchTickets = useCallback(async (silent = false) => {
    if (!selectedEventId || !session?.access_token) return;

    if (!silent) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const params = new URLSearchParams({ event_id: selectedEventId });
      if (debouncedSearchQuery) params.set('search', debouncedSearchQuery);
      if (filterTicketType !== 'all') params.set('ticket_type', filterTicketType);

      const res = await fetch(`${API_URL}/tickets?${params.toString()}`, {
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
            displayId: t.number != null ? `#${t.number}` : '—',
            type: t.ticket_type || 'Standard',
            holder: { initials, name },
            status: uiStatus,
            sellerName,
            scannerName,
          };
        });
        setTickets(mapped);
        if (!silent) {
          setSelectedTicketIds(new Set());
        }
      } else {
        showToast(data.error || 'Erreur lors du chargement des billets', 'error');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      showToast('Impossible de contacter le serveur', 'error');
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [selectedEventId, session, showToast, debouncedSearchQuery, filterTicketType]);

  useEffect(() => {
    fetchTickets(false);
  }, [selectedEventId, filterTicketType, session?.access_token]);

  const searchReadyRef = useRef(false);
  useEffect(() => {
    if (!searchReadyRef.current) {
      searchReadyRef.current = true;
      return;
    }
    fetchTickets(true);
  }, [debouncedSearchQuery]);

  const isSearchPending = searchQuery !== debouncedSearchQuery;

  const handleGenerateBulk = (config: BulkConfig) => {
    showToast(`Billets générés avec succès ! Préparation du téléchargement (${config.quantity} x ${config.type})`, 'success');
    setTimeout(fetchTickets, 3000);
  };

  const filteredTickets = tickets.filter((t) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'valid') return t.status === 'Valide';
    if (filterStatus === 'paid') return t.status === 'Payé';
    if (filterStatus === 'used') return t.status === 'Utilisé';
    return true;
  });

  const validTicketsCount = tickets.filter((t) => t.status === 'Valide').length;
  const paidTicketsCount = tickets.filter((t) => t.status === 'Payé').length;
  const usedTicketsCount = tickets.filter((t) => t.status === 'Utilisé').length;

  const deleteTickets = async (ids: string[]) => {
    if (!session?.access_token || ids.length === 0) return false;

    setIsDeleting(true);
    try {
      const res = await fetch(`${API_URL}/tickets/bulk-delete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticket_ids: ids }),
      });
      const data = await res.json();

      if (data.success) {
        showToast(data.message || 'Billet(s) supprimé(s) avec succès.', 'success');
        setSelectedTicketIds(new Set());
        await fetchTickets();
        return true;
      }

      showToast(data.error || 'Erreur lors de la suppression', 'error');
      return false;
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Impossible de contacter le serveur', 'error');
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditTicket = (ticketId: string) => {
    setEditingTicketId(ticketId);
    setIsEditModalOpen(true);
  };

  const handleDeleteTicket = async (ticketId: string) => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!confirm(`Supprimer le billet ${ticket?.displayId || ticketId} ?`)) return;
    await deleteTickets([ticketId]);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedTicketIds);
    if (ids.length === 0) return;
    if (!confirm(`Supprimer ${ids.length} billet${ids.length > 1 ? 's' : ''} sélectionné${ids.length > 1 ? 's' : ''} ?`)) return;
    await deleteTickets(ids);
  };

  const handleBulkUpdateStatus = async (status: 'vendu' | 'valid') => {
    if (!session?.access_token) return;
    const ids = Array.from(selectedTicketIds);
    if (ids.length === 0) return;

    const label = status === 'vendu' ? 'vendu' : 'valid';
    if (!confirm(`Marquer ${ids.length} billet${ids.length > 1 ? 's' : ''} comme ${label} ?`)) return;

    setIsBulkUpdating(true);
    try {
      const data = await authAPI.bulkUpdateTicketStatus(ids, status, session.access_token);
      if (!data.success) {
        showToast(data.error || 'Mise à jour impossible', 'error');
        return;
      }
      showToast(data.message || 'Billets mis à jour avec succès.', 'success');
      setSelectedTicketIds(new Set());
      await fetchTickets(false);
    } catch (err) {
      console.error('Bulk update tickets error:', err);
      showToast('Impossible de contacter le serveur', 'error');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleShowQrCode = (ticketId: string) => {
    setQrTicketId(ticketId);
    setIsQrModalOpen(true);
  };

  const handleOpenScanner = () => {
    if (!selectedEventId) {
      showToast("Sélectionnez d'abord un événement avant de scanner.", 'error');
      return;
    }
    setIsScanModalOpen(true);
  };

  const handleScanSuccess = async (decodedText: string) => {
    let ticketId = decodedText || '';
    try {
      const u = new URL(decodedText);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length > 0) ticketId = parts[parts.length - 1];
    } catch {
      // not a URL, keep decodedText as-is
    }

    if (!ticketId) {
      showToast('QR invalide : aucun ID détecté', 'error');
      return;
    }

    if (!session?.access_token) {
      showToast('Vous devez être connecté pour valider un billet', 'error');
      return;
    }

    try {
      setIsScanProcessing(true);
      const res = await fetch(`${API_URL}/tickets/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ticket_id: ticketId, event_id: selectedEventId }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Non-JSON response from /tickets/scan:', text);
        showToast('Erreur serveur : réponse inattendue.', 'error');
        return;
      }

      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Billet validé', 'success');
        await fetchTickets(true);
      } else {
        showToast(data.error || data.message || 'Échec de la validation', 'error');
      }
    } catch (err) {
      console.error('Scan API error:', err);
      showToast('Erreur réseau lors de la validation', 'error');
    } finally {
      setIsScanProcessing(false);
    }
  };

  const typeFilterOptions = Array.from(
    new Set([
      ...ticketTypeOptions,
      ...tickets.map((t) => t.type),
    ])
  ).sort((a, b) => a.localeCompare(b, 'fr'));

  return (
    <>
      {isScanProcessing && <LoadingOverlay message="Traitement du scan..." />}
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
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-on-surface-variant/70 uppercase tracking-wider">
                Actions de Billetterie
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <button
                  className="w-full flex items-center justify-center gap-3 bg-tertiary text-white px-4 py-4 rounded-xl shadow-md hover:bg-tertiary/95 active:scale-[0.99] transition-all"
                  onClick={handleOpenScanner}
                >
                  <span className="material-symbols-outlined text-xl">qr_code_scanner</span>
                  <div className="text-left">
                    <span className="block text-sm font-bold">Scanner un billet</span>
                  </div>
                </button>
              </div>
            </div>

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

                  <div className="relative w-full sm:w-48">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-md">
                      confirmation_number
                    </span>
                    <select
                      className="w-full pl-9 pr-8 py-2 bg-white border border-outline-variant/50 rounded-xl text-xs font-semibold appearance-none focus:border-primary focus:outline-none transition-all text-on-surface"
                      value={filterTicketType}
                      onChange={(e) => setFilterTicketType(e.target.value)}
                    >
                      <option value="all">Tous les types</option>
                      {typeFilterOptions.map((typeName) => (
                        <option key={typeName} value={typeName}>
                          {typeName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-md">
                      search
                    </span>
                    <input
                      className="w-full pl-9 pr-4 py-2 bg-white border border-outline-variant/50 rounded-xl text-xs focus:border-primary focus:outline-none transition-all text-on-surface"
                      placeholder="N°, détenteur ou vendeur..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      type="text"
                    />
                  </div>
                </div>
              </div>

              {selectedTicketIds.size > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                  <span className="text-sm font-medium text-primary">
                    {selectedTicketIds.size} billet{selectedTicketIds.size > 1 ? 's' : ''} sélectionné{selectedTicketIds.size > 1 ? 's' : ''}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTicketIds(new Set())}
                      className="rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition"
                      disabled={isDeleting || isBulkUpdating}
                    >
                      Désélectionner
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkUpdateStatus('vendu')}
                      className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-white hover:bg-secondary/90 transition disabled:opacity-50"
                      disabled={isDeleting || isBulkUpdating}
                    >
                      {isBulkUpdating ? 'Traitement...' : 'Marquer vendu'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkUpdateStatus('valid')}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                      disabled={isDeleting || isBulkUpdating}
                    >
                      {isBulkUpdating ? 'Traitement...' : 'Marquer valide'}
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkDelete}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
                      disabled={isDeleting || isBulkUpdating}
                    >
                      {isDeleting ? 'Suppression...' : 'Supprimer la sélection'}
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 relative">
                {isLoading && tickets.length === 0 && (
                  <LoadingOverlay message="Chargement des billets..." />
                )}
                <TicketTable
                  tickets={filteredTickets}
                  selectedIds={selectedTicketIds}
                  onSelectionChange={setSelectedTicketIds}
                  isRefreshing={isRefreshing || isSearchPending}
                  onEditTicket={handleEditTicket}
                  onDeleteTicket={handleDeleteTicket}
                  onShowQrCode={handleShowQrCode}
                />
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

      <QrCodeModalScan
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        mode="scan"
        onScanSuccess={handleScanSuccess}
      />
    </>
  );
}
