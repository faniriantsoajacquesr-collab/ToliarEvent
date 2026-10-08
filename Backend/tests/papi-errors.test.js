const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkoutError } = require('../services/papiErrors');

test('checkout failures distinguish ended events, inactive tickets, conflicts and minimum amounts', () => {
  const ended = checkoutError({ message: 'EVENT_UNAVAILABLE' });
  assert.equal(ended.code, 'EVENT_UNAVAILABLE');
  assert.match(ended.message, /terminé/);
  assert.doesNotMatch(ended.message, /300/);
  assert.equal(checkoutError({ message: 'TICKET_UNAVAILABLE' }).code, 'TICKET_UNAVAILABLE');
  assert.equal(checkoutError({ message: 'CHECKOUT_CONFLICT' }).status, 409);
  assert.equal(checkoutError({ message: 'INVALID_AMOUNT' }).status, 400);
  const unknown = checkoutError({ message: 'private database details' });
  assert.equal(unknown.status, 503);
  assert.doesNotMatch(unknown.message, /private/);
});
