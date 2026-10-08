import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LegalAcceptanceCheckbox from './LegalAcceptanceCheckbox';
import { checkoutCredentials, papiAPI, trackingPath } from '../services/papiAPI';

export type SelectedTicketType = { id: string; name: string; price: number };
interface Props { isOpen: boolean; onClose: () => void; eventId: string; ticketType: SelectedTicketType | null }

export default function TicketPurchaseModal({ isOpen, onClose, eventId, ticketType }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const attempt = useRef<{ fingerprint: string; id: string; token: string } | null>(null);
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState('1');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [legalError, setLegalError] = useState('');
  useEffect(() => {
    if (isOpen && ticketType) dialog.current?.showModal();
    else dialog.current?.close();
  }, [isOpen, ticketType]);
  if (!ticketType) return null;
  const total = ticketType.price * Number(quantity);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || !ticketType) return;
    setError('');
    setLegalError('');
    if (!accepted) { setLegalError('Acceptez les conditions pour continuer.'); return; }
    const body = { ticket_type_id: ticketType.id, quantity: Number(quantity), buyer_name: name.trim(), buyer_email: email.trim(), accepted_terms: true };
    const fingerprint = JSON.stringify({ eventId, ...body });
    // Persist before the first request: a lost response must reuse the same order.
    try {
      const saved = sessionStorage.getItem('papi-checkout-attempt');
      if (!attempt.current && saved) attempt.current = JSON.parse(saved);
    } catch { /* Storage can be unavailable in private browsers. */ }
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, ...checkoutCredentials() };
    const current = attempt.current;
    try { sessionStorage.setItem('papi-checkout-attempt', JSON.stringify(current)); } catch { /* In-memory retry remains available. */ }
    submitting.current = true;
    setBusy(true);
    try {
      await papiAPI.create(eventId, current.token, { ...body, checkout_id: current.id });
      const path = trackingPath(current.id, current.token);
      try { localStorage.setItem('papi-last-checkout', path); } catch { /* The URL also carries recovery access. */ }
      try { sessionStorage.removeItem('papi-checkout-attempt'); } catch { /* optional */ }
      attempt.current = null;
      onClose();
      navigate(path, { state: { startPayment: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion interrompue. Réessayez avec les mêmes informations.');
    } finally { submitting.current = false; setBusy(false); }
  }
  const input = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500';
  return (
    <dialog ref={dialog} aria-labelledby="purchase-title" onCancel={event => { if (busy) event.preventDefault(); else onClose(); }} onClose={onClose}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-900/50">
      <div className="flex items-center justify-between gap-4">
        <h2 id="purchase-title" className="text-xl font-bold">Acheter vos billets</h2>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Fermer" className="min-h-11 min-w-11 rounded-lg hover:bg-slate-100 disabled:opacity-50">✕</button>
      </div>
      <p className="mt-2 text-sm text-slate-600">Vos coordonnées → Paiement sécurisé → Vos billets</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="font-semibold">{ticketType.name}</p>
          <p className="text-sm text-slate-600">{ticketType.price.toLocaleString('fr-FR')} Ar par billet</p>
          <label className="mt-3 block text-sm font-medium">Quantité
            <input type="number" min="1" max="20" step="1" required value={quantity} disabled={busy} onChange={e => setQuantity(e.target.value)} className={input} />
          </label>
        </div>
        <label className="block text-sm font-medium">Nom complet *<input autoFocus autoComplete="name" required maxLength={150} value={name} disabled={busy} onChange={e => setName(e.target.value)} className={input} /></label>
        <label className="block text-sm font-medium">Email (facultatif)<input type="email" autoComplete="email" maxLength={254} value={email} disabled={busy} onChange={e => setEmail(e.target.value)} className={input} /></label>
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 font-semibold"><span>Total des billets</span><span>{Number.isFinite(total) ? total.toLocaleString('fr-FR') : '—'} Ar</span></div>
        <p className="text-sm text-slate-600">Choisissez Mobile Money ou carte sur Papi. Vos billets seront disponibles après confirmation du paiement.</p>
        <LegalAcceptanceCheckbox checked={accepted} onChange={setAccepted} error={legalError} id="papi-legal" />
        {total < 300 && <p className="text-sm text-amber-800">Le paiement Papi nécessite un total minimum de 300 Ar.</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy || !Number.isInteger(Number(quantity)) || total < 300} className="min-h-12 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? 'Préparation de votre commande…' : 'Continuer vers le paiement'}</button>
      </form>
    </dialog>
  );
}
