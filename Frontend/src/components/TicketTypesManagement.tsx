import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../contexts/AuthContext';

import { authAPI } from '../services/authAPI';

import { Skeleton } from './skeleton';



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

      setFormState({ name: '', price: '0', currency: 'Ar', benefits: [''] });

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

      const payload = { name, price, currency: formState.currency, benefits };

      const result = editingId

        ? await authAPI.updateTicketType(editingId, payload, session.access_token)

        : await authAPI.createTicketType(selectedEventId, payload, session.access_token);



      if (!result.success) {

        setFormError(result.error || 'Enregistrement impossible.');

        return;

      }



      const saved = mapTicketTypeFromApi(result.ticket_type || {});

      setTicketTypes((prev) =>

        editingId ? prev.map((item) => (item.id === editingId ? saved : item)) : [saved, ...prev]

      );

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



  return (

    <div className="space-y-8">

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

        <div>

          <p className="landing-eyebrow mb-3">Configuration des tarifs</p>

          <h2 className="font-landing-display text-2xl app-heading mb-2">

            Catégories & prix de billets

          </h2>

          <p className="app-text-muted text-sm max-w-2xl leading-relaxed">

            Définissez les formules tarifaires et les avantages associés à chaque type de billet.

          </p>

        </div>

        <button

          type="button"

          onClick={() => openForm()}

          className="landing-btn-primary !px-5 !py-3 !text-sm !rounded-xl shrink-0"

        >

          <span className="material-symbols-outlined text-base">add</span>

          Ajouter un type

        </button>

      </div>



      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

        {isLoading ? (

          Array.from({ length: 3 }).map((_, i) => (

            <div key={i} className="dash-ticket-type-card p-5 space-y-4">

              <Skeleton className="h-6 w-2/3" rounded="lg" />

              <Skeleton className="h-8 w-1/2" rounded="lg" />

              <Skeleton className="h-24 w-full" rounded="xl" />

              <div className="flex gap-2 pt-2">

                <Skeleton className="h-9 flex-1" rounded="xl" />

                <Skeleton className="h-9 flex-1" rounded="xl" />

              </div>

            </div>

          ))

        ) : fetchError ? (

          <div className="col-span-full dash-empty-state py-10 text-sm text-red-600 dark:text-red-400">

            {fetchError}

          </div>

        ) : ticketTypes.length === 0 ? (

          <div className="col-span-full dash-empty-state py-12">

            <span className="material-symbols-outlined text-4xl text-primary mb-3 block">confirmation_number</span>

            <p className="font-landing-display text-lg app-heading mb-1">Aucun type de billet</p>

            <p className="app-text-muted text-sm mb-5">Créez votre première formule tarifaire pour cet événement.</p>

            <button type="button" onClick={() => openForm()} className="landing-btn-primary !px-5 !py-2.5 !text-sm !rounded-xl">

              Ajouter un type

            </button>

          </div>

        ) : (

          ticketTypes.map((ticket) => (

            <article key={ticket.id} className="dash-ticket-type-card flex flex-col">

              <div className="p-5 pb-4 border-b border-[var(--md-border)]">

                <div className="flex items-start justify-between gap-3">

                  <div>

                    <h3 className="font-landing-display text-lg app-heading">{ticket.name}</h3>

                    <p className="mt-2 text-xl font-bold text-primary">{formatPrice(ticket.price, ticket.currency)}</p>

                  </div>

                  <span className="material-symbols-outlined text-primary/40 text-2xl">local_activity</span>

                </div>

              </div>



              <div className="p-5 flex-1">

                <p className="text-[10px] font-bold uppercase tracking-wider app-text-muted mb-3">Avantages</p>

                <ul className="space-y-2">

                  {ticket.benefits.map((item, index) => (

                    <li key={index} className="flex items-start gap-2 text-sm app-text-muted">

                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />

                      <span>{item}</span>

                    </li>

                  ))}

                </ul>

              </div>



              <div className="p-4 pt-0 flex gap-2">

                <button

                  type="button"

                  onClick={() => openForm(ticket)}

                  className="flex-1 landing-btn-secondary !px-3 !py-2 !text-xs !rounded-xl justify-center"

                >

                  <span className="material-symbols-outlined text-sm">edit</span>

                  Modifier

                </button>

                <button

                  type="button"

                  onClick={() => handleDelete(ticket.id)}

                  className="flex-1 landing-btn-secondary !px-3 !py-2 !text-xs !rounded-xl justify-center !text-red-600 dark:!text-red-400"

                >

                  <span className="material-symbols-outlined text-sm">delete</span>

                  Supprimer

                </button>

              </div>

            </article>

          ))

        )}

      </div>



      {!isLoading && ticketTypes.length > 0 && (

        <div className="app-card rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

          <p className="text-sm app-text-muted">

            <span className="font-semibold app-heading">{ticketTypes.length}</span> type{ticketTypes.length > 1 ? 's' : ''} de billet actif{ticketTypes.length > 1 ? 's' : ''}

          </p>

          <span className="inline-flex items-center gap-2 text-xs font-medium text-primary">

            <span className="material-symbols-outlined text-base">inventory_2</span>

            Tarification centralisée

          </span>

        </div>

      )}



      {isPanelOpen && (

        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 py-6 backdrop-blur-sm sm:items-center">

          <div className="app-card w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl">

            <div className="flex items-center justify-between border-b border-[var(--md-border)] px-6 py-5">

              <div>

                <h3 className="font-landing-display text-xl app-heading">

                  {editingTicket ? 'Modifier un type' : 'Nouveau type de billet'}

                </h3>

                <p className="text-sm app-text-muted mt-0.5">Titre, prix et avantages du tarif.</p>

              </div>

              <button type="button" onClick={closeForm} className="dash-action-btn rounded-full">

                <span className="material-symbols-outlined">close</span>

              </button>

            </div>

            <form className="space-y-5 px-6 py-6 max-h-[70vh] overflow-y-auto" onSubmit={handleFormSubmit}>

              {formError && (

                <div className="rounded-xl border border-error/30 bg-error-container/40 px-4 py-3 text-sm text-on-error-container">

                  {formError}

                </div>

              )}

              <div className="grid gap-4 md:grid-cols-2">

                <div>

                  <label className="app-label">Nom du billet</label>

                  <input

                    value={formState.name}

                    onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}

                    type="text"

                    placeholder="VIP, Standard, Early Bird"

                    className="app-input"

                    required

                  />

                </div>

                <div>

                  <label className="app-label">Prix</label>

                  <input

                    value={formState.price}

                    onChange={(e) => setFormState((prev) => ({ ...prev, price: e.target.value }))}

                    type="number"

                    min={0}

                    step={100}

                    className="app-input"

                    required

                  />

                </div>

              </div>

              <div>

                <label className="app-label">Devise</label>

                <select

                  value={formState.currency}

                  onChange={(e) => setFormState((prev) => ({ ...prev, currency: e.target.value as CurrencyOption }))}

                  className="app-input"

                >

                  {CURRENCY_OPTIONS.map((option) => (

                    <option key={option} value={option}>{option}</option>

                  ))}

                </select>

              </div>



              <div className="space-y-3">

                <div className="flex items-center justify-between">

                  <p className="app-label mb-0">Avantages</p>

                  <button type="button" onClick={addBenefit} className="landing-btn-secondary !px-3 !py-1.5 !text-xs !rounded-lg">

                    <span className="material-symbols-outlined text-sm">add</span>

                    Ajouter

                  </button>

                </div>

                {formState.benefits.map((benefit, index) => (

                  <div key={index} className="flex gap-2">

                    <input

                      value={benefit}

                      onChange={(e) => updateBenefit(index, e.target.value)}

                      className="app-input flex-1"

                      placeholder="Ex. Accès VIP, cocktail inclus"

                    />

                    <button type="button" onClick={() => removeBenefit(index)} className="dash-action-btn dash-action-btn--danger shrink-0 rounded-xl px-3">

                      <span className="material-symbols-outlined text-lg">remove</span>

                    </button>

                  </div>

                ))}

              </div>



              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">

                <button type="button" onClick={closeForm} className="landing-btn-secondary !px-5 !py-2.5 !text-sm !rounded-xl">

                  Annuler

                </button>

                <button type="submit" disabled={isSaving} className="landing-btn-primary !px-5 !py-2.5 !text-sm !rounded-xl disabled:opacity-60">

                  {isSaving ? 'Enregistrement…' : editingTicket ? 'Enregistrer' : 'Créer le type'}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>

  );

}


