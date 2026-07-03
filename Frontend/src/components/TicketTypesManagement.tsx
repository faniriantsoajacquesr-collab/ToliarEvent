import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/authAPI';

type CurrencyOption = 'Ar' | '€' | '$' | 'FCFA';

type TicketType = {
  id: string;
  name: string;
  price: number;
  currency: CurrencyOption;
  benefits: string[];
};

type TicketTypeForm = {
  name: string;
  price: string;
  currency: CurrencyOption;
  benefits: string[];
};

const CURRENCY_OPTIONS: CurrencyOption[] = ['Ar', '€', '$', 'FCFA'];

function parseBenefits(benefits: unknown): string[] {
  if (!benefits) return [];
  if (Array.isArray(benefits)) return benefits.filter((item) => typeof item === 'string');
  if (typeof benefits === 'string') {
    try {
      const parsed = JSON.parse(benefits);
      if (Array.isArray(parsed)) return parsed.filter((item) => typeof item === 'string');
      return [benefits];
    } catch {
      return [benefits];
    }
  }
  return [];
}

function mapTicketTypeFromApi(raw: Record<string, unknown>): TicketType {
  return {
    id: String(raw.id),
    name: String(raw.name || ''),
    price: Number(raw.price ?? 0),
    currency: (raw.currency || 'Ar') as CurrencyOption,
    benefits: parseBenefits(raw.benefits),
  };
}

function formatPrice(price: number, currency: CurrencyOption) {
  return `${price.toLocaleString('fr-FR')} ${currency}`;
}

export default function TicketTypesManagement({ selectedEventId }: { selectedEventId: string | null }) {
  const { session } = useAuth();
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<TicketTypeForm>({
    name: '',
    price: '0',
    currency: 'Ar',
    benefits: [''],
  });

  const editingTicket = useMemo(
    () => ticketTypes.find((ticket) => ticket.id === editingId) ?? null,
    [editingId, ticketTypes]
  );

  useEffect(() => {
    const loadTicketTypes = async () => {
      if (!selectedEventId || !session?.access_token) {
        setTicketTypes([]);
        setFetchError(null);
        return;
      }

      setIsLoading(true);
      setFetchError(null);

      try {
        const result = await authAPI.getTicketTypes(selectedEventId, session.access_token);
        if (result.success) {
          setTicketTypes((result.ticket_types || []).map(mapTicketTypeFromApi));
        } else {
          setTicketTypes([]);
          setFetchError(result.error || 'Impossible de charger les types de billets.');
        }
      } catch (error) {
        console.error('Erreur fetch ticket types:', error);
        setTicketTypes([]);
        setFetchError('Impossible de contacter le serveur.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTicketTypes();
  }, [selectedEventId, session?.access_token]);

  const openForm = (ticket?: TicketType) => {
    if (ticket) {
      setEditingId(ticket.id);
      setFormState({
        name: ticket.name,
        price: String(ticket.price),
        currency: ticket.currency,
        benefits: ticket.benefits.length > 0 ? ticket.benefits : [''],
      });
    } else {
      setEditingId(null);
      setFormState({
        name: '',
        price: '0',
        currency: 'Ar',
        benefits: [''],
      });
    }
    setFormError(null);
    setIsPanelOpen(true);
  };

  const closeForm = () => {
    setIsPanelOpen(false);
    setEditingId(null);
    setFormError(null);
  };

  const updateBenefit = (index: number, value: string) => {
    setFormState((prev) => {
      const next = [...prev.benefits];
      next[index] = value;
      return { ...prev, benefits: next };
    });
  };

  const addBenefit = () => {
    setFormState((prev) => ({ ...prev, benefits: [...prev.benefits, ''] }));
  };

  const removeBenefit = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      benefits: prev.benefits.filter((_, idx) => idx !== index),
    }));
  };

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedEventId || !session?.access_token) {
      setFormError('Événement ou session invalide.');
      return;
    }

    const name = formState.name.trim();
    const price = Number(formState.price);
    const benefits = formState.benefits.map((item) => item.trim()).filter(Boolean);

    if (!name || Number.isNaN(price) || price < 0) {
      setFormError('Nom et prix valides requis.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const payload = {
        name,
        price,
        currency: formState.currency,
        benefits,
      };

      const result = editingId
        ? await authAPI.updateTicketType(editingId, payload, session.access_token)
        : await authAPI.createTicketType(selectedEventId, payload, session.access_token);

      if (!result.success) {
        setFormError(result.error || 'Enregistrement impossible.');
        return;
      }

      const saved = mapTicketTypeFromApi(result.ticket_type || {});
      setTicketTypes((prev) => {
        if (editingId) {
          return prev.map((item) => (item.id === editingId ? saved : item));
        }
        return [saved, ...prev];
      });
      closeForm();
    } catch (error) {
      console.error('Erreur save ticket type:', error);
      setFormError('Impossible de contacter le serveur.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer ce type de billet ?')) return;
    if (!session?.access_token) return;

    try {
      const result = await authAPI.deleteTicketType(id, session.access_token);
      if (!result.success) {
        setFetchError(result.error || 'Suppression impossible.');
        return;
      }
      setTicketTypes((prev) => prev.filter((ticket) => ticket.id !== id));
    } catch (error) {
      console.error('Erreur delete ticket type:', error);
      setFetchError('Impossible de contacter le serveur.');
    }
  };

  const availableTypes = ticketTypes.length;

  return (
    <div className="space-y-6 rounded-3xl border border-outline-variant/40 bg-surface p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-on-surface-variant">Configuration des Tarifs</p>
          <h2 className="text-2xl font-semibold text-on-surface">Gestion des catégories et prix de billets</h2>
          <p className="max-w-2xl text-sm leading-6 text-on-surface-variant">
            Définissez les formules tarifaires de votre événement et gérez les avantages pour chaque type de billet.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openForm()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary/90"
        >
          <span className="material-symbols-outlined">add</span>
          Ajouter un type
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full rounded-3xl border border-outline-variant/60 bg-white/80 p-10 text-center text-sm text-on-surface-variant">
            Chargement des types de billets...
          </div>
        ) : fetchError ? (
          <div className="col-span-full rounded-3xl border border-outline-variant/60 bg-white/80 p-10 text-center text-sm text-red-600">
            {fetchError}
          </div>
        ) : ticketTypes.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-outline-variant/60 bg-white/80 p-10 text-center text-sm text-on-surface-variant">
            Aucun type de billet trouvé pour cet événement.
          </div>
        ) : (
          ticketTypes.map((ticket) => (
            <div key={ticket.id} className="group overflow-hidden rounded-3xl border border-outline-variant/60 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-on-surface">{ticket.name}</h3>
                <p className="mt-2 text-sm text-on-surface-variant">{formatPrice(ticket.price, ticket.currency)}</p>
              </div>

              <div className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                <span className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Avantages</span>
                <ul className="mt-3 space-y-2">
                  {ticket.benefits.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-on-surface">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-outline-variant/50 pt-4">
                <button
                  type="button"
                  onClick={() => openForm(ticket)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(ticket.id)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-outline-variant/80 bg-surface px-3 py-2 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-high"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                  Supprimer
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-3xl border border-outline-variant/50 bg-surface-container-low p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-on-surface">{availableTypes} types de billets actifs</p>
            <p className="text-sm text-on-surface-variant">Vous pouvez modifier ou ajouter une nouvelle configuration de tarif depuis ce tableau.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
            <span className="material-symbols-outlined">inventory_2</span>
            Gestion des tarifs centralisée
          </div>
        </div>
      </div>

      {isPanelOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 px-4 py-6 sm:items-center">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-outline-variant/50 px-6 py-5">
              <div>
                <h3 className="text-xl font-semibold text-on-surface">{editingTicket ? 'Modifier un type' : 'Ajouter un type de billet'}</h3>
                <p className="text-sm text-on-surface-variant">Renseignez le titre, le prix et les avantages liés à ce tarif.</p>
              </div>
              <button type="button" onClick={closeForm} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-on-surface hover:bg-surface-container-high">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form className="space-y-6 px-6 py-6" onSubmit={handleFormSubmit}>
              {formError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-on-surface-variant">
                  <span className="font-semibold text-on-surface">Nom du billet</span>
                  <input
                    value={formState.name}
                    onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                    type="text"
                    placeholder="VIP, Standard, Early Bird"
                    className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                    required
                  />
                </label>
                <label className="space-y-2 text-sm text-on-surface-variant">
                  <span className="font-semibold text-on-surface">Prix</span>
                  <input
                    value={formState.price}
                    onChange={(e) => setFormState((prev) => ({ ...prev, price: e.target.value }))}
                    type="number"
                    min={0}
                    step={100}
                    className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-on-surface-variant">
                  <span className="font-semibold text-on-surface">Devise</span>
                  <select
                    value={formState.currency}
                    onChange={(e) => setFormState((prev) => ({ ...prev, currency: e.target.value as CurrencyOption }))}
                    className="w-full rounded-2xl border border-outline-variant/60 bg-white px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                  >
                    {CURRENCY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>

                <div className="space-y-2 text-sm text-on-surface-variant">
                  <span className="font-semibold text-on-surface">Avantages</span>
                  <p className="text-xs text-on-surface-variant">Liste des avantages visibles sur le type de billet.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">Avantages du billet</p>
                    <p className="text-sm text-on-surface-variant">Ajoutez les points forts offerts par ce tarif.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addBenefit}
                    className="inline-flex items-center gap-2 rounded-2xl bg-surface-container-high px-3 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container-highest"
                  >
                    <span className="material-symbols-outlined">add</span>
                    Ajouter un avantage
                  </button>
                </div>
                <div className="space-y-3">
                  {formState.benefits.map((benefit, index) => (
                    <div key={index} className="flex flex-col gap-2 rounded-2xl border border-outline-variant/60 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                      <input
                        value={benefit}
                        onChange={(e) => updateBenefit(index, e.target.value)}
                        className="min-w-0 flex-1 rounded-2xl border border-outline-variant/50 bg-surface px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                        placeholder="Ex. Accès VIP, cocktail inclus, placement prioritaire"
                      />
                      <button
                        type="button"
                        onClick={() => removeBenefit(index)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-surface px-3 py-2 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-high"
                      >
                        <span className="material-symbols-outlined">remove_circle</span>
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-2xl border border-outline-variant/60 bg-surface px-5 py-3 text-sm font-semibold text-on-surface-variant transition hover:border-secondary hover:text-on-surface"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary transition hover:bg-primary/95 disabled:opacity-60"
                >
                  {isSaving ? 'Enregistrement...' : editingTicket ? 'Enregistrer les modifications' : 'Créer le type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
