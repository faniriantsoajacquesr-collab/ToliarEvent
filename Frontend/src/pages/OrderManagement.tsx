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
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [devalidatingId, setDevalidatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

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
      setSelectedOrderIds(new Set());
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

  const allSelected = orders.length > 0 && orders.every((order) => selectedOrderIds.has(order.id));
  const someSelected = orders.some((order) => selectedOrderIds.has(order.id));
  const selectedPendingCount = Array.from(selectedOrderIds).filter((id) => {
    const order = orders.find((o) => o.id === id);
    return order?.payment_status === 'pending';
  }).length;
  const selectedValidatedCount = Array.from(selectedOrderIds).filter((id) => {
    const order = orders.find((o) => o.id === id);
    return order?.payment_status === 'validated';
  }).length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(orders.map((order) => order.id)));
    }
  };

  const toggleSelectOne = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

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

  const handleBulkValidate = async () => {
    if (!session?.access_token) return;
    const pendingIds = Array.from(selectedOrderIds).filter((id) => {
      const order = orders.find((o) => o.id === id);
      return order?.payment_status === 'pending';
    });

    if (pendingIds.length === 0) {
      showToast('Sélectionnez au moins une commande en attente à valider.', 'error');
      return;
    }

    if (!confirm(`Valider ${pendingIds.length} commande${pendingIds.length > 1 ? 's' : ''} en attente ?`)) return;

    setIsBulkProcessing(true);
    try {
      const response = await authAPI.bulkValidateOrders(pendingIds, session.access_token);
      if (!response.success && !response.validated_count) {
        showToast(response.error || 'Validation groupée impossible', 'error');
        return;
      }
      showToast(response.message || 'Commandes validées avec succès', 'success');
      await loadOrders();
    } catch (error) {
      console.error('OrderManagement bulk validate', error);
      showToast('Erreur lors de la validation groupée', 'error');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleDevalidate = async (orderId: string) => {
    if (!session?.access_token) return;
    if (!confirm('Dévalider cette commande et remettre les billets en statut valide ?')) return;

    setDevalidatingId(orderId);
    try {
      const response = await authAPI.devalidateOrder(orderId, session.access_token);
      if (!response.success) {
        showToast(response.error || 'Dévalidation impossible', 'error');
        return;
      }
      showToast(response.message || 'Commande dévalidée avec succès', 'success');
      await loadOrders();
    } catch (error) {
      console.error('OrderManagement devalidate', error);
      showToast('Erreur lors de la dévalidation', 'error');
    } finally {
      setDevalidatingId(null);
    }
  };

  const handleBulkDevalidate = async () => {
    if (!session?.access_token) return;
    const validatedIds = Array.from(selectedOrderIds).filter((id) => {
      const order = orders.find((o) => o.id === id);
      return order?.payment_status === 'validated';
    });

    if (validatedIds.length === 0) {
      showToast('Sélectionnez au moins une commande validée à dévalider.', 'error');
      return;
    }

    if (!confirm(`Dévalider ${validatedIds.length} commande${validatedIds.length > 1 ? 's' : ''} validée${validatedIds.length > 1 ? 's' : ''} ?`)) return;

    setIsBulkProcessing(true);
    try {
      const response = await authAPI.bulkDevalidateOrders(validatedIds, session.access_token);
      if (!response.success && !response.devalidated_count) {
        showToast(response.error || 'Dévalidation groupée impossible', 'error');
        return;
      }
      showToast(response.message || 'Commandes dévalidées avec succès', 'success');
      await loadOrders();
    } catch (error) {
      console.error('OrderManagement bulk devalidate', error);
      showToast('Erreur lors de la dévalidation groupée', 'error');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!session?.access_token) return;
    const ids = Array.from(selectedOrderIds);
    if (ids.length === 0) return;

    if (!confirm(`Supprimer ${ids.length} commande${ids.length > 1 ? 's' : ''} sélectionnée${ids.length > 1 ? 's' : ''} ?`)) return;

    setIsBulkProcessing(true);
    try {
      const response = await authAPI.bulkDeleteOrders(ids, session.access_token);
      if (!response.success && !response.deleted_count) {
        showToast(response.error || 'Suppression groupée impossible', 'error');
        return;
      }
      showToast(response.message || 'Commandes supprimées avec succès', 'success');
      await loadOrders();
    } catch (error) {
      console.error('OrderManagement bulk delete', error);
      showToast('Erreur lors de la suppression groupée', 'error');
    } finally {
      setIsBulkProcessing(false);
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
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-on-surface">Liste des commandes</h3>
              {pendingHighlight && filter !== 'pending' && (
                <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" title="Commandes en attente" />
              )}
            </div>
            <div className="relative w-full sm:w-56">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-md">
                filter_list
              </span>
              <select
                className="w-full pl-9 pr-8 py-2 bg-white border border-outline-variant/50 rounded-xl text-xs font-semibold appearance-none focus:border-primary focus:outline-none transition-all text-on-surface"
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
              >
                <option value="pending">En attente</option>
                <option value="validated">Validées</option>
                <option value="rejected">Refusées</option>
                <option value="all">Toutes</option>
              </select>
            </div>
          </div>

          {selectedOrderIds.size > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <span className="text-sm font-medium text-primary">
                {selectedOrderIds.size} commande{selectedOrderIds.size > 1 ? 's' : ''} sélectionnée{selectedOrderIds.size > 1 ? 's' : ''}
                {selectedPendingCount > 0 && ` · ${selectedPendingCount} en attente`}
                {selectedValidatedCount > 0 && ` · ${selectedValidatedCount} validée${selectedValidatedCount > 1 ? 's' : ''}`}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrderIds(new Set())}
                  disabled={isBulkProcessing}
                  className="rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition disabled:opacity-50"
                >
                  Désélectionner
                </button>
                {selectedPendingCount > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkValidate}
                    disabled={isBulkProcessing}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition disabled:opacity-50"
                  >
                    {isBulkProcessing ? 'Traitement...' : 'Valider la sélection'}
                  </button>
                )}
                {selectedValidatedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkDevalidate}
                    disabled={isBulkProcessing}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition disabled:opacity-50"
                  >
                    {isBulkProcessing ? 'Traitement...' : 'Dévalider la sélection'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={isBulkProcessing}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
                >
                  Supprimer la sélection
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-outline-variant/30 bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-container-low text-left text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3 w-10">
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
                      <td colSpan={8} className="px-4 py-10 text-center text-on-surface-variant">
                        Aucune commande pour ce filtre.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr
                        key={order.id}
                        className={`border-t border-outline-variant/20 ${
                          selectedOrderIds.has(order.id) ? 'bg-primary/5' : ''
                        }`}
                      >
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.has(order.id)}
                            onChange={() => toggleSelectOne(order.id)}
                            className="h-4 w-4 rounded border-outline-variant/50 text-primary focus:ring-primary/30 cursor-pointer"
                            aria-label={`Sélectionner commande ${order.transaction_id}`}
                          />
                        </td>
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
                                disabled={validatingId === order.id || deletingId === order.id || isBulkProcessing}
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
                            {order.payment_status === 'validated' && (
                              <button
                                type="button"
                                onClick={() => handleDevalidate(order.id)}
                                disabled={devalidatingId === order.id || deletingId === order.id || validatingId === order.id || isBulkProcessing}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                              >
                                {devalidatingId === order.id ? (
                                  <>
                                    <span className="material-symbols-outlined text-sm animate-spin">
                                      progress_activity
                                    </span>
                                    Dévalidation...
                                  </>
                                ) : (
                                  <>
                                    <span className="material-symbols-outlined text-sm">undo</span>
                                    Dévalider
                                  </>
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDelete(order)}
                              disabled={deletingId === order.id || validatingId === order.id || devalidatingId === order.id || isBulkProcessing}
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
            <div className="px-4 py-3 bg-surface-container-low border-t border-outline-variant/30 text-xs text-on-surface-variant">
              {orders.length === 0
                ? 'Aucune commande affichée'
                : `${orders.length} commande${orders.length > 1 ? 's' : ''} affichée${orders.length > 1 ? 's' : ''}`}
              {selectedOrderIds.size > 0 && ` · ${selectedOrderIds.size} sélectionnée${selectedOrderIds.size > 1 ? 's' : ''}`}
            </div>
          </div>
        </section>
      </div>

      {isLoading && <LoadingOverlay message="Chargement des commandes..." />}
    </>
  );
}
