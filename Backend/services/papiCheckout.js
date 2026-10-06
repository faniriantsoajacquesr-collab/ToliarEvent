const papi = require('./papiClient');

function createCheckoutService(db) {
  async function get(id) {
    const { data, error } = await db.from('papi_checkouts').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error('Impossible de lire la commande. Vérifiez la migration Papi.');
    if (!data) throw Object.assign(new Error('Commande introuvable.'), { status: 404 });
    return data;
  }
  async function update(id, values) {
    const { error } = await db.from('papi_checkouts').update(values).eq('id', id).neq('status', 'paid');
    if (error) throw new Error('Impossible de mettre à jour la commande.');
  }
  async function apply(checkout, data, trustedRead = false) {
    papi.validatePayment(checkout, data, !trustedRead);
    if (trustedRead && (data.currency !== 'MGA' || (data.paymentStatus === 'SUCCESS' && data.linkStatus !== 'PAID'))) {
      throw new Error('Statut Papi incohérent.');
    }
    if (data.paymentStatus === 'SUCCESS') {
      const { error } = await db.rpc('complete_papi_checkout', {
        p_id: checkout.id, p_amount: Number(data.amount),
        p_reference: data.papiPaymentReference || data.paymentReference,
        p_method: data.paymentMethod || null,
      });
      if (error) throw new Error('Le paiement est reçu, la préparation des billets doit être réessayée.');
    } else {
      // Expiry is not proof that an in-flight payment failed.
      const status = data.paymentStatus === 'PENDING' ? 'pending'
        : ['EXPIRED', 'DISABLED'].includes(data.linkStatus) ? 'expired'
        : data.paymentStatus === 'FAILED' ? 'failed' : 'pending';
      await update(checkout.id, { status });
    }
    return get(checkout.id);
  }
  async function reconcile(checkout) {
    if (checkout.status === 'paid') return { checkout, data: null };
    // Persist the attempt time even when Papi is unreachable, to bound polling.
    await update(checkout.id, { last_checked_at: new Date().toISOString() });
    const data = await papi.request(`/payment-links/PAPI-${checkout.id}`);
    await apply(checkout, data, true);
    return { checkout: await get(checkout.id), data };
  }
  async function issue(checkout, accessToken) {
    if (checkout.status === 'paid') return checkout;
    const now = new Date();
    const { data: lease, error } = await db.from('papi_checkouts')
      .update({ issuing_until: new Date(now.getTime() + 60000).toISOString() })
      .eq('id', checkout.id).neq('status', 'paid')
      .or(`issuing_until.is.null,issuing_until.lt.${now.toISOString()}`).select('id');
    if (error) throw new Error('Impossible de préparer le paiement.');
    if (!lease?.length) throw Object.assign(new Error('Préparation en cours. Réessayez dans quelques instants.'), { status: 409 });
    try {
      checkout = await get(checkout.id);
      if (checkout.status === 'paid') return checkout;
      let remote;
      try {
        const result = await reconcile(checkout);
        checkout = result.checkout;
        remote = result.data;
      } catch (err) {
        if (err.providerStatus !== 404 || checkout.payment_link) throw err;
      }
      if (checkout.status === 'paid') return checkout;
      if (remote?.paymentStatus === 'PENDING') {
        throw Object.assign(new Error('Un paiement est déjà en cours. Attendez sa confirmation.'), { status: 409 });
      }
      if (remote?.linkStatus === 'ACTIVE') {
        await update(checkout.id, {
          payment_link: papi.safePaymentLink(remote.paymentLink), notification_token: remote.notificationToken,
          expires_at: new Date(remote.linkExpirationDateTime).toISOString(),
        });
        return get(checkout.id);
      }
      const { frontend, backend } = papi.config();
      const returnUrl = `${frontend}/paiement/${checkout.id}#token=${accessToken}`;
      const data = await papi.request('/payment-links', {
        reference: `PAPI-${checkout.id}`, amount: Number(checkout.amount), currency: 'MGA',
        clientName: checkout.buyer_name, payerPhone: checkout.buyer_phone,
        ...(checkout.buyer_email ? { payerEmail: checkout.buyer_email } : {}),
        description: `${checkout.quantity} × ${checkout.ticket_type_name} — ${checkout.event_title}`.slice(0, 255),
        successUrl: returnUrl, failureUrl: returnUrl,
        notificationUrl: `${backend}/api/payments/papi/notification`, validDuration: 1,
      });
      if (data.paymentReference !== `PAPI-${checkout.id}` || Number(data.amount) !== Number(checkout.amount) || !data.notificationToken) {
        throw new Error('Réponse Papi invalide.');
      }
      await update(checkout.id, {
        payment_link: papi.safePaymentLink(data.paymentLink), notification_token: data.notificationToken,
        expires_at: new Date(data.linkExpirationDateTime).toISOString(), status: 'pending',
      });
      return get(checkout.id);
    } finally {
      await db.from('papi_checkouts').update({ issuing_until: null }).eq('id', checkout.id);
    }
  }
  async function publicView(checkout) {
    let tickets = [];
    if (checkout.status === 'paid') {
      const { data, error } = await db.from('order_items').select('tickets(id, number, ticket_type)').eq('order_id', checkout.id);
      if (error) throw new Error('Impossible de charger les billets.');
      tickets = (data || []).map(item => item.tickets).filter(Boolean);
    }
    return {
      id: checkout.id, status: checkout.status, event_id: checkout.event_id,
      event_title: checkout.event_title, ticket_type: checkout.ticket_type_name,
      quantity: checkout.quantity, amount: Number(checkout.amount), tickets,
      expires_at: checkout.expires_at,
    };
  }
  return { get, update, apply, reconcile, issue, publicView };
}
module.exports = { createCheckoutService };
