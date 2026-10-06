import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { papiAPI, type Checkout } from '../services/papiAPI';
import { downloadTicketQrPngs } from '../utils/generateTicketQrPng';

export default function PaymentStatusPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);
  const paying = useRef(false);
  const valid = /^[a-f0-9]{64}$/.test(token);
  const pay = useCallback(async () => {
    if (paying.current || !valid) return;
    paying.current = true;
    setBusy(true); setError('');
    try {
      const result = await papiAPI.pay(id, token);
      setCheckout(result.checkout);
      if (result.payment_url) {
        const url = new URL(result.payment_url);
        if (url.protocol !== 'https:' || !(url.hostname === 'papi.mg' || url.hostname.endsWith('.papi.mg'))) throw new Error('Lien de paiement invalide.');
        window.location.assign(url.href);
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Connexion interrompue. Réessayez.'); }
    finally { setBusy(false); paying.current = false; }
  }, [id, token, valid, setBusy, setError, setCheckout]);
  const refresh = useCallback(async () => {
    const result = await papiAPI.status(id, token);
    setCheckout(result.checkout);
    setError(result.warning || '');
    return result.checkout;
  }, [id, token, setCheckout, setError]);
  useEffect(() => {
    if (!valid) return;
    try { localStorage.setItem('papi-last-checkout', `${location.pathname}${location.hash}`); } catch { /* optional recovery shortcut */ }
    if (location.state?.startPayment && !started.current) {
      started.current = true;
      window.history.replaceState({ ...window.history.state, usr: null }, '');
      void pay();
    }
  }, [valid, location.pathname, location.hash, location.state, pay]);
  useEffect(() => {
    if (!valid) return;
    let stopped = false;
    let timeout: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function poll() {
      if (stopped) return;
      let current: Checkout | undefined;
      try { if (!paying.current) current = await refresh(); }
      catch (err) { if (!stopped) setError(err instanceof Error ? err.message : 'Impossible de vérifier le paiement.'); }
      attempts++;
      if (!stopped && current?.status !== 'paid' && current?.status !== 'expired' && attempts < 40) timeout = setTimeout(poll, 15000);
    }
    void poll();
    return () => { stopped = true; clearTimeout(timeout); };
  }, [valid, refresh]);
  async function download() {
    if (!checkout) return;
    setBusy(true); setError('');
    try { await downloadTicketQrPngs(checkout.tickets); }
    catch { setError('Le téléchargement a échoué. Vous pouvez réessayer.'); }
    finally { setBusy(false); }
  }
  const title = checkout?.status === 'paid' ? 'Vos billets sont prêts'
    : checkout?.status === 'failed' ? 'Le paiement n’a pas abouti'
    : checkout?.status === 'expired' ? 'Le lien de paiement a expiré' : 'Votre commande est en attente';
  return <div className="mx-auto min-h-[65vh] max-w-2xl px-4 py-12 sm:py-20">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Suivi de commande</p>
      <h1 className="mt-3 text-2xl font-bold" aria-live="polite">{valid ? title : 'Lien de suivi incomplet'}</h1>
      {!valid ? <p className="mt-4">Ouvrez le lien complet conservé lors de votre achat.</p> : <>
        <p role="status" className="mt-3 text-slate-600">{busy ? 'Traitement en cours…' : checkout?.status === 'paid' ? 'Votre paiement a été confirmé. Téléchargez vos billets et présentez leurs QR codes à l’entrée.' : checkout?.status === 'failed' ? 'Vos informations sont conservées. Vous pouvez réessayer sur Papi.' : checkout?.status === 'expired' ? 'Vous pouvez demander un nouveau lien avec le bouton ci-dessous.' : 'Si vous avez déjà payé, attendez la confirmation avant de réessayer. Cette page se met à jour automatiquement pendant quelques minutes.'}</p>
        {checkout && <dl className="my-6 space-y-2 rounded-xl bg-slate-50 p-4">
          <div><dt className="text-sm text-slate-600">Événement</dt><dd className="font-semibold">{checkout.event_title}</dd></div>
          <div><dt className="text-sm text-slate-600">Billets</dt><dd>{checkout.quantity} × {checkout.ticket_type}</dd></div>
          <div><dt className="text-sm text-slate-600">Total des billets</dt><dd className="font-semibold">{checkout.amount.toLocaleString('fr-FR')} Ar</dd></div>
        </dl>}
        {error && <p role="alert" className="my-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          {checkout?.status === 'paid' ? <button disabled={busy} onClick={download} className="min-h-12 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">Télécharger mes billets</button>
            : <button disabled={busy} onClick={() => void pay()} className="min-h-12 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Préparation…' : checkout?.status === 'failed' || checkout?.status === 'expired' ? 'Réessayer le paiement' : 'Continuer vers Papi'}</button>}
          {checkout?.status !== 'paid' && <button disabled={busy} onClick={() => { setBusy(true); void refresh().catch(err => setError(err.message)).finally(() => setBusy(false)); }} className="min-h-12 rounded-xl border border-slate-300 px-4 py-3 disabled:opacity-50">Vérifier le paiement</button>}
          <button onClick={() => { void navigator.clipboard.writeText(window.location.href).then(() => setCopied(true)).catch(() => setError('Copiez l’adresse de cette page pour conserver votre suivi.')); }} className="min-h-12 rounded-xl border border-slate-300 px-4 py-3">{copied ? 'Lien copié' : 'Copier le lien de suivi'}</button>
        </div>
        <p className="mt-4 text-sm text-slate-600">Conservez ce lien personnel : il permet de retrouver votre commande et vos billets.</p>
        <p className="mt-3 break-all text-xs text-slate-500">Référence : PAPI-{id}</p>
      </>}
      <Link to={checkout ? `/evenements/${checkout.event_id}` : '/evenements'} className="mt-6 inline-block py-3 font-medium text-blue-700 underline">Retour aux événements</Link>
    </section>
  </div>;
}
