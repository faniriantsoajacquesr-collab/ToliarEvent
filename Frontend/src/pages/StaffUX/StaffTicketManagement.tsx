import { useState, useEffect, useCallback, useRef } from 'react';

import { API_URL } from '../../config/api';

import ProcessingOverlay from '../../components/ProcessingOverlay';

import { InlineListSkeleton } from '../../components/skeleton';

import { useToast } from '../../contexts/ToastContext';

import TicketTable from '../../components/TicketTable';

import AppPageHeader from '../../components/AppPageHeader';

import { useAuth } from '../../contexts/AuthContext';

import { QrCodeModalScan } from '../../components/QrCodeModalScan';

import TicketNotActivatedModal from '../../components/TicketNotActivatedModal';

import { authAPI } from '../../services/authAPI';

import { parseTicketIdFromQr, mapTicketDbStatusToUi, sortTicketsByNumberDesc, type TicketScanAction } from '../../utils/ticketScan';



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

  price: number;

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



  const TICKET_PRICES = {

    Standard: 10000,

    VIP: 25000,

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



        const mapped: Ticket[] = sortTicketsByNumberDesc(

          data.tickets.filter((t: { sold_by?: string; scanned_by?: string }) => t.sold_by === currentUserId || t.scanned_by === currentUserId)

        ).map((t: Record<string, unknown>) => {

          const uiStatus = mapTicketDbStatusToUi(t.status as string);



          const name = (t.holder_name as string) || 'Inconnu';

          const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

          const type = (t.ticket_type === 'vip' || t.ticket_type === 'VIP') ? 'VIP' : 'Standard';



          const soldByProfile = t.sold_by_profile as { first_name?: string; last_name?: string } | undefined;

          const scannedByProfile = t.scanned_by_profile as { first_name?: string; last_name?: string } | undefined;



          const dbPrice = (t.price !== undefined && t.price !== null)

            ? Number(t.price)

            : (type === 'VIP' ? TICKET_PRICES.VIP : TICKET_PRICES.Standard);



          return {

            id: String(t.id),

            displayId: t.number != null ? `#${t.number}` : '—',

            type,

            holder: { initials, name },

            status: uiStatus,

            sellerName: soldByProfile?.first_name ? `${soldByProfile.first_name} ${soldByProfile.last_name}` : 'Système',

            scannerName: scannedByProfile?.first_name ? `${scannedByProfile.first_name} ${scannedByProfile.last_name}` : 'N/A',

            price: dbPrice,

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



  const filteredTickets = tickets.filter((t) => {

    if (filterStatus === 'all') return true;

    if (filterStatus === 'valid') return t.status === 'Valide';

    if (filterStatus === 'paid') return t.status === 'Payé';

    if (filterStatus === 'used') return t.status === 'Utilisé';

    return true;

  });



  const mySoldTickets = tickets.filter((t) => t.status === 'Payé' || t.status === 'Utilisé');

  const myScannedCount = tickets.filter((t) => t.status === 'Utilisé').length;

  const totalRevenue = mySoldTickets.reduce((sum, t) => sum + t.price, 0);



  const handleShowQrCode = (ticketId: string) => {

    setQrTicketId(ticketId);

    setIsQrModalOpen(true);

  };



  const handleOpenScanner = (action: TicketScanAction) => {

    if (!selectedEventId) {

      showToast('Veuillez sélectionner un événement actif avant de scanner.', 'error');

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

      {isScanProcessing && <ProcessingOverlay message="Traitement du scan..." />}

      <main className="dash-page flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-screen">

        <div className="relative z-10 max-w-container-max mx-auto px-gutter pb-12 pt-24 md:pt-28 space-y-8">

          <AppPageHeader

            title="Mon activité billetterie"

            subtitle="Scannez, activez et suivez vos ventes et validations sur l'événement actif."

          />



          <section className="dash-actions-panel">

            <p className="landing-eyebrow mb-1">Actions rapides</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              <button

                type="button"

                className="dash-action-card dash-action-card--indigo"

                onClick={() => handleOpenScanner('activate')}

              >

                <span className="dash-action-card__icon">

                  <span className="material-symbols-outlined">point_of_sale</span>

                </span>

                <div className="min-w-0 text-left">

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

                <div className="min-w-0 text-left">

                  <p className="text-sm font-bold app-heading">Scanner un billet</p>

                  <p className="text-xs app-text-muted mt-0.5">Valider l&apos;entrée</p>

                </div>

                <span className="dash-action-card__arrow">arrow_forward</span>

              </button>

            </div>

          </section>



          <section>

            <p className="landing-eyebrow mb-4">Vue d&apos;ensemble</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            <div className="dash-stat-card">

              <div className="flex items-start justify-between gap-3">

                <div>

                  <p className="dash-stat-label mb-1">Mes billets vendus</p>

                  <p className="dash-stat-value">{mySoldTickets.length.toLocaleString()}</p>

                </div>

                <span className="material-symbols-outlined text-2xl text-indigo-500 opacity-80">payments</span>

              </div>

            </div>

            <div className="dash-stat-card">

              <div className="flex items-start justify-between gap-3">

                <div>

                  <p className="dash-stat-label mb-1">Mes billets scannés</p>

                  <p className="dash-stat-value">{myScannedCount.toLocaleString()}</p>

                </div>

                <span className="material-symbols-outlined text-2xl text-teal-500 opacity-80">qr_code_scanner</span>

              </div>

            </div>

            <div className="dash-stat-card">

              <div className="flex items-start justify-between gap-3">

                <div>

                  <p className="dash-stat-label mb-1">Mon total encaissé</p>

                  <p className="dash-stat-value text-emerald-600 dark:text-emerald-400">{totalRevenue.toLocaleString()} Ar</p>

                </div>

                <span className="material-symbols-outlined text-2xl text-emerald-500 opacity-80">point_of_sale</span>

              </div>

            </div>

            </div>

          </section>



          <section className="space-y-5">

            <div>

              <p className="landing-eyebrow mb-2">Historique</p>

              <h2 className="font-landing-display text-xl app-heading">Mon historique d&apos;activités</h2>

              <p className="text-sm app-text-muted mt-1">Billets que vous avez personnellement vendus ou scannés.</p>

            </div>



            <div className="dash-toolbar flex-col sm:flex-row">

              <div className="relative flex-1 min-w-[140px]">

                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 app-text-muted text-lg pointer-events-none">filter_list</span>

                <select

                  className="w-full pl-10 pr-8 py-2.5 rounded-xl text-xs font-semibold app-input appearance-none bg-transparent border-0"

                  value={filterStatus}

                  onChange={(e) => setFilterStatus(e.target.value)}

                >

                  <option value="all">Tous mes statuts</option>

                  <option value="paid">Payé (vendu)</option>

                  <option value="used">Utilisé (scanné)</option>

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



            <div className="relative">

              {isLoading && tickets.length === 0 ? (

                <InlineListSkeleton rows={6} />

              ) : !isLoading && tickets.length === 0 ? (

                <div className="dash-empty-state py-12">

                  <span className="material-symbols-outlined text-4xl text-primary mb-3 block">history</span>

                  <p className="font-landing-display text-lg app-heading mb-1">Aucune activité</p>

                  <p className="text-sm app-text-muted">Vous n&apos;avez pas encore vendu ou scanné de billet sur cet événement.</p>

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

      </main>



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


