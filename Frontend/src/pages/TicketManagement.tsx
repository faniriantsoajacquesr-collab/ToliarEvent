import { useState, useEffect, useCallback, useRef } from 'react';
import { API_URL } from '../config/api';
import ProcessingOverlay from '../components/ProcessingOverlay';
import { InlineListSkeleton } from '../components/skeleton';
import { useToast } from '../contexts/ToastContext';
import TicketTable from '../components/TicketTable';
import BulkGenerationModal from '../components/BulkGenerationModal';
import type { BulkConfig } from '../components/BulkGenerationModal';
import { useAuth } from '../contexts/AuthContext';
import EditTicketModal from '../components/EditTicketModal';
import QrCodeModal from '../components/QrCodeModal';
import { QrCodeModalScan } from '../components/QrCodeModalScan';
import TicketNotActivatedModal from '../components/TicketNotActivatedModal';
import TicketRestoreFromScreenshotModal from '../components/TicketRestoreFromScreenshotModal';
import TicketTypesManagement from '../components/TicketTypesManagement';
import AppPageHeader from '../components/AppPageHeader';
import { authAPI } from '../services/authAPI';
import { parseTicketIdFromQr, mapTicketDbStatusToUi, sortTicketsByNumberDesc, type TicketScanAction } from '../utils/ticketScan';

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
  const { session, user } = useAuth();
  const isAdmin = user?.role?.toString().toLowerCase() === 'admin';
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
  const [scanAction, setScanAction] = useState<TicketScanAction>('use');
  const [isNotActivatedModalOpen, setIsNotActivatedModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
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
        const mapped: Ticket[] = sortTicketsByNumberDesc(data.tickets || []).map((t: any) => {
          const uiStatus = mapTicketDbStatusToUi(t.status);

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

  const handleOpenScanner = (action: TicketScanAction) => {
    if (!selectedEventId) {
      showToast("Sélectionnez d'abord un événement avant de scanner.", 'error');
      return;
    }
    setScanAction(action);
    setIsScanModalOpen(true);
  };

  const handleScanSuccess = async (decodedText: string) => {
    const ticketId = parseTicketIdFromQr(decodedText);

    if (!ticketId) {
      showToast('QR invalide : aucun ID détecté', 'error');
      return;
    }

    if (!session?.access_token || !selectedEventId) {
      showToast('Vous devez être connecté pour valider un billet', 'error');
      return;
    }

    try {
      setIsScanProcessing(true);
      const data = await authAPI.scanTicket(ticketId, selectedEventId, scanAction, session.access_token);

      if (data.success) {
        showToast(data.message || (scanAction === 'activate' ? 'Billet activé' : 'Billet validé'), 'success');
        await fetchTickets(true);
        return;
      }

      if (scanAction === 'use' && data.error_code === 'NOT_ACTIVATED') {
        setIsNotActivatedModalOpen(true);
        return;
      }

      showToast(data.error || data.message || 'Échec du traitement', 'error');
    } catch (err) {
      console.error('Scan API error:', err);
      showToast('Erreur réseau lors du traitement', 'error');
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
      {isScanProcessing && <ProcessingOverlay message="Traitement du scan..." />}
      <main className="dash-page flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-screen">
        <div className="relative z-10 max-w-container-max mx-auto px-gutter pb-12 pt-24 md:pt-28 space-y-8">
          <AppPageHeader
            title="Billetterie"
            subtitle="Gérez le registre des billets, les scans et la configuration tarifaire de l'événement actif."
          />

          {/* Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('registre')}
                className={`landing-chip ${activeTab === 'registre' ? 'landing-chip--active' : ''}`}
              >
                Registre
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('config')}
                className={`landing-chip ${activeTab === 'config' ? 'landing-chip--active' : ''}`}
              >
                Tarifs
              </button>
            </div>
            <p className="text-xs app-text-muted max-w-md">
              Basculez entre le registre opérationnel et la configuration des types de billets.
            </p>
          </div>

        {activeTab === 'registre' ? (
          <>
            {/* Quick actions */}
            <section className="dash-actions-panel">
              <p className="landing-eyebrow mb-1">Actions rapides</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  className="dash-action-card dash-action-card--blue"
                  onClick={() => {
                    if (!selectedEventId) {
                      showToast("Sélectionnez d'abord un événement dans la section 'Événements'", 'error');
                      return;
                    }
                    window.open(`/badge-editor?eventId=${encodeURIComponent(selectedEventId)}`, '_blank');
                  }}
                >
                  <span className="dash-action-card__icon">
                    <span className="material-symbols-outlined">confirmation_number</span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold app-heading">Générer des billets</p>
                    <p className="text-xs app-text-muted mt-0.5">Impression & badges</p>
                  </div>
                  <span className="dash-action-card__arrow">arrow_forward</span>
                </button>
                <button
                  type="button"
                  className="dash-action-card dash-action-card--indigo"
                  onClick={() => handleOpenScanner('activate')}
                >
                  <span className="dash-action-card__icon">
                    <span className="material-symbols-outlined">point_of_sale</span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold app-heading">Activer un billet</p>
                    <p className="text-xs app-text-muted mt-0.5">Marquer comme vendu</p>
                  </div>
                  <span className="dash-action-card__arrow">arrow_forward</span>
                </button>
                <button
                  type="button"
                  className="dash-action-card dash-action-card--teal"
                  onClick={() => handleOpenScanner('use')}
                >
                  <span className="dash-action-card__icon">
                    <span className="material-symbols-outlined">qr_code_scanner</span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold app-heading">Scanner un billet</p>
                    <p className="text-xs app-text-muted mt-0.5">Valider l&apos;entrée</p>
                  </div>
                  <span className="dash-action-card__arrow">arrow_forward</span>
                </button>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  className="dash-action-card dash-action-card--amber w-full"
                  onClick={() => {
                    if (!selectedEventId) {
                      showToast("Sélectionnez d'abord un événement", 'error');
                      return;
                    }
                    setIsRestoreModalOpen(true);
                  }}
                >
                  <span className="dash-action-card__icon">
                    <span className="material-symbols-outlined">restore_page</span>
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-bold app-heading">Ré-enregistrer depuis capture</p>
                    <p className="text-xs app-text-muted mt-0.5">Admin — billets imprimés supprimés par erreur</p>
                  </div>
                  <span className="dash-action-card__arrow">arrow_forward</span>
                </button>
              )}
            </section>

            {/* KPIs */}
            <section>
              <p className="landing-eyebrow mb-4">Vue d&apos;ensemble</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="dash-stat-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="dash-stat-label mb-1">Valides / Imprimés</p>
                    <p className="dash-stat-value">{validTicketsCount.toLocaleString()}</p>
                  </div>
                  <span className="material-symbols-outlined text-2xl text-primary opacity-80">print</span>
                </div>
              </div>
              <div className="dash-stat-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="dash-stat-label mb-1">Billets vendus</p>
                    <p className="dash-stat-value">{paidTicketsCount.toLocaleString()}</p>
                  </div>
                  <span className="material-symbols-outlined text-2xl text-indigo-500 opacity-80">payments</span>
                </div>
              </div>
              <div className="dash-stat-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="dash-stat-label mb-1">Billets scannés</p>
                    <p className="dash-stat-value">{usedTicketsCount.toLocaleString()}</p>
                  </div>
                  <span className="material-symbols-outlined text-2xl text-teal-500 opacity-80">qr_code_scanner</span>
                </div>
              </div>
              </div>
            </section>

            {/* Registry */}
            <section className="space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                  <p className="landing-eyebrow mb-2">Registre</p>
                  <h2 className="font-landing-display text-xl app-heading">Registre des billets</h2>
                </div>
              </div>

              <div className="dash-toolbar flex-col sm:flex-row">
                <div className="relative flex-1 min-w-[140px]">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 app-text-muted text-lg pointer-events-none">filter_list</span>
                  <select
                    className="w-full pl-10 pr-8 py-2.5 rounded-xl text-xs font-semibold app-input appearance-none bg-transparent border-0"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="valid">Valide</option>
                    <option value="paid">Payé</option>
                    <option value="used">Utilisé</option>
                  </select>
                </div>
                <div className="relative flex-1 min-w-[140px]">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 app-text-muted text-lg pointer-events-none">confirmation_number</span>
                  <select
                    className="w-full pl-10 pr-8 py-2.5 rounded-xl text-xs font-semibold app-input appearance-none bg-transparent border-0"
                    value={filterTicketType}
                    onChange={(e) => setFilterTicketType(e.target.value)}
                  >
                    <option value="all">Tous les types</option>
                    {typeFilterOptions.map((typeName) => (
                      <option key={typeName} value={typeName}>{typeName}</option>
                    ))}
                  </select>
                </div>
                <div className="relative flex-[1.2] min-w-[180px]">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 app-text-muted text-lg pointer-events-none">search</span>
                  <input
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs app-input bg-transparent border-0 focus:outline-none"
                    placeholder="N°, détenteur ou vendeur…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    type="search"
                  />
                </div>
              </div>

              {selectedTicketIds.size > 0 && (
                <div className="app-card rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-primary/25">
                  <span className="text-sm font-semibold text-primary">
                    {selectedTicketIds.size} billet{selectedTicketIds.size > 1 ? 's' : ''} sélectionné{selectedTicketIds.size > 1 ? 's' : ''}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setSelectedTicketIds(new Set())} className="landing-btn-secondary !px-3 !py-1.5 !text-xs !rounded-lg" disabled={isDeleting || isBulkUpdating}>
                      Désélectionner
                    </button>
                    <button type="button" onClick={() => handleBulkUpdateStatus('vendu')} className="landing-btn-primary !px-3 !py-1.5 !text-xs !rounded-lg bg-indigo-600" disabled={isDeleting || isBulkUpdating}>
                      {isBulkUpdating ? 'Traitement…' : 'Marquer vendu'}
                    </button>
                    <button type="button" onClick={() => handleBulkUpdateStatus('valid')} className="landing-btn-primary !px-3 !py-1.5 !text-xs !rounded-lg bg-emerald-600" disabled={isDeleting || isBulkUpdating}>
                      {isBulkUpdating ? 'Traitement…' : 'Marquer valide'}
                    </button>
                    <button type="button" onClick={handleBulkDelete} className="landing-btn-secondary !px-3 !py-1.5 !text-xs !rounded-lg !text-red-600 !border-red-200" disabled={isDeleting || isBulkUpdating}>
                      {isDeleting ? 'Suppression…' : 'Supprimer'}
                    </button>
                  </div>
                </div>
              )}

              <div className="relative">
                {isLoading && tickets.length === 0 ? (
                  <InlineListSkeleton rows={8} />
                ) : (
                  <TicketTable
                    tickets={filteredTickets}
                    selectedIds={selectedTicketIds}
                    onSelectionChange={setSelectedTicketIds}
                    isRefreshing={isRefreshing || isSearchPending}
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
      </main>

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
        scanAction={scanAction}
        onScanSuccess={handleScanSuccess}
      />

      <TicketNotActivatedModal
        isOpen={isNotActivatedModalOpen}
        onClose={() => setIsNotActivatedModalOpen(false)}
      />

      <TicketRestoreFromScreenshotModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        eventId={selectedEventId}
        accessToken={session?.access_token}
        onRestored={() => fetchTickets(true)}
      />
    </>
  );
}
