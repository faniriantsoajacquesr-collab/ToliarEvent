const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const papi = require('../services/papiClient');
const { createCheckoutService } = require('../services/papiCheckout');

test('Papi signature: official vector, tampered bytes, replay, missing header', () => {
  const raw = Buffer.from('{"paymentReference":"PAPI-TEST-0001","paymentStatus":"SUCCESS","amount":150000}');
  const secret = 'pwhsec_5f1c2b7e9a0d4c3b8e6f1a2d9c7b4e0f3a6d8c1b5e9f2a7d4c0b3e6f9a1d8c2b';
  const header = 't=1757750400,v1=66c446f11f07c733a8ded2580681d7e0430cc490637479178506fd2a66595d53';
  assert.equal(papi.verifySignature(raw, header, secret, 1757750400000), true);
  assert.equal(papi.verifySignature(Buffer.concat([raw, Buffer.from(' ')]), header, secret, 1757750400000), false);
  assert.equal(papi.verifySignature(raw, header, secret, 1757750800000), false);
  assert.equal(papi.verifySignature(raw, '', secret), false);
  assert.equal(papi.verifySignature(raw, 't=1,v1=invalid', secret), false);
});

test('payment matching refuses another order, amount, currency or notification token', () => {
  const c = { id: 'order', amount: 1500, notification_token: 'secret' };
  const good = { merchantPaymentReference: 'PAPI-order', amount: 1500, notificationToken: 'secret', currency: 'MGA' };
  papi.validatePayment(c, good);
  for (const patch of [{ amount: 1501 }, { currency: 'EUR' }, { notificationToken: 'wrong' }, { merchantPaymentReference: 'PAPI-other' }]) {
    assert.throws(() => papi.validatePayment(c, { ...good, ...patch }));
  }
  assert.throws(() => papi.safePaymentLink('https://papi.mg.evil.test/pay'));
  assert.throws(() => papi.safePaymentLink('javascript:alert(1)'));
  assert.equal(papi.safePaymentLink('https://payment-form.papi.mg/shop/payments/token'), 'https://payment-form.papi.mg/shop/payments/token');
});

async function database(t) {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE TABLE public.organizations(id uuid PRIMARY KEY); CREATE TABLE public.profiles(id uuid PRIMARY KEY);');
  const schema = readFileSync(resolve(__dirname, '../../db.sql'), 'utf8');
  for (const name of ['events', 'tickets', 'ticket_type', 'payment_method', 'orders', 'order_items']) {
    const sql = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${name} \\([\\s\\S]*?\\n\\);`))[0];
    await pg.exec(sql);
  }
  const migration = readFileSync(resolve(__dirname, '../../migrations/20261006_papi_checkout.sql'), 'utf8');
  await pg.exec(migration);
  await pg.exec(migration); // safe reapplication
  const eventId = randomUUID();
  await pg.query("INSERT INTO events(id,title,location,start_date,end_date) VALUES($1,'Concert','Toliara',now(),now()+interval '1 day')", [eventId]);
  const { rows } = await pg.query("INSERT INTO ticket_type(event_id,name,price) VALUES($1,'Standard',1500) RETURNING id", [eventId]);
  return { pg, eventId, typeId: rows[0].id };
}
async function create(pg, eventId, typeId, id = randomUUID(), count = 2, hash = 'hash') {
  const { rows } = await pg.query('SELECT * FROM create_papi_checkout($1,$2,$3,$4,$5,$6,$7,$8)', [id, hash, eventId, typeId, count, 'Client', '0340000000', null]);
  return rows[0];
}

test('SQL checkout lifecycle: server price, no early tickets, atomic/idempotent fulfillment and protections', async t => {
  const { pg, eventId, typeId } = await database(t);
  const c = await create(pg, eventId, typeId);
  assert.equal(Number(c.amount), 3000);
  assert.equal((await pg.query('SELECT * FROM tickets')).rows.length, 0);
  assert.equal((await create(pg, eventId, typeId, c.id)).id, c.id);
  await assert.rejects(create(pg, eventId, typeId, c.id, 2, 'wrong'), /CHECKOUT_CONFLICT/);
  await assert.rejects(create(pg, eventId, typeId, c.id, 3), /CHECKOUT_CONFLICT/);
  await assert.rejects(create(pg, eventId, typeId, randomUUID(), 21), /INVALID_AMOUNT/);
  await assert.rejects(pg.query('SELECT complete_papi_checkout($1,1,$2,$3)', [c.id, 'provider', 'MVOLA']), /PAYMENT_MISMATCH/);
  await Promise.all([1, 2].map(() => pg.query('SELECT complete_papi_checkout($1,3000,$2,$3)', [c.id, 'provider', 'MVOLA'])));
  const tickets = (await pg.query('SELECT * FROM tickets ORDER BY number')).rows;
  assert.equal(tickets.length, 2);
  assert.deepEqual(tickets.map(ticket => ticket.status), ['vendu', 'vendu']);
  assert.deepEqual(tickets.map(ticket => ticket.number), [1, 2]);
  assert.equal((await pg.query('SELECT * FROM orders')).rows.length, 1);
  assert.equal((await pg.query('SELECT * FROM order_items')).rows.length, 2);
  await assert.rejects(pg.query("UPDATE orders SET payment_status='pending' WHERE id=$1", [c.id]), /manuellement/);
  await assert.rejects(pg.query('DELETE FROM orders WHERE id=$1', [c.id]), /supprimée/);
  await pg.exec('SET ROLE anon');
  await assert.rejects(pg.query('SELECT * FROM papi_checkouts'), /permission denied/);
  await assert.rejects(pg.query('SELECT complete_papi_checkout($1,3000,$2,$3)', [c.id, 'x', 'MVOLA']), /permission denied/);
  await pg.exec('RESET ROLE');
});

test('SQL fulfillment rolls back completely on a ticket insert failure, then permits recovery', async t => {
  const { pg, eventId, typeId } = await database(t);
  const c = await create(pg, eventId, typeId);
  await pg.exec("ALTER TABLE tickets ADD CONSTRAINT simulate_failure CHECK (number < 2)");
  await assert.rejects(pg.query('SELECT complete_papi_checkout($1,3000,$2,$3)', [c.id, 'provider', 'MVOLA']), /simulate_failure/);
  assert.equal((await pg.query('SELECT * FROM tickets')).rows.length, 0);
  assert.equal((await pg.query('SELECT * FROM orders')).rows.length, 0);
  assert.equal((await pg.query('SELECT status FROM papi_checkouts')).rows[0].status, 'pending');
  await pg.exec('ALTER TABLE tickets DROP CONSTRAINT simulate_failure');
  await pg.query('SELECT complete_papi_checkout($1,3000,$2,$3)', [c.id, 'provider', 'MVOLA']);
  assert.equal((await pg.query('SELECT * FROM tickets')).rows.length, 2);
});

// Minimal in-memory Supabase double for orchestration, no real keys or network.
function fakeDb(checkout) {
  let completions = 0;
  return {
    get completions() { return completions; },
    from() {
      let update, excludePaid = false;
      const q = {
        select() { return q; }, eq() { return q; }, or() { return q; },
        neq() { excludePaid = true; return q; },
        update(value) { update = value; return q; },
        maybeSingle() { return Promise.resolve({ data: { ...checkout } }); },
        then(resolve) {
          if (update && !(excludePaid && checkout.status === 'paid')) Object.assign(checkout, update);
          resolve({ data: [{ id: checkout.id }] });
        },
      };
      return q;
    },
    async rpc(_name, args) { assert.equal(args.p_amount, 3000); if (checkout.status !== 'paid') completions++; checkout.status = 'paid'; return {}; },
  };
}
test('orchestration recovers a missed callback and never reissues a paid or pending payment', async t => {
  const original = papi.request;
  t.after(() => { papi.request = original; });
  const c = { id: randomUUID(), status: 'pending', amount: 3000, notification_token: 'secret' };
  const db = fakeDb(c), svc = createCheckoutService(db);
  let calls = [];
  papi.request = async (path, body) => {
    calls.push({ path, body });
    return { merchantPaymentReference: `PAPI-${c.id}`, amount: 3000, currency: 'MGA', notificationToken: 'secret', paymentStatus: 'PENDING', linkStatus: 'EXPIRED' };
  };
  await assert.rejects(svc.issue({ ...c }, 'token'), /déjà en cours/);
  assert.equal(c.status, 'pending');
  assert.equal(calls.filter(call => call.body).length, 0);
  papi.request = async () => ({ merchantPaymentReference: `PAPI-${c.id}`, amount: 3000, currency: 'MGA', linkStatus: 'PAID', paymentStatus: 'SUCCESS', papiPaymentReference: 'provider' });
  await svc.reconcile({ ...c });
  assert.equal(c.status, 'paid');
  await svc.issue({ ...c }, 'token');
  await svc.apply({ ...c }, { merchantPaymentReference: `PAPI-${c.id}`, amount: 3000, notificationToken: 'secret', paymentStatus: 'SUCCESS' });
  assert.equal(db.completions, 1);
  await svc.apply({ ...c }, { merchantPaymentReference: `PAPI-${c.id}`, amount: 3000, notificationToken: 'secret', paymentStatus: 'FAILED' });
  assert.equal(c.status, 'paid');
});

test('orchestration recovers the existing active link instead of charging a second time', async t => {
  const original = papi.request;
  t.after(() => { papi.request = original; });
  const c = { id: randomUUID(), status: 'pending', amount: 3000 };
  const svc = createCheckoutService(fakeDb(c));
  papi.request = async (_path, body) => {
    assert.equal(body, undefined);
    return { merchantPaymentReference: `PAPI-${c.id}`, amount: 3000, currency: 'MGA', notificationToken: 'restored', paymentStatus: null, linkStatus: 'ACTIVE', paymentLink: 'https://payment-form.papi.mg/shop/payments/test', linkExpirationDateTime: Date.now() + 3600000 };
  };
  const result = await svc.issue(c, 'token');
  assert.equal(result.notification_token, 'restored');
  assert.equal(result.payment_link, 'https://payment-form.papi.mg/shop/payments/test');
});

test('new payment link uses the persisted total and server callback; provider timeout keeps the order recoverable', async t => {
  const originalRequest = papi.request, originalConfig = papi.config;
  t.after(() => { papi.request = originalRequest; papi.config = originalConfig; });
  papi.config = () => ({ frontend: 'https://tickets.example', backend: 'https://api.example' });
  const c = { id: randomUUID(), status: 'pending', amount: 3000, quantity: 2, ticket_type_name: 'Standard', event_title: 'Concert', buyer_name: 'Client', buyer_phone: '0340000000' };
  const db = fakeDb(c), svc = createCheckoutService(db);
  let shouldTimeout = true;
  papi.request = async (_path, body) => {
    if (!body) throw Object.assign(new Error('Not found'), { providerStatus: 404 });
    assert.equal(body.amount, 3000);
    assert.equal(body.reference, `PAPI-${c.id}`);
    assert.equal(body.notificationUrl, 'https://api.example/api/payments/papi/notification');
    assert.equal(body.successUrl, `https://tickets.example/paiement/${c.id}#token=secret`);
    assert.equal(body.failureUrl, body.successUrl);
    assert.equal(body.provider, undefined);
    if (shouldTimeout) throw new Error('timeout');
    return { paymentReference: `PAPI-${c.id}`, amount: 3000, notificationToken: 'provider-token', paymentLink: 'https://payment-form.papi.mg/shop/payments/new', linkExpirationDateTime: Date.now() + 3600000 };
  };
  await assert.rejects(svc.issue({ ...c }, 'secret'), /timeout/);
  assert.equal(c.status, 'pending');
  assert.equal(c.issuing_until, null);
  assert.equal(db.completions, 0);
  shouldTimeout = false;
  const created = await svc.issue({ ...c }, 'secret');
  assert.equal(created.notification_token, 'provider-token');
  assert.equal(created.payment_link, 'https://payment-form.papi.mg/shop/payments/new');
  assert.equal(db.completions, 0);
});
