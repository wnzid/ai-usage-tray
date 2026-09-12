const test = require('node:test');
const assert = require('node:assert/strict');
const { normalDelay, retryDelay } = require('../src/refresh-policy');

test('backs off failed refreshes up to five minutes', () => {
  assert.equal(retryDelay(1), 15_000);
  assert.equal(retryDelay(2), 30_000);
  assert.equal(retryDelay(4), 120_000);
  assert.equal(retryDelay(99), 300_000);
});

test('converts the configured refresh interval to milliseconds', () => {
  assert.equal(normalDelay(1), 60_000);
  assert.equal(normalDelay(15), 900_000);
  assert.equal(normalDelay(undefined), 120_000);
});
