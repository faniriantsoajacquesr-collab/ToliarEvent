import { useEffect, useMemo, useState } from 'react';

import { authAPI } from '../services/authAPI';
import LegalAcceptanceCheckbox from './LegalAcceptanceCheckbox';

import {

  downloadTicketQrPngs,

  type PurchasedTicketInfo,

} from '../utils/generateTicketQrPng';



export type SelectedTicketType = {

  id: string;

  name: string;

  price: number;

};



type PaymentMethodOption = {
  id: number;
  operateur: string;
  numero: string;
  accountHolder: string;
};



type BuyerForm = {

  buyer_name: string;

  buyer_phone: string;

  buyer_email: string;

  buyer_address: string;

  transaction_id: string;

};



type FieldErrors = Partial<Record<keyof BuyerForm | 'quantity' | 'payment_method', string>>;



interface TicketPurchaseModalProps {

  isOpen: boolean;

  onClose: () => void;

  eventId: string;

  ticketType: SelectedTicketType | null;

}



const initialForm: BuyerForm = {

  buyer_name: '',

  buyer_phone: '',

  buyer_email: '',

  buyer_address: '',

  transaction_id: '',

};



function formatAmount(amount: number): string {

  return `${amount.toLocaleString('fr-FR')} Ar`;

}



function formatTransferNumber(numero: string): string {

  const digits = numero.replace(/\D/g, '');

  if (digits.length <= 3) return digits;

  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();

}



function normalizePaymentMethod(row: Record<string, unknown>): PaymentMethodOption {
  return {
    id: Number(row.id),
    operateur: String(row.Operateur ?? row.operateur ?? 'Mobile Money'),
    numero: String(row.numero ?? ''),
    accountHolder: String(row.account_holder ?? row.accountHolder ?? '').trim(),
  };
}



function isValidPhone(phone: string): boolean {

  const digits = phone.replace(/\D/g, '');

  return digits.length >= 9;

}



function isValidEmail(email: string): boolean {

  if (!email.trim()) return true;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

}



export default function TicketPurchaseModal({

  isOpen,

  onClose,

  eventId,

  ticketType,

}: TicketPurchaseModalProps) {

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [form, setForm] = useState<BuyerForm>(initialForm);

  const [quantityInput, setQuantityInput] = useState('1');

  const quantity = useMemo(() => {
    const parsed = Number.parseInt(quantityInput, 10);
    if (!Number.isFinite(parsed)) return 0;
    return parsed;
  }, [quantityInput]);

  const [errors, setErrors] = useState<FieldErrors>({});

  const [loading, setLoading] = useState(false);

  const [submitError, setSubmitError] = useState('');

  const [purchasedTickets, setPurchasedTickets] = useState<PurchasedTicketInfo[]>([]);

  const [downloadingQr, setDownloadingQr] = useState(false);

  const [downloadError, setDownloadError] = useState('');

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);

  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<number | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState('');



  const totalAmount = useMemo(() => {

    if (!ticketType) return 0;

    const effectiveQuantity = quantity >= 1 && quantity <= 20 ? quantity : 1;

    return ticketType.price * effectiveQuantity;

  }, [ticketType, quantity]);



  const selectedPaymentMethod = useMemo(

    () => paymentMethods.find((method) => method.id === selectedPaymentMethodId) ?? null,

    [paymentMethods, selectedPaymentMethodId]

  );



  useEffect(() => {

    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {

      if (event.key === 'Escape' && !loading) onClose();

    };

    document.addEventListener('keydown', handleEscape);

    document.body.style.overflow = 'hidden';

    return () => {

      document.removeEventListener('keydown', handleEscape);

      document.body.style.overflow = '';

    };

  }, [isOpen, loading, onClose]);



  useEffect(() => {

    if (!isOpen) {

      setStep(1);

      setForm(initialForm);

      setQuantityInput('1');

      setErrors({});

      setLoading(false);

      setSubmitError('');

      setPurchasedTickets([]);

      setDownloadingQr(false);

      setDownloadError('');

      setPaymentMethods([]);

      setPaymentMethodsLoading(false);

      setSelectedPaymentMethodId(null);
      setAcceptedTerms(false);
      setTermsError('');

    }

  }, [isOpen]);



  useEffect(() => {

    if (!isOpen) return;



    const loadPaymentMethods = async () => {

      setPaymentMethodsLoading(true);

      try {

        const response = await authAPI.getPaymentMethods();

        if (response.success && Array.isArray(response.payment_methods)) {

          const methods = response.payment_methods.map(normalizePaymentMethod);

          setPaymentMethods(methods);

        } else {

          setPaymentMethods([]);

        }

      } catch (error) {

        console.error('TicketPurchaseModal loadPaymentMethods', error);

        setPaymentMethods([]);

      } finally {

        setPaymentMethodsLoading(false);

      }

    };



    loadPaymentMethods();

  }, [isOpen]);



  if (!isOpen || !ticketType) return null;



  const updateField = (key: keyof BuyerForm, value: string) => {

    setForm((prev) => ({ ...prev, [key]: value }));

    setErrors((prev) => ({ ...prev, [key]: undefined, quantity: undefined }));

    setSubmitError('');

  };



  const validateStep1 = (): boolean => {

    const nextErrors: FieldErrors = {};

    if (!form.buyer_name.trim()) nextErrors.buyer_name = 'Le nom complet est requis.';

    if (form.buyer_email.trim() && !isValidEmail(form.buyer_email)) {
      nextErrors.buyer_email = 'Adresse email invalide.';
    }

    if (quantity < 1 || quantity > 20) nextErrors.quantity = 'Quantité entre 1 et 20.';

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;

  };



  const normalizeQuantityInput = () => {

    const parsed = Number.parseInt(quantityInput, 10);

    if (!Number.isFinite(parsed) || parsed < 1) {

      setQuantityInput('1');

    } else if (parsed > 20) {

      setQuantityInput('20');

    } else {

      setQuantityInput(String(parsed));

    }

  };



  const validateStep2 = (): boolean => {

    const nextErrors: FieldErrors = {};

    if (!form.buyer_phone.trim()) {

      nextErrors.buyer_phone = 'Le numéro de téléphone est requis.';

    } else if (!isValidPhone(form.buyer_phone)) {

      nextErrors.buyer_phone = 'Numéro invalide (minimum 9 chiffres).';

    }

    if (!selectedPaymentMethodId) {

      nextErrors.payment_method = 'Veuillez sélectionner un moyen de paiement.';

    }

    if (!form.transaction_id.trim()) {

      nextErrors.transaction_id = "L'ID de transaction est requis.";

    } else if (form.transaction_id.trim().length < 3) {

      nextErrors.transaction_id = 'Référence trop courte.';

    }

    if (!acceptedTerms) {
      setTermsError('Vous devez accepter la politique de confidentialité et les CGU.');
    } else {
      setTermsError('');
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0 && acceptedTerms;

  };



  const handleContinue = () => {

    if (validateStep1()) setStep(2);

  };



  const handleConfirm = async () => {

    if (!validateStep2() || !selectedPaymentMethodId) return;



    setLoading(true);

    setSubmitError('');



    try {

      const response = await authAPI.purchaseEventTicket(eventId, {

        ticket_type_id: ticketType.id,

        quantity,

        buyer_name: form.buyer_name.trim(),

        buyer_phone: form.buyer_phone.trim(),

        buyer_email: form.buyer_email.trim() || null,

        buyer_address: form.buyer_address.trim() || null,

        transaction_id: form.transaction_id.trim().toUpperCase(),

        total_amount: totalAmount,

        payment_method: selectedPaymentMethodId,

      });



      if (!response.success) {

        throw new Error(response.error || "Impossible d'enregistrer la commande.");

      }



      const tickets: PurchasedTicketInfo[] = Array.isArray(response.tickets)

        ? response.tickets.map((ticket: PurchasedTicketInfo) => ({

            id: ticket.id,

            number: ticket.number,

            ticket_type: ticket.ticket_type,

          }))

        : [];



      setPurchasedTickets(tickets);

      setStep(3);

    } catch (error) {

      console.error('TicketPurchaseModal submit error', error);

      setSubmitError(error instanceof Error ? error.message : 'Une erreur est survenue.');

    } finally {

      setLoading(false);

    }

  };



  const handleDownloadQrCodes = async () => {

    if (purchasedTickets.length === 0) return;



    setDownloadingQr(true);

    setDownloadError('');



    try {

      await downloadTicketQrPngs(purchasedTickets);

    } catch (error) {

      console.error('TicketPurchaseModal QR download error', error);

      setDownloadError('Impossible de générer les QR Codes. Réessayez.');

    } finally {

      setDownloadingQr(false);

    }

  };



  const inputClass = (field: keyof BuyerForm) =>

    `w-full rounded-xl border bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:ring-2 ${

      errors[field]

        ? 'border-red-400 focus:border-red-400 focus:ring-red-100'

        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'

    }`;



  return (

    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">

      <button

        type="button"

        aria-label="Fermer"

        className="absolute inset-0 backdrop-blur-sm bg-slate-900/40"

        onClick={() => !loading && onClose()}

      />



      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-slate-100">

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 backdrop-blur px-6 py-4 rounded-t-3xl">

          <div className="flex items-center gap-2">

            {[1, 2].map((n) => (

              <span

                key={n}

                className={`h-2 rounded-full transition-all ${

                  step === n || (step === 3 && n === 2)

                    ? 'w-8 bg-blue-600'

                    : step > n

                    ? 'w-2 bg-blue-300'

                    : 'w-2 bg-slate-200'

                }`}

              />

            ))}

          </div>

          {step !== 3 && (

            <button

              type="button"

              onClick={onClose}

              disabled={loading}

              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"

            >

              <span className="material-symbols-outlined text-xl">close</span>

            </button>

          )}

        </div>



        <div className="px-6 py-6">

          {step === 1 && (

            <div className="space-y-5">

              <div>

                <h2 className="text-xl font-black text-slate-900">Vos Informations</h2>

                <p className="mt-1 text-sm text-slate-500">Remplissez vos coordonnées pour la réservation.</p>

              </div>



              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm">

                <p className="font-semibold text-slate-800">{ticketType.name}</p>

                <p className="text-blue-700 font-bold mt-0.5">{formatAmount(ticketType.price)} / billet</p>

              </div>



              <label className="block space-y-1.5">

                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Nom complet *</span>

                <input

                  type="text"

                  value={form.buyer_name}

                  onChange={(e) => updateField('buyer_name', e.target.value)}

                  placeholder="Ex: Jean Dupont"

                  className={inputClass('buyer_name')}

                />

                {errors.buyer_name && <p className="text-xs text-red-500">{errors.buyer_name}</p>}

              </label>



              <label className="block space-y-1.5">

                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Adresse email (facultatif)</span>

                <input

                  type="text"

                  inputMode="email"

                  autoComplete="email"

                  value={form.buyer_email}

                  onChange={(e) => updateField('buyer_email', e.target.value)}

                  placeholder="Ex: nom@exemple.com"

                  className={inputClass('buyer_email')}

                />

                {errors.buyer_email && <p className="text-xs text-red-500">{errors.buyer_email}</p>}

              </label>



              <label className="block space-y-1.5">

                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Adresse physique (facultatif)</span>

                <input

                  type="text"

                  value={form.buyer_address}

                  onChange={(e) => updateField('buyer_address', e.target.value)}

                  placeholder="Ex: Quartier, Toliara"

                  className={inputClass('buyer_address')}

                />

              </label>



              <label className="block space-y-1.5">

                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Nombre de billets</span>

                <input

                  type="number"

                  min={1}

                  max={20}

                  value={quantityInput}

                  onChange={(e) => {

                    const raw = e.target.value;

                    if (raw === '' || /^\d+$/.test(raw)) {

                      setQuantityInput(raw);

                      setErrors((prev) => ({ ...prev, quantity: undefined }));

                    }

                  }}

                  onBlur={normalizeQuantityInput}

                  className={`${inputClass('buyer_name')} ${errors.quantity ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''}`}

                />

                {errors.quantity && <p className="text-xs text-red-500">{errors.quantity}</p>}

              </label>



              <button

                type="button"

                onClick={handleContinue}

                className="w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all"

              >

                Continuer vers le paiement

              </button>

            </div>

          )}



          {step === 2 && (

            <div className="space-y-5">

              <div>

                <h2 className="text-xl font-black text-slate-900">Règlement par Mobile Money</h2>

                <p className="mt-1 text-sm text-slate-500">

                  Choisissez votre opérateur, effectuez le transfert puis saisissez vos informations de paiement.

                </p>

              </div>



              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 space-y-2">

                <p className="text-sm text-slate-600">

                  Formule choisie : <span className="font-bold text-slate-900">{ticketType.name}</span>

                  {quantity > 1 && <span className="text-slate-500"> × {quantity}</span>}

                </p>

                <p className="text-sm text-slate-600">

                  Montant total à transférer :{' '}

                  <span className="text-2xl font-black text-blue-600">{formatAmount(totalAmount)}</span>

                </p>

              </div>



              <div className="space-y-2">

                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Moyen de paiement *</span>

                {paymentMethodsLoading ? (

                  <p className="text-sm text-slate-500">Chargement des moyens de paiement...</p>

                ) : paymentMethods.length === 0 ? (

                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">

                    Aucun moyen de paiement disponible pour le moment.

                  </p>

                ) : (

                  <div className="space-y-2">

                    {paymentMethods.map((method) => {

                      const isSelected = selectedPaymentMethodId === method.id;

                      return (

                        <label

                          key={method.id}

                          className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition ${

                            isSelected

                              ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'

                              : 'border-slate-200 bg-white hover:border-slate-300'

                          } ${errors.payment_method ? 'border-red-300' : ''}`}

                        >

                          <input

                            type="radio"

                            name="payment_method"

                            checked={isSelected}

                            onChange={() => {

                              setSelectedPaymentMethodId(method.id);

                              setErrors((prev) => ({ ...prev, payment_method: undefined }));

                            }}

                            className="h-4 w-4 text-blue-600"

                          />

                          <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800">{method.operateur}</p>
                            <p className="text-xs text-slate-500">{formatTransferNumber(method.numero)}</p>
                            {method.accountHolder ? (
                              <p className="text-xs text-slate-600 mt-0.5">Au nom de {method.accountHolder}</p>
                            ) : null}
                          </div>

                        </label>

                      );

                    })}

                  </div>

                )}

                {errors.payment_method && <p className="text-xs text-red-500">{errors.payment_method}</p>}

              </div>



              {selectedPaymentMethod && (

                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-900">

                  <p className="font-semibold">Instructions de transfert</p>

                  <p className="mt-2 leading-relaxed">
                    Veuillez transférer <span className="font-bold">{formatAmount(totalAmount)}</span> au numéro{' '}
                    <span className="font-bold">{formatTransferNumber(selectedPaymentMethod.numero)}</span> via{' '}
                    <span className="font-bold">{selectedPaymentMethod.operateur}</span>
                    {selectedPaymentMethod.accountHolder ? (
                      <>
                        , au nom de <span className="font-bold">{selectedPaymentMethod.accountHolder}</span>
                      </>
                    ) : null}
                    , puis saisissez la référence de transaction ci-dessous.
                  </p>

                </div>

              )}



              <label className="block space-y-1.5">

                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Votre numéro de téléphone *</span>

                <input

                  type="tel"

                  value={form.buyer_phone}

                  onChange={(e) => updateField('buyer_phone', e.target.value)}

                  placeholder="Ex: 034 XX XX XX"

                  className={inputClass('buyer_phone')}

                />

                {errors.buyer_phone && <p className="text-xs text-red-500">{errors.buyer_phone}</p>}

              </label>



              <label className="block space-y-1.5">

                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">ID de Transaction *</span>

                <input

                  type="text"

                  value={form.transaction_id}

                  onChange={(e) => updateField('transaction_id', e.target.value.toUpperCase())}

                  placeholder="Ex: 1234567890 ou Ref SMS"

                  className={`${inputClass('transaction_id')} uppercase`}

                />

                {errors.transaction_id && <p className="text-xs text-red-500">{errors.transaction_id}</p>}

              </label>



              {submitError && (

                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

                  {submitError}

                </div>

              )}



              <LegalAcceptanceCheckbox

                id="ticket-purchase-legal-acceptance"

                checked={acceptedTerms}

                onChange={(checked) => {

                  setAcceptedTerms(checked);

                  if (checked) setTermsError('');

                }}

                error={termsError}

                openLinksInNewTab

              />



              <div className="flex gap-3 pt-1">

                <button

                  type="button"

                  onClick={() => setStep(1)}

                  disabled={loading}

                  className="flex-1 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"

                >

                  Retour

                </button>

                <button

                  type="button"

                  onClick={handleConfirm}

                  disabled={loading || paymentMethods.length === 0}

                  className="flex-1 rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-200 hover:bg-blue-700 transition disabled:opacity-60 inline-flex items-center justify-center gap-2"

                >

                  {loading ? (

                    <>

                      <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>

                      Envoi...

                    </>

                  ) : (

                    'Confirmer l\'achat'

                  )}

                </button>

              </div>

            </div>

          )}



          {step === 3 && (

            <div className="py-4 text-center space-y-5">

              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">

                <span className="material-symbols-outlined text-4xl text-emerald-600 animate-bounce">check_circle</span>

              </div>

              <div>

                <h2 className="text-xl font-black text-slate-900">Achat réussi !</h2>

                <p className="mt-2 text-sm font-semibold text-emerald-600">

                  Votre commande a été enregistrée avec succès.

                </p>

                <p className="mt-3 text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">

                  Votre paiement est en attente de validation par l&apos;organisateur.

                  {purchasedTickets.length > 0 && (

                    <> Téléchargez {purchasedTickets.length > 1 ? 'vos QR Codes' : 'votre QR Code'} ci-dessous pour accéder à {purchasedTickets.length > 1 ? 'vos billets' : 'votre billet'}.</>

                  )}

                </p>

              </div>



              {purchasedTickets.length > 0 && (

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left space-y-2">

                  {purchasedTickets.map((ticket) => (

                    <p key={ticket.id} className="text-sm text-slate-700">

                      <span className="font-bold">Ticket n°{ticket.number}</span>

                      <span className="text-slate-400 mx-2">|</span>

                      <span>{ticket.ticket_type}</span>

                    </p>

                  ))}

                </div>

              )}



              {downloadError && (

                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

                  {downloadError}

                </div>

              )}



              {purchasedTickets.length > 0 && (

                <button

                  type="button"

                  onClick={handleDownloadQrCodes}

                  disabled={downloadingQr}

                  className="w-full rounded-2xl border border-blue-200 bg-blue-50 py-3.5 text-sm font-bold text-blue-700 hover:bg-blue-100 transition disabled:opacity-60 inline-flex items-center justify-center gap-2"

                >

                  {downloadingQr ? (

                    <>

                      <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>

                      Génération...

                    </>

                  ) : (

                    <>

                      <span className="material-symbols-outlined text-base">download</span>

                      {purchasedTickets.length > 1

                        ? `Télécharger les ${purchasedTickets.length} QR Codes (PNG)`

                        : 'Télécharger le QR Code (PNG)'}

                    </>

                  )}

                </button>

              )}



              <button

                type="button"

                onClick={onClose}

                className="w-full rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-200 hover:bg-blue-700 transition"

              >

                Fermer

              </button>

            </div>

          )}

        </div>

      </div>

    </div>

  );

}


