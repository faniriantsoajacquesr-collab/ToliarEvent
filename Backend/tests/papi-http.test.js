const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const express = require('express');
const { once } = require('node:events');
const { hashToken } = require('../services/papiClient');

test('HTTP callbacks use raw signed bytes; tracking rejects forged access and URL success flags', async t => {
  t.mock.method(require('../services/papiClient'), 'config', () => ({}));
  const token = 'a'.repeat(64), secret = 'pwhsec_local_test_only';
  const oldSecret = process.env.PAPI_WEBHOOK_SECRET;
  process.env.PAPI_WEBHOOK_SECRET = secret;
  t.after(() => { if (oldSecret === undefined) delete process.env.PAPI_WEBHOOK_SECRET; else process.env.PAPI_WEBHOOK_SECRET = oldSecret; });
  const row = { id: randomUUID(), access_hash: hashToken(token), status: 'pending', amount: 3000, notification_token: 'expected', last_checked_at: new Date().toISOString() };
  let completions = 0;
  const db = {
    from(table) {
      let update;
      const q = {
        select() { return q; }, eq() { return q; }, neq() { return q; },
        update(value) { update = value; return q; },
        maybeSingle() { return Promise.resolve({ data: { ...row } }); },
        then(resolve) { if (update && row.status !== 'paid') Object.assign(row, update); resolve({ data: table === 'order_items' ? [{ tickets: { id: 'ticket', number: 1, ticket_type: 'Standard' } }] : [] }); },
      };
      return q;
    },
    async rpc(name, args) {
      if (name === 'create_papi_checkout') {
        assert.equal(args.p_buyer_phone, null);
        return { data: { ...row } };
      }
      if (row.status !== 'paid') completions++;
      row.status = 'paid'; return {};
    },
  };
  const filename = path.resolve(__dirname, '../Controllers/papiController.js');
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const localRequire = Module.createRequire(filename);
  instance.require = name => name === '../utils/supabase' ? { admin: db } : localRequire(name);
  instance._compile(readFileSync(filename, 'utf8'), filename);
  const controller = instance.exports;
  const app = express();
  app.post('/notification', express.raw({ type: 'application/json' }), controller.notification);
  app.use(express.json());
  app.get('/checkouts/:id', controller.status);
  app.post('/events/:id/checkout', controller.create);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const created = await fetch(`${base}/events/${randomUUID()}/checkout`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Checkout-Token': token },
    body: JSON.stringify({ checkout_id: row.id, ticket_type_id: 1, quantity: 2, buyer_name: 'Client', accepted_terms: true }),
  });
  assert.equal(created.status, 201);
  assert.equal(completions, 0);
  const get = value => fetch(`${base}/checkouts/${row.id}?success=true`, { headers: { 'X-Checkout-Token': value } });
  assert.equal((await get('')).status, 403);
  assert.equal((await get('b'.repeat(64))).status, 403);
  const pending = await (await get(token)).json();
  assert.equal(pending.checkout.status, 'pending');
  assert.deepEqual(pending.checkout.tickets, []);
  assert.equal(pending.checkout.access_hash, undefined);
  const send = async (patch = {}, mode = 'valid') => {
    const body = JSON.stringify({ merchantPaymentReference: `PAPI-${row.id}`, amount: 3000, notificationToken: 'expected', paymentStatus: 'SUCCESS', paymentReference: 'provider', ...patch }) + '\n';
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    return fetch(`${base}/notification`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Papi-Signature': mode === 'valid' ? `t=${timestamp},v1=${signature}` : '' }, body });
  };
  assert.equal((await send({}, 'missing')).status, 401);
  assert.equal(completions, 0);
  assert.equal((await send({ amount: 3001 })).status, 400);
  assert.equal((await send({ notificationToken: 'wrong' })).status, 400);
  assert.equal((await send({ paymentStatus: 'UNKNOWN' })).status, 400);
  assert.equal(completions, 0);
  assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 200);
  assert.equal(completions, 1);
  const paidResponse = await get(token);
  assert.equal(paidResponse.headers.get('cache-control'), 'no-store');
  const paid = await paidResponse.json();
  assert.equal(paid.checkout.status, 'paid');
  assert.equal(paid.checkout.tickets.length, 1);
});
