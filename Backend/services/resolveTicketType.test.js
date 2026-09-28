const { test } = require('node:test');
const assert = require('node:assert/strict');
const resolve = require('./resolveTicketType');

function database(row) {
  const filters = {};
  const query = {
    select() { return this; },
    eq(key, value) { filters[key] = value; return this; },
    async single() { return { data: row, error: null }; },
  };
  return { filters, from(table) { assert.equal(table, 'ticket_type'); return query; } };
}

test('uses catalog price and scopes the selected type to its event', async () => {
  const db = database({ id: 'vip', name: 'VIP', price: '15000' });
  const result = await resolve(db, { event_id: 'event', ticket_type_id: 'vip', price: 1 });
  assert.equal(result.price, 15000);
  assert.deepEqual(db.filters, { event_id: 'event', id: 'vip' });
});

test('supports legacy names and free tickets', async () => {
  const db = database({ name: 'Invitation', price: 0 });
  assert.equal((await resolve(db, { event_id: 'event', ticket_type: 'Invitation' })).price, 0);
  assert.equal(db.filters.name, 'Invitation');
});

test('rejects missing types and invalid catalog prices', async () => {
  for (const row of [null, { price: null }, { price: -1 }, { price: 'invalid' }]) {
    await assert.rejects(resolve(database(row), { event_id: 'event', ticket_type_id: 'vip' }));
  }
});
