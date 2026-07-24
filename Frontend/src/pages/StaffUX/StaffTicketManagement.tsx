import { useState, useEffect, useCallback, useRef } from 'react';
import { API_URL } from '../../config/api';
import LoadingOverlay from '../../components/LoadingOverlay';
import { useToast } from '../../contexts/ToastContext';
import TicketTable from '../../components/TicketTable'; // Vous pouvez réutiliser ou adapter ce tableau
import { useAuth } from '../../contexts/AuthContext';
import {  QrCodeModalScan } from '../../components/QrCodeModalScan';
import TicketNotActivatedModal from '../../components/TicketNotActivatedModal';
import { authAPI } from '../../services/authAPI';
import { parseTicketIdFromQr, mapTicketDbStatusToUi, type TicketScanAction } from '../../utils/ticketScan';

interface Ticket {
  id: string;
  displayId: string;
  type: 'Standard' | 'VIP';
  holder: {
    initials: string;
    name: string;
  };
  status: 'Utilisé' | 'Payé' | 'Valide';
  sellerName?: string;
  scannerName?: string;
  price: number; // Ajouté pour le calcul du montant total
}

export default function StaffTicketManagement({ selectedEventId }: { selectedEventId: string | null }) {
  const { session, user } = useAuth();
  const { showToast } = useToast();
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [scanAction, setScanAction] = useState<TicketScanAction>('use');
  const [isNotActivatedModalOpen, setIsNotActivatedModalOpen] = useState(false);
  const [qrTicketId, setQrTicketId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isScanProcessing, setIsScanProcessing] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchReadyRef = useRef(false);

  // Configuration des prix selon le type de billet (à adapter selon votre logique)
  const TICKET_PRICES = {
    Standard: 10000, // Exemple: 10,000 MGA ou votre devise
    VIP: 25000
  };

  useEffect(() => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
  }, [searchQuery]);

  const fetchStaffTickets = useCallback(async (silent = false) => {
    if (!selectedEventId || !session?.access_token) return;

    if (!silent) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const res = await fetch(`${API_URL}/tickets?event_id=${selectedEventId}${debouncedSearchQuery ? `&search=${encodeURIComponent(debouncedSearchQuery)}` : ''}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();

      if (data.success) {
        const currentUserId = user?.id;

        const mapped: Ticket[] = data.tickets
          .filter((t: any) => t.sold_by === currentUserId || t.scanned_by === currentUserId)
          .map((t: any) => {
            const uiStatus = mapTicketDbStatusToUi(t.status);

            const name = t.holder_name || 'Inconnu';
            const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
            const type = (t.ticket_type === 'vip' || t.ticket_type === 'VIP') ? 'VIP' : 'Standard';

            const dbPrice = (t.price !== undefined && t.price !== null) ? Number(t.price) : (type === 'VIP' ? TICKET_PRICES.VIP : TICKET_PRICES.Standard);
            return {
              id: t.id,
              displayId: t.number != null ? `#${t.number}` : '—',
              type,
              holder: { initials, name },
              status: uiStatus,
              sellerName: t.sold_by_profile?.first_name ? `${t.sold_by_profile.first_name} ${t.sold_by_profile.last_name}` : 'Système',
              scannerName: t.scanned_by_profile?.first_name ? `${t.scanned_by_profile.first_name} ${t.scanned_by_profile.last_name}` : 'N/A',
              price: dbPrice
            };
          });
        setTickets(mapped);
      } else {
        showToast(data.error || 'Erreur lors du chargement de vos statistiques', 'error');
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
  }, [selectedEventId, session, showToast, debouncedSearchQuery, user?.id]);

  useEffect(() => {
    if (selectedEventId) {
      fetchStaffTickets(false);
    }
  }, [selectedEventId, session?.access_token]);

  useEffect(() => {
    if (!selectedEventId) return;
    if (!searchReadyRef.current) {
      searchReadyRef.current = true;
      return;
    }
    fetchStaffTickets(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery]);

  const isSearchPending = searchQuery !== debouncedSearchQuery;

  // Filtrage pour l'affichage de la liste
  const filteredTickets = tickets.filter(t => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'valid') return t.status === 'Valide';
    if (filterStatus === 'paid') return t.status === 'Payé';
    if (filterStatus === 'used') return t.status === 'Utilisé';
    return true;
  });

  // Calculs des KPIs basés uniquement sur les actions de cet utilisateur
  const mySoldTickets = tickets.filter((t) => t.status === 'Payé' || t.status === 'Utilisé'); // billets vendus
  const myScannedCount = tickets.filter((t) => t.status === 'Utilisé').length; // billets scannés
  
  // Calcul du montant total encaissé par ce staff
  const totalRevenue = mySoldTickets.reduce((sum, t) => sum + t.price, 0);

  const handleShowQrCode = (ticketId: string) => {
    setQrTicketId(ticketId);
    setIsQrModalOpen(true);
  };

  const handleOpenScanner = (action: TicketScanAction) => {
    if (!selectedEventId) {
      showToast("Veuillez sélectionner un événement actif avant de scanner.", "error");
      return;
    }
    setScanAction(action);
    setQrTicketId(undefined);
    setIsQrModalOpen(true);
  };

  const handleScanSuccess = async (decodedText: string) => {
    const ticketId = parseTicketIdFromQr(decodedText);

    if (!ticketId) {
      showToast('QR invalide: aucun ID détecté', 'error');
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
        await fetchStaffTickets(true);
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

  return (
    <>
      {isScanProcessing && <LoadingOverlay message="Traitement du scan..." />}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-4 md:px-xl pb-xl pt-24 md:pt-28 min-h-screen space-y-6">
        
        {/* Section Action principale : Scanner un billet */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-on-surface-variant/70 uppercase tracking-wider">
            Espace Scan & Vente Staff
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              className="w-full flex items-center justify-center gap-3 bg-secondary text-white px-4 py-4 rounded-xl shadow-md hover:bg-secondary/95 active:scale-[0.99] transition-all"
              onClick={() => handleOpenScanner('activate')}
            >
              <span className="material-symbols-outlined text-xl">point_of_sale</span>
              <div className="text-left">
                <span className="block text-sm font-bold">Activer un billet</span>
                <span className="block text-[11px] opacity-80">Marquer comme vendu</span>
              </div>
            </button>
            <button
              className="w-full flex items-center justify-center gap-3 bg-primary text-white px-4 py-4 rounded-xl shadow-md hover:bg-primary/95 active:scale-[0.99] transition-all relative overflow-hidden"
              onClick={() => handleOpenScanner('use')}
            >
              <span className="material-symbols-outlined text-xl">qr_code_scanner</span>
              <div className="text-left">
                <span className="block text-sm font-bold">Scanner un billet</span>
                <span className="block text-[11px] opacity-80">Valider l&apos;entrée</span>
              </div>
            </button>
          </div>
        </div>

        {/* Grille KPI Responsive dédiée au Staff */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Ventes faites par le staff */}
          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 flex items-center justify-between">
            <div>
              <span className="block text-outline text-[10px] uppercase tracking-widest font-semibold">Mes Billets Vendus</span>
              <span className="block text-xl font-bold mt-1">{mySoldTickets.length.toLocaleString()}</span>
            </div>
            <span className="material-symbols-outlined text-secondary text-lg bg-secondary/5 p-2 rounded-lg">payments</span>
          </div>

          {/* Scans faits par le staff */}
          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 flex items-center justify-between">
            <div>
              <span className="block text-outline text-[10px] uppercase tracking-widest font-semibold">Mes Billets Scannés</span>
              <span className="block text-xl font-bold mt-1">{myScannedCount.toLocaleString()}</span>
            </div>
            <span className="material-symbols-outlined text-tertiary text-lg bg-tertiary/5 p-2 rounded-lg">qr_code_scanner</span>
          </div>

          {/* Recette totale collectée par le staff */}
          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 flex items-center justify-between">
            <div>
              <span className="block text-outline text-[10px] uppercase tracking-widest font-semibold">Mon Total Encaissé</span>
              <span className="block text-xl font-bold mt-1 text-emerald-600">{totalRevenue.toLocaleString()} Ar</span>
            </div>
            <span className="material-symbols-outlined text-emerald-600 text-lg bg-emerald-50 p-2 rounded-lg">point_of_sale</span>
          </div>
        </div>

        {/* Registre Personnel du Staff */}
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-outline-variant/20 pb-4">
            <div>
              <h2 className="text-lg font-bold text-on-surface">Mon Historique d'Activités</h2>
              <p className="text-xs text-on-surface-variant">Billets que vous avez personnellement vendus ou scannés.</p>
            </div>
            
            {/* Barre de recherche et filtre fluide */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              
              {/* Filtre d'états */}
              <div className="relative w-full sm:w-48">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-md">
                  filter_list
                </span>
                <select
                  className="w-full pl-9 pr-8 py-2 bg-white border border-outline-variant/50 rounded-xl text-xs font-semibold appearance-none focus:border-primary focus:outline-none transition-all text-on-surface"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">Tous mes statuts</option>
                  <option value="paid">Payé (Vendu)</option>
                  <option value="used">Utilisé (Scanné)</option>
                </select>
              </div>

              {/* Recherche par ID ou nom */}
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

          {/* Tableau avec protection contre le débordement mobile */}
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 relative">
            {isLoading && tickets.length === 0 && (
              <LoadingOverlay message="Mise à jour de vos données..." />
            )}
            {!isLoading && tickets.length === 0 ? (
              <div className="py-12 text-center text-xs text-on-surface-variant border border-dashed rounded-xl">
                Aucune activité enregistrée sur cet événement pour le moment.
              </div>
            ) : (
              <TicketTable
                tickets={filteredTickets}
                isRefreshing={isRefreshing || isSearchPending}
                onEditTicket={() => {}}
                onDeleteTicket={() => {}}
                onShowQrCode={handleShowQrCode}
              />
            )}
          </div>
        </section>
      </div>

      <QrCodeModalScan
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        ticketId={qrTicketId}
        mode={qrTicketId ? 'display' : 'scan'}
        scanAction={scanAction}
        onScanSuccess={handleScanSuccess}
      />

      <TicketNotActivatedModal
        isOpen={isNotActivatedModalOpen}
        onClose={() => setIsNotActivatedModalOpen(false)}
      />
    </>
  );
}