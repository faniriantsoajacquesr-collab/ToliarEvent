import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import LoadingOverlay from '../components/LoadingOverlay';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { authAPI } from '../services/authAPI';

type PaymentStatus = 'pending' | 'validated' | 'rejected';

interface OrderTicket {
  id: string;
  number?: number;
  ticket_type: string;
  status: string;
  holder_name?: string;
}

interface OnlineOrder {
  id: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_email?: string | null;
  transaction_id: string;
  total_amount: number;
  payment_status: PaymentStatus;
  created_at: string;
  ticket_count: number;
  tickets: OrderTicket[];
  payment_method?: {
    id: number;
    Operateur?: string;
    numero?: string;
  } | null;
}

interface OrderKpis {
  total_orders: number;
  pending_orders: number;
  validated_orders: number;
  rejected_orders: number;
  pending_amount: number;
  validated_revenue: number;
  pending_tickets: number;
  validated_tickets: number;
}

const EMPTY_KPIS: OrderKpis = {
  total_orders: 0,
  pending_orders: 0,
  validated_orders: 0,
  rejected_orders: 0,
  pending_amount: 0,
  validated_revenue: 0,
  pending_tickets: 0,
  validated_tickets: 0,
};

function formatAmount(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} Ar`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: PaymentStatus): string {
  if (status === 'validated') return 'Validée';
  if (status === 'rejected') return 'Refusée';
  return 'En attente';
}

function statusClass(status: PaymentStatus): string {
  if (status === 'validated') return 'bg-emerald-100 text-emerald-800';
  if (status === 'rejected') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
}

export default function OrderManagement({ selectedEventId }: { selectedEventId: string | null }) {
  const { session, user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role?.toString().toLowerCase() === 'admin';
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [kpis, setKpis] = useState<OrderKpis>(EMPTY_KPIS);
  const [filter, setFilter] = useState<'all' | PaymentStatus>('pending');
  const [isLoading, setIsLoading] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!selectedEventId || !session?.access_token) return;

    setIsLoading(true);
    try {
      const response = await authAPI.getEventOrders(
        selectedEventId,
        session.access_token,
        filter === 'all' ? 'all' : filter
      );

      if (!response.success) {
        showToast(response.error || 'Impossible de charger les commandes', 'error');
        return;
      }

      setOrders(response.orders || []);
      setKpis(response.kpis || EMPTY_KPIS);
    } catch (error) {
      console.error('OrderManagement loadOrders', error);
      showToast('Impossible de contacter le serveur', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEventId, session?.access_token, filter, showToast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleValidate = async (orderId: string) => {
    if (!session?.access_token) return;
    if (!confirm('Confirmer ce paiement et marquer les billets comme vendus ?')) return;

    setValidatingId(orderId);
    try {
      const response = await authAPI.validateOrder(orderId, session.access_token);
      if (!response.success) {
        showToast(response.error || 'Validation impossible', 'error');
        return;
      }
      showToast('Paiement validé avec succès', 'success');
      await loadOrders();
    } catch (error) {
      console.error('OrderManagement validate', error);
      showToast('Erreur lors de la validation', 'error');
    } finally {
      setValidatingId(null);
    }
  };

  const handleDelete = async (order: OnlineOrder) => {
    if (!session?.access_token) return;

    const message =
      order.payment_status === 'pending'
        ? 'Supprimer cette commande et les billets associés ?'
        : 'Cette commande est déjà validée. Supprimer la commande et retirer définitivement les billets associés ?';

    if (!confirm(message)) return;

    setDeletingId(order.id);
    try {
      const response = await authAPI.deleteOrder(order.id, session.access_token);
      if (!response.success) {
        showToast(response.error || 'Suppression impossible', 'error');
        return;
      }
      showToast('Commande supprimée', 'success');
      await loadOrders();
    } catch (error) {
      console.error('OrderManagement delete', error);
      showToast('Erreur lors de la suppression', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const pendingHighlight = useMemo(
    () => kpis.pending_orders > 0,
    [kpis.pending_orders]
  );

  if (!isAdmin) {
    return <Navigate to="/events" replace />;
  }

  if (!selectedEventId) {
    return (
      <div className="flex-1 overflow-y-auto px-4 md:px-xl pb-xl pt-24 md:pt-28 min-h-screen">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface p-8 text-center text-on-surface-variant">
          Sélectionnez un événement pour consulter les commandes en ligne.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-4 md:px-xl pb-xl pt-24 md:pt-28 min-h-screen space-y-6">
        <div className="rounded-3xl border border-outline-variant/30 bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-bold text-on-surface">Commandes en ligne</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Suivez les achats Mobile Money et validez les paiements pour activer la vente des billets.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 flex items-center justify-between">
            <div>
              <span className="block text-outline text-[10px] uppercase tracking-widest font-semibold">
                En attente
              </span>
              <span className="block text-xl font-bold mt-1">{kpis.pending_orders}</span>
              <span className="block text-xs text-on-surface-variant mt-1">
                {formatAmount(kpis.pending_amount)}
              </span>
            </div>
            <span className="material-symbols-outlined text-amber-600 text-lg bg-amber-100 p-2 rounded-lg">
              hourglass_top
            </span>
          </div>

          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 flex items-center justify-between">
            <div>
              <span className="block text-outline text-[10px] uppercase tracking-widest font-semibold">
                Validées
              </span>
              <span className="block text-xl font-bold mt-1">{kpis.validated_orders}</span>
              <span className="block text-xs text-on-surface-variant mt-1">
                {formatAmount(kpis.validated_revenue)}
              </span>
            </div>
            <span className="material-symbols-outlined text-emerald-600 text-lg bg-emerald-100 p-2 rounded-lg">
              check_circle
            </span>
          </div>

          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 flex items-center justify-between">
            <div>
              <span className="block text-outline text-[10px] uppercase tracking-widest font-semibold">
                Billets en attente
              </span>
              <span className="block text-xl font-bold mt-1">{kpis.pending_tickets}</span>
            </div>
            <span className="material-symbols-outlined text-primary text-lg bg-primary/5 p-2 rounded-lg">
              confirmation_number
            </span>
          </div>

          <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 flex items-center justify-between">
            <div>
              <span className="block text-outline text-[10px] uppercase tracking-widest font-semibold">
                Total commandes
              </span>
              <span className="block text-xl font-bold mt-1">{kpis.total_orders}</span>
            </div>
            <span className="material-symbols-outlined text-secondary text-lg bg-secondary/5 p-2 rounded-lg">
              shopping_cart
            </span>
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-outline-variant/20 pb-4">
            <h3 className="text-lg font-bold text-on-surface">Liste des commandes</h3>
            <div className="flex items-center gap-2 rounded-full border border-outline-variant/40 bg-background p-1">
              {([
                ['pending', 'En attente'],
                ['validated', 'Validées'],
                ['all', 'Toutes'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    filter === value
                      ? 'bg-primary text-white'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {label}
                  {value === 'pending' && pendingHighlight && filter !== 'pending' && (
                    <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/30 bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-container-low text-left text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Acheteur</th>
                    <th className="px-4 py-3 font-semibold">Réf. transaction</th>
                    <th className="px-4 py-3 font-semibold">Montant</th>
                    <th className="px-4 py-3 font-semibold">Billets</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-on-surface-variant">
                        Aucune commande pour ce filtre.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id} className="border-t border-outline-variant/20">
                        <td className="px-4 py-4 whitespace-nowrap">{formatDate(order.created_at)}</td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-on-surface">{order.buyer_name}</div>
                          <div className="text-xs text-on-surface-variant">{order.buyer_phone}</div>
                          {order.buyer_email && (
                            <div className="text-xs text-on-surface-variant">{order.buyer_email}</div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-mono text-xs">{order.transaction_id}</div>
                          {order.payment_method && (
                            <div className="text-xs text-on-surface-variant mt-1">
                              {order.payment_method.Operateur}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 font-semibold whitespace-nowrap">
                          {formatAmount(Number(order.total_amount))}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold">{order.ticket_count} billet(s)</div>
                          <div className="text-xs text-on-surface-variant mt-1 space-y-0.5">
                            {order.tickets.slice(0, 3).map((ticket) => (
                              <div key={ticket.id}>
                                #{ticket.number ?? '—'} · {ticket.ticket_type}
                              </div>
                            ))}
                            {order.tickets.length > 3 && (
                              <div>+{order.tickets.length - 3} autre(s)</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(order.payment_status)}`}
                          >
                            {statusLabel(order.payment_status)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            {order.payment_status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => handleValidate(order.id)}
                                disabled={validatingId === order.id || deletingId === order.id}
                                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-60"
                              >
                                {validatingId === order.id ? (
                                  <>
                                    <span className="material-symbols-outlined text-sm animate-spin">
                                      progress_activity
                                    </span>
                                    Validation...
                                  </>
                                ) : (
                                  <>
                                    <span className="material-symbols-outlined text-sm">verified</span>
                                    Valider
                                  </>
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDelete(order)}
                              disabled={deletingId === order.id || validatingId === order.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                            >
                              {deletingId === order.id ? (
                                <>
                                  <span className="material-symbols-outlined text-sm animate-spin">
                                    progress_activity
                                  </span>
                                  Suppression...
                                </>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                  Supprimer
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {isLoading && <LoadingOverlay message="Chargement des commandes..." />}
    </>
  );
}
