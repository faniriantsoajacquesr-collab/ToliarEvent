import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { TablePageSkeleton } from '../components/skeleton';
import AppPageHeader from '../components/AppPageHeader';
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
  payment_provider?: string;
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
  if (status === 'validated') {
    return 'dash-status-badge bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20';
  }
  if (status === 'rejected') {
    return 'dash-status-badge bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20';
  }
  return 'dash-status-badge bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20';
}

const FILTER_OPTIONS: Array<{ value: 'all' | PaymentStatus; label: string }> = [
  { value: 'pending', label: 'En attente' },
  { value: 'validated', label: 'Validées' },
  { value: 'rejected', label: 'Refusées' },
  { value: 'all', label: 'Toutes' },
];

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

  const selectableOrders = orders.filter(order => order.payment_provider !== 'papi');
  const allSelected = selectableOrders.length > 0 && selectableOrders.every((order) => selectedOrderIds.has(order.id));
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
      setSelectedOrderIds(new Set(orders.filter(order => order.payment_provider !== 'papi').map((order) => order.id)));
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
      <main className="dash-page flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-screen">
        <div className="relative z-10 max-w-container-max mx-auto px-gutter pb-12 pt-24 md:pt-28">
          <div className="dash-empty-state">
            <span className="material-symbols-outlined text-4xl text-primary/70 mb-3">shopping_cart</span>
            <p className="font-landing-display text-lg app-heading mb-1">Aucun événement sélectionné</p>
            <p className="text-sm app-text-muted">
              Sélectionnez un événement pour consulter les commandes en ligne.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="dash-page flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-screen">
        <div className="relative z-10 max-w-container-max mx-auto px-gutter pb-12 pt-24 md:pt-28">
          <TablePageSkeleton rows={6} kpiCount={4} showFilters />
        </div>
      </main>
    );
  }

  return (
    <main className="dash-page flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-screen">
      <div className="relative z-10 max-w-container-max mx-auto px-gutter pb-12 pt-24 md:pt-28 space-y-8">
        <AppPageHeader
          title="Commandes en ligne"
          subtitle="Suivez les achats confirmés par Papi et gérez les anciennes commandes à validation manuelle."
        />

        <section>
          <p className="landing-eyebrow mb-4">Vue d&apos;ensemble</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="dash-stat-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="dash-stat-label mb-1">En attente</p>
                  <p className="dash-stat-value">{kpis.pending_orders.toLocaleString('fr-FR')}</p>
                  <p className="text-xs app-text-muted mt-1">{formatAmount(kpis.pending_amount)}</p>
                </div>
                <span className="material-symbols-outlined text-2xl text-amber-500 opacity-80">hourglass_top</span>
              </div>
            </div>
            <div className="dash-stat-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="dash-stat-label mb-1">Validées</p>
                  <p className="dash-stat-value">{kpis.validated_orders.toLocaleString('fr-FR')}</p>
                  <p className="text-xs app-text-muted mt-1">{formatAmount(kpis.validated_revenue)}</p>
                </div>
                <span className="material-symbols-outlined text-2xl text-emerald-500 opacity-80">check_circle</span>
              </div>
            </div>
            <div className="dash-stat-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="dash-stat-label mb-1">Billets en attente</p>
                  <p className="dash-stat-value">{kpis.pending_tickets.toLocaleString('fr-FR')}</p>
                </div>
                <span className="material-symbols-outlined text-2xl text-primary opacity-80">confirmation_number</span>
              </div>
            </div>
            <div className="dash-stat-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="dash-stat-label mb-1">Total commandes</p>
                  <p className="dash-stat-value">{kpis.total_orders.toLocaleString('fr-FR')}</p>
                </div>
                <span className="material-symbols-outlined text-2xl text-indigo-500 opacity-80">shopping_cart</span>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="landing-eyebrow mb-2">Registre</p>
              <div className="flex items-center gap-2">
                <h2 className="font-landing-display text-xl app-heading">Liste des commandes</h2>
                {pendingHighlight && filter !== 'pending' && (
                  <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" title="Commandes en attente" />
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={`landing-chip ${filter === option.value ? 'landing-chip--active' : ''}`}
                >
                  {option.label}
                  {option.value === 'pending' && kpis.pending_orders > 0 && (
                    <span className="ml-1 opacity-80">({kpis.pending_orders})</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {selectedOrderIds.size > 0 && (
            <div className="dash-actions-panel !py-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-sm font-semibold app-heading">
                  {selectedOrderIds.size} commande{selectedOrderIds.size > 1 ? 's' : ''} sélectionnée{selectedOrderIds.size > 1 ? 's' : ''}
                  {selectedPendingCount > 0 && ` · ${selectedPendingCount} en attente`}
                  {selectedValidatedCount > 0 && ` · ${selectedValidatedCount} validée${selectedValidatedCount > 1 ? 's' : ''}`}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOrderIds(new Set())}
                    disabled={isBulkProcessing}
                    className="landing-chip disabled:opacity-50"
                  >
                    Désélectionner
                  </button>
                  {selectedPendingCount > 0 && (
                    <button
                      type="button"
                      onClick={handleBulkValidate}
                      disabled={isBulkProcessing}
                      className="landing-chip landing-chip--active disabled:opacity-50"
                    >
                      {isBulkProcessing ? 'Traitement…' : 'Valider la sélection'}
                    </button>
                  )}
                  {selectedValidatedCount > 0 && (
                    <button
                      type="button"
                      onClick={handleBulkDevalidate}
                      disabled={isBulkProcessing}
                      className="landing-chip border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 disabled:opacity-50"
                    >
                      {isBulkProcessing ? 'Traitement…' : 'Dévalider la sélection'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={isBulkProcessing}
                    className="landing-chip border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400 disabled:opacity-50"
                  >
                    Supprimer la sélection
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="app-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-max text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--md-border)] bg-[var(--md-surface-muted)]">
                    <th className="px-4 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected && !allSelected;
                        }}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-[var(--md-border)] text-primary focus:ring-primary/30 cursor-pointer accent-[var(--landing-primary)]"
                        aria-label="Tout sélectionner"
                      />
                    </th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">Date</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">Acheteur</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">Réf. transaction</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">Montant</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">Billets</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">Statut</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider app-text-muted">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--md-border)]">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-14 text-center">
                        <div className="dash-empty-state !p-8 !max-w-sm">
                          <span className="material-symbols-outlined text-3xl app-text-muted mb-2">inbox</span>
                          <p className="text-sm app-text-muted">Aucune commande pour ce filtre.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr
                        key={order.id}
                        className={`hover:bg-[var(--md-surface-muted)]/60 transition-colors ${
                          selectedOrderIds.has(order.id) ? 'bg-primary/5' : ''
                        }`}
                      >
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.has(order.id)}
                            disabled={order.payment_provider === 'papi'}
                            onChange={() => toggleSelectOne(order.id)}
                            className="h-4 w-4 rounded border-[var(--md-border)] text-primary focus:ring-primary/30 cursor-pointer accent-[var(--landing-primary)]"
                            aria-label={`Sélectionner commande ${order.transaction_id}`}
                          />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-sm app-text-muted">{formatDate(order.created_at)}</td>
                        <td className="px-5 py-4">
                          <div className="font-semibold app-heading">{order.buyer_name}</div>
                          <div className="text-xs app-text-muted mt-0.5">{order.buyer_phone}</div>
                          {order.buyer_email && (
                            <div className="text-xs app-text-muted">{order.buyer_email}</div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-mono text-xs app-heading">{order.transaction_id}</div>
                          {order.payment_provider === 'papi' && <div className="mt-1 text-xs text-emerald-600">Papi · confirmation automatique</div>}
                          {order.payment_method && (
                            <div className="text-xs app-text-muted mt-1">{order.payment_method.Operateur}</div>
                          )}
                        </td>
                        <td className="px-5 py-4 font-semibold whitespace-nowrap app-heading">
                          {formatAmount(Number(order.total_amount))}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-sm app-heading">{order.ticket_count} billet(s)</div>
                          <div className="text-xs app-text-muted mt-1 space-y-0.5">
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
                        <td className="px-5 py-4">
                          <span className={statusClass(order.payment_status)}>
                            {statusLabel(order.payment_status)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="dash-action-group w-fit">
                            {order.payment_status === 'pending' && (
                              <button
                                type="button"
                                title="Valider le paiement"
                                onClick={() => handleValidate(order.id)}
                                disabled={validatingId === order.id || deletingId === order.id || isBulkProcessing}
                                className="dash-action-btn dash-action-btn--primary disabled:opacity-50"
                              >
                                {validatingId === order.id ? (
                                  <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                                ) : (
                                  <span className="material-symbols-outlined text-lg">verified</span>
                                )}
                              </button>
                            )}
                            {order.payment_status === 'validated' && order.payment_provider !== 'papi' && (
                              <button
                                type="button"
                                title="Dévalider"
                                onClick={() => handleDevalidate(order.id)}
                                disabled={devalidatingId === order.id || deletingId === order.id || validatingId === order.id || isBulkProcessing}
                                className="dash-action-btn disabled:opacity-50 text-amber-600 hover:bg-amber-500/10"
                              >
                                {devalidatingId === order.id ? (
                                  <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                                ) : (
                                  <span className="material-symbols-outlined text-lg">undo</span>
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              title="Supprimer"
                              onClick={() => handleDelete(order)}
                              disabled={order.payment_provider === 'papi' || deletingId === order.id || validatingId === order.id || devalidatingId === order.id || isBulkProcessing}
                              className="dash-action-btn dash-action-btn--danger disabled:opacity-50"
                            >
                              {deletingId === order.id ? (
                                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                              ) : (
                                <span className="material-symbols-outlined text-lg">delete</span>
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
            <div className="px-5 py-3 border-t border-[var(--md-border)] bg-[var(--md-surface-muted)] text-xs app-text-muted flex flex-wrap items-center justify-between gap-2">
              <span>
                {orders.length === 0
                  ? 'Aucune commande affichée'
                  : `${orders.length} commande${orders.length > 1 ? 's' : ''} affichée${orders.length > 1 ? 's' : ''}`}
              </span>
              {selectedOrderIds.size > 0 && (
                <span className="font-medium text-primary">
                  {selectedOrderIds.size} sélectionnée{selectedOrderIds.size > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
