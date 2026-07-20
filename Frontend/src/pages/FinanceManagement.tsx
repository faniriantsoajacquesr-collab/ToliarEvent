import { useEffect, useMemo, useState } from 'react';
import JournalTAccount from '../components/JournalTAccount';
import type { Transaction } from '../components/JournalTAccount';
import LoadingOverlay from '../components/LoadingOverlay';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';

interface FinanceStats {
  totalBudget: number;
  totalExpenses: number;
  netProfit: number;
}

interface EventOption {
  id: string;
  name?: string;
  title?: string;
}

interface CategoryOption {
  id?: string;
  title: string;
  type: 'entree' | 'sortie';
  pcg?: string | null;
}

interface FinanceFormState {
  id?: string;
  event_id: string;
  date: string;
  title: string;
  description: string;
  amount: string;
  category: string;
  categoryId: string;
  type: 'expense' | 'revenue';
}

const emptyForm = (type: 'expense' | 'revenue', eventId: string): FinanceFormState => ({
  event_id: eventId,
  date: new Date().toISOString().split('T')[0],
  title: '',
  description: '',
  amount: '',
  category: '',
  categoryId: '',
  type,
});

type FinanceTransaction = Transaction & { categoryId: string };

function formatAmount(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} Ar`;
}

const mapTransaction = (item: any): FinanceTransaction => ({
  id: String(item.id),
  date: item.date ? new Date(item.date).toLocaleDateString('fr-FR') : '',
  title: item.title || item.label || item.description || 'Sans libellé',
  description: item.description || '',
  category: item.category?.title || item.category || 'Divers',
  categoryId: item.category?.id ? String(item.category.id) : String(item.category || ''),
  categoryColor: item.type === 'entree' ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-700',
  amount: Number(item.amount || 0),
  type: item.type === 'entree' ? 'revenue' : 'expense',
});

export default function FinanceManagement() {
  const { session, user } = useAuth();
  const isStaffUser = user?.role?.toString().toLowerCase() === 'staff';
  const [expenses, setExpenses] = useState<FinanceTransaction[]>([]);
  const [revenues, setRevenues] = useState<FinanceTransaction[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState<FinanceFormState>(emptyForm('expense', ''));
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFinanceData = async (eventId = selectedEventId) => {
    const token = session?.access_token;
    if (!token || !organizationId) return;

    setIsLoading(true);
    try {
      const [eventsRes, transactionsRes] = await Promise.all([
        authAPI.getEvents(organizationId, token),
        authAPI.getTransactions(organizationId, eventId || null, token),
      ]);

      const eventList = Array.isArray(eventsRes?.events) ? eventsRes.events : [];
      setEvents(eventList);
      if (!eventId && eventList[0]?.id) {
        setSelectedEventId(eventList[0].id);
      }

      const transactionList = Array.isArray(transactionsRes?.transactions) ? transactionsRes.transactions : [];
      const mapped: FinanceTransaction[] = transactionList.map(mapTransaction);
      setExpenses(mapped.filter((tx) => tx.type === 'expense'));
      setRevenues(mapped.filter((tx) => tx.type === 'revenue'));
    } catch (err) {
      console.error('Finance load failed', err);
      setErrorMessage('Impossible de charger les transactions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const token = session?.access_token;
      if (!token) return;

      try {
        const orgRes = await authAPI.getMyOrganization(token);
        const currentOrganizationId = orgRes?.organization?.id || orgRes?.organization_id || null;
        setOrganizationId(currentOrganizationId);
        if (currentOrganizationId) {
          await loadFinanceData('');
        }
      } catch (err) {
        console.error('Organization load failed', err);
      }
    };

    initialize();
  }, [session?.access_token]);

  useEffect(() => {
    if (organizationId) {
      loadFinanceData(selectedEventId);
    }
  }, [organizationId, selectedEventId]);

  const loadCategories = async (type: 'expense' | 'revenue') => {
    const token = session?.access_token;
    if (!token) return;

    const backendType = type === 'revenue' ? 'entree' : 'sortie';
    const response = await authAPI.getTransactionCategories(backendType, token);
    const categoryList = Array.isArray(response?.categories) ? response.categories : [];
    setCategories(categoryList);
  };

  const openModal = async (type: 'expense' | 'revenue', transaction?: FinanceTransaction) => {
    const nextEventId = selectedEventId || events[0]?.id || '';
    if (!nextEventId) return;

    setIsEditing(Boolean(transaction));
    setFormState({
      id: transaction?.id,
      event_id: nextEventId,
      date: transaction?.date ? new Date(transaction.date.split('/').reverse().join('-')).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      title: transaction?.title || transaction?.description || '',
      description: transaction?.description || '',
      amount: transaction?.amount?.toString() || '',
      category: transaction?.category || '',
      categoryId: transaction?.categoryId || '',
      type,
    });

    await loadCategories(type);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setFormState(emptyForm('expense', selectedEventId || events[0]?.id || ''));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = session?.access_token;
    if (!token || !organizationId || !formState.event_id) return;

    setSubmitting(true);
    setErrorMessage(null);

    const payload = {
      event_id: formState.event_id,
      date: formState.date,
      title: formState.title,
      description: formState.description || null,
      amount: Number(formState.amount),
      category_id: formState.categoryId ? Number(formState.categoryId) : undefined,
      type: formState.type === 'revenue' ? 'entree' : 'sortie',
      organization_id: organizationId,
    };

    try {
      const response = isEditing && formState.id
        ? await authAPI.updateTransaction(formState.id, payload, token)
        : await authAPI.createTransaction(payload, token);

      if (response?.success) {
        await loadFinanceData(formState.event_id);
        closeModal();
      } else {
        setErrorMessage(response?.error || 'Enregistrement impossible');
      }
    } catch (err) {
      console.error('Transaction save failed', err);
      setErrorMessage('Échec de l’enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    const token = session?.access_token;
    if (!token || !window.confirm('Supprimer cette transaction ?')) return;

    const response = await authAPI.deleteTransaction(id, token);
    if (response?.success) {
      await loadFinanceData(selectedEventId || '');
    }
  };

  const stats: FinanceStats = useMemo(() => {
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
    const totalRevenues = revenues.reduce((sum, item) => sum + item.amount, 0);
    return {
      totalBudget: totalRevenues + totalExpenses,
      totalExpenses,
      netProfit: totalRevenues - totalExpenses,
    };
  }, [expenses, revenues]);

  return (
    <>
      <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-lg pt-28 min-h-screen">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-lg mb-xl">
          <div className="glass-card p-lg rounded-xl shadow-sm border border-outline-variant flex flex-col justify-between h-32 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <span className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">Budget Total</span>
              <div className="p-2 bg-primary-fixed text-primary rounded-lg">
                <span className="material-symbols-outlined">account_balance_wallet</span>
              </div>
            </div>
            <div className="text-headline-lg font-headline-lg text-on-surface">
              {formatAmount(stats.totalBudget)}
            </div>
          </div>

          <div className="glass-card p-lg rounded-xl shadow-sm border border-outline-variant flex flex-col justify-between h-32 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <span className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">Total Dépenses</span>
              <div className="p-2 bg-error-container text-error rounded-lg">
                <span className="material-symbols-outlined">trending_down</span>
              </div>
            </div>
            <div className="text-headline-lg font-headline-lg text-on-surface">
              {formatAmount(stats.totalExpenses)}
            </div>
          </div>

          <div className="glass-card p-lg rounded-xl shadow-sm border border-outline-variant flex flex-col justify-between h-32 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <span className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">Bénéfice Net</span>
              <div className="p-2 bg-green-100 text-green-700 rounded-lg">
                <span className="material-symbols-outlined">payments</span>
              </div>
            </div>
            <div className={`text-headline-lg font-headline-lg ${stats.netProfit >= 0 ? 'text-green-600' : 'text-error'}`}>
              {stats.netProfit >= 0 ? '+' : ''}{formatAmount(stats.netProfit)}
            </div>
          </div>
        </section>

        <div className="mb-lg flex items-center gap-md">
          <label className="text-sm font-medium text-on-surface-variant">Événement</label>
          <select
            value={selectedEventId}
            onChange={(event) => setSelectedEventId(event.target.value)}
            className="rounded-lg border border-outline-variant bg-white px-md py-sm"
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.name || event.title || event.id}</option>
            ))}
          </select>
        </div>

        {errorMessage ? <div className="mb-md rounded-lg bg-error-container px-md py-sm text-sm text-error">{errorMessage}</div> : null}

        {isLoading && <LoadingOverlay message="Chargement des transactions..." />}
        {!isLoading && (
          <JournalTAccount
            expenses={expenses}
            revenues={revenues}
            onAddExpense={!isStaffUser ? () => openModal('expense') : undefined}
            onAddRevenue={!isStaffUser ? () => openModal('revenue') : undefined}
            onEditTransaction={!isStaffUser ? (transaction) => openModal(transaction.type === 'revenue' ? 'revenue' : 'expense', transaction) : undefined}
            onDeleteTransaction={!isStaffUser ? handleDelete : undefined}
          />
        )}
      </main>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-lg">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-lg shadow-xl">
            <div className="mb-lg flex items-center justify-between">
              <h3 className="text-headline-md font-headline-md text-on-surface">
                {isEditing ? 'Modifier la transaction' : 'Ajouter une transaction'}
              </h3>
              <button type="button" className="text-sm text-on-surface-variant" onClick={closeModal}>Fermer</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-md">
              <div className="grid gap-md md:grid-cols-2">
                <label className="flex flex-col gap-xs text-sm text-on-surface-variant">
                  Type
                  <div className="flex gap-sm">
                    <button
                      type="button"
                      className={`rounded-lg border px-md py-sm ${formState.type === 'expense' ? 'border-error bg-error-container text-error' : 'border-outline-variant bg-white'}`}
                      onClick={() => {
                        setFormState((prev) => ({ ...prev, type: 'expense' }));
                        loadCategories('expense');
                      }}
                    >
                      Dépense
                    </button>
                    <button
                      type="button"
                      className={`rounded-lg border px-md py-sm ${formState.type === 'revenue' ? 'border-green-600 bg-green-50 text-green-700' : 'border-outline-variant bg-white'}`}
                      onClick={() => {
                        setFormState((prev) => ({ ...prev, type: 'revenue' }));
                        loadCategories('revenue');
                      }}
                    >
                      Recette
                    </button>
                  </div>
                </label>

                <label className="flex flex-col gap-xs text-sm text-on-surface-variant">
                  Événement
                  <select
                    value={formState.event_id}
                    onChange={(event) => setFormState((prev) => ({ ...prev, event_id: event.target.value }))}
                    className="rounded-lg border border-outline-variant bg-white px-md py-sm"
                  >
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>{event.name || event.title || event.id}</option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-xs text-sm text-on-surface-variant">
                  Date
                  <input
                    type="date"
                    value={formState.date}
                    onChange={(event) => setFormState((prev) => ({ ...prev, date: event.target.value }))}
                    className="rounded-lg border border-outline-variant bg-white px-md py-sm"
                    required
                  />
                </label>

                <label className="flex flex-col gap-xs text-sm text-on-surface-variant">
                  Montant (Ar)
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formState.amount}
                    onChange={(event) => setFormState((prev) => ({ ...prev, amount: event.target.value }))}
                    className="rounded-lg border border-outline-variant bg-white px-md py-sm"
                    required
                  />
                </label>

                <label className="flex flex-col gap-xs text-sm text-on-surface-variant">
                  Titre
                  <input
                    type="text"
                    value={formState.title}
                    onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                    className="rounded-lg border border-outline-variant bg-white px-md py-sm"
                    placeholder="Ex: Location de matériel"
                    required
                  />
                </label>

                <label className="flex flex-col gap-xs text-sm text-on-surface-variant">
                  Description
                  <textarea
                    value={formState.description}
                    onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                    className="min-h-[104px] rounded-lg border border-outline-variant bg-white px-md py-sm"
                    placeholder="Détails supplémentaires (optionnel)"
                  />
                </label>

                <label className="flex flex-col gap-xs text-sm text-on-surface-variant">
                  Catégorie
                  <select
                    value={formState.categoryId}
                    onChange={(event) => {
                      const selectedId = event.target.value;
                      const selected = categories.find((category) => String(category.id) === selectedId);
                      setFormState((prev) => ({
                        ...prev,
                        categoryId: selectedId,
                        category: selected?.title || '',
                      }));
                    }}
                    className="rounded-lg border border-outline-variant bg-white px-md py-sm"
                    required
                  >
                    <option value="">Sélectionner</option>
                    {categories.map((category) => (
                      <option
                        key={category.id ? String(category.id) : `${category.title}-${category.type}`}
                        value={category.id ? String(category.id) : category.title}
                      >
                        {category.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex justify-end gap-md">
                <button type="button" className="rounded-lg border border-outline-variant px-md py-sm text-on-surface-variant" onClick={closeModal}>
                  Annuler
                </button>
                <button type="submit" className="rounded-lg bg-primary px-md py-sm text-white" disabled={submitting}>
                  {submitting ? 'Enregistrement…' : isEditing ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
