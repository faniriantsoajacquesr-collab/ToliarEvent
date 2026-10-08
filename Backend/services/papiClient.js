const { createHash, createHmac, timingSafeEqual } = require('node:crypto');

const hashToken = token => createHash('sha256').update(token).digest('hex');
function equalSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function verifySignature(raw, header, secret, now = Date.now()) {
  if (!Buffer.isBuffer(raw) || !header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map(p => p.trim().split('=')));
  if (!/^\d{1,13}$/.test(parts.t || '') || !/^[a-f0-9]{64}$/.test(parts.v1 || '')) return false;
  if (Math.abs(now / 1000 - Number(parts.t)) > 300) return false;
  const digest = createHmac('sha256', secret).update(`${parts.t}.`).update(raw).digest('hex');
  return equalSecret(digest, parts.v1);
}
function config() {
  const base = (process.env.PAPI_BASE_URL || 'https://app.papi.mg/engine/api').replace(/\/$/, '');
  const frontend = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const backend = (process.env.BACKEND_PUBLIC_URL || '').replace(/\/$/, '');
  if (!process.env.PAPI_API_KEY || !process.env.PAPI_WEBHOOK_SECRET || !frontend || !backend) {
    throw Object.assign(new Error('Le paiement en ligne n’est pas encore configuré.'), { status: 503 });
  }
  for (const [name, value] of [['PAPI_BASE_URL', base], ['FRONTEND_URL', frontend], ['BACKEND_PUBLIC_URL', backend]]) {
    let url;
    try { url = new URL(value); }
    catch { throw Object.assign(new Error(`${name} doit être une URL valide.`), { status: 503 }); }
    const localFrontend = name === 'FRONTEND_URL' && process.env.NODE_ENV !== 'production' &&
      url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !localFrontend) {
      const hint = name === 'FRONTEND_URL'
        ? 'En production, utilisez l’adresse HTTPS du site déployé.'
        : name === 'BACKEND_PUBLIC_URL'
          ? 'Utilisez l’adresse Render ou un tunnel HTTPS vers votre backend local.'
          : 'Utilisez https://app.papi.mg/engine/api.';
      throw Object.assign(new Error(`${name} doit utiliser HTTPS. ${hint}`), { status: 503 });
    }
  }
  return { base, frontend, backend };
}
async function request(path, body) {
  const { base } = config();
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Token: process.env.PAPI_API_KEY, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || !result.data) {
    throw Object.assign(new Error('Papi est momentanément indisponible. Réessayez depuis le suivi de commande.'), {
      status: 502, providerStatus: response.status,
    });
  }
  return result.data;
}
function validatePayment(checkout, data, requireToken = true) {
  if (data.merchantPaymentReference !== `PAPI-${checkout.id}` ||
      Number(data.amount) !== Number(checkout.amount) ||
      (data.currency && data.currency !== 'MGA') ||
      (requireToken && !equalSecret(checkout.notification_token, data.notificationToken))) {
    throw Object.assign(new Error('Confirmation de paiement incohérente.'), { status: 400 });
  }
}
function safePaymentLink(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !(url.hostname === 'papi.mg' || url.hostname.endsWith('.papi.mg'))) {
    throw new Error('Lien Papi invalide');
  }
  return value;
}
module.exports = { hashToken, equalSecret, verifySignature, config, request, validatePayment, safePaymentLink };
