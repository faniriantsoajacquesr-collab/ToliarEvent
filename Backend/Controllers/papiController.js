const supabase = require('../utils/supabase');
const papi = require('../services/papiClient');
const { createCheckoutService } = require('../services/papiCheckout');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function service() {
  if (!supabase.admin) throw Object.assign(new Error('Le paiement en ligne est indisponible.'), { status: 503 });
  return createCheckoutService(supabase.admin);
}
function token(req) {
  const value = req.get('X-Checkout-Token') || '';
  if (!/^[0-9a-f]{64}$/.test(value)) throw Object.assign(new Error('Lien de suivi invalide.'), { status: 403 });
  return value;
}
async function authorized(req, svc) {
  const secret = token(req);
  if (!uuid.test(req.params.id)) throw Object.assign(new Error('Commande introuvable.'), { status: 404 });
  const checkout = await svc.get(req.params.id);
  if (!papi.equalSecret(checkout.access_hash, papi.hashToken(secret))) throw Object.assign(new Error('Lien de suivi invalide.'), { status: 403 });
  return checkout;
}
const handler = fn => async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { await fn(req, res); }
  catch (err) {
    // Never log secrets, signed URLs, payer information or upstream payloads.
    res.status(err.status || 503).json({ success: false, error: err.status ? err.message : 'Service de paiement indisponible. Réessayez dans quelques instants.' });
  }
};
exports.create = handler(async (req, res) => {
  papi.config();
  const secret = token(req), b = req.body || {};
  if (!uuid.test(b.checkout_id || '') || !uuid.test(req.params.id) ||
      !Number.isSafeInteger(Number(b.ticket_type_id)) || Number(b.ticket_type_id) < 1 ||
      !Number.isInteger(b.quantity) || b.quantity < 1 || b.quantity > 20 ||
      typeof b.buyer_name !== 'string' || !b.buyer_name.trim() || b.buyer_name.length > 150 ||
      typeof b.buyer_phone !== 'string' || !/^[+\d () .-]{9,25}$/.test(b.buyer_phone) ||
      !/^\d{9,15}$/.test(b.buyer_phone.replace(/\D/g, '')) ||
      (b.buyer_email && (typeof b.buyer_email !== 'string' || b.buyer_email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.buyer_email))) || b.accepted_terms !== true) {
    return res.status(400).json({ success: false, error: 'Vérifiez vos coordonnées, la quantité et l’acceptation des conditions.' });
  }
  const svc = service();
  const { data, error } = await supabase.admin.rpc('create_papi_checkout', {
    p_id: b.checkout_id, p_access_hash: papi.hashToken(secret), p_event_id: req.params.id,
    p_ticket_type_id: Number(b.ticket_type_id), p_quantity: b.quantity,
    p_buyer_name: b.buyer_name.trim(), p_buyer_phone: b.buyer_phone.trim(), p_buyer_email: b.buyer_email?.trim() || null,
  });
  if (error) {
    const message = error.message || '';
    const known = /CHECKOUT_CONFLICT|TICKET_UNAVAILABLE|EVENT_UNAVAILABLE|INVALID_AMOUNT/.test(message);
    return res.status(known ? 409 : 503).json({ success: false, error: known ? 'Commande incompatible ou billets indisponibles. Le total minimum est de 300 Ar.' : 'Le paiement en ligne n’est pas encore disponible.' });
  }
  // Creation and redirection are separate: the browser keeps a recovery URL even if Papi times out.
  res.status(201).json({ success: true, checkout: await svc.publicView(Array.isArray(data) ? data[0] : data) });
});
exports.status = handler(async (req, res) => {
  const svc = service();
  let checkout = await authorized(req, svc), warning;
  if (checkout.status !== 'paid' && (!checkout.last_checked_at || Date.now() - Date.parse(checkout.last_checked_at) > 10000)) {
    try { checkout = (await svc.reconcile(checkout)).checkout; }
    catch { warning = 'Confirmation temporairement indisponible. Votre commande est conservée.'; }
  }
  res.json({ success: true, checkout: await svc.publicView(checkout), warning });
});
exports.pay = handler(async (req, res) => {
  const svc = service();
  const checkout = await svc.issue(await authorized(req, svc), token(req));
  res.json({ success: true, checkout: await svc.publicView(checkout), payment_url: checkout.status === 'paid' ? null : checkout.payment_link });
});
exports.notification = handler(async (req, res) => {
  if (!papi.verifySignature(req.body, req.get('X-Papi-Signature'), process.env.PAPI_WEBHOOK_SECRET)) {
    return res.status(401).json({ success: false });
  }
  let data;
  try { data = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).json({ success: false }); }
  if (!data || !['SUCCESS', 'PENDING', 'FAILED'].includes(data.paymentStatus) ||
      (data.paymentStatus === 'SUCCESS' && !data.paymentReference)) return res.status(400).json({ success: false });
  const id = String(data.merchantPaymentReference || '').replace(/^PAPI-/, '');
  if (!uuid.test(id)) return res.status(400).json({ success: false });
  const svc = service();
  const checkout = await svc.get(id);
  await svc.apply(checkout, data);
  res.json({ success: true });
});
